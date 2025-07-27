from fastapi import APIRouter, HTTPException, Form, File, UploadFile
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from .filesystem import FileSystemManager
from .recipes import RecipeValidator

router = APIRouter(prefix="/api", tags=["files"])
fs_manager = FileSystemManager()
recipe_validator = RecipeValidator()

class FileContent(BaseModel):
    content: str

class FileMove(BaseModel):
    destination: str

class DirectoryCreate(BaseModel):
    path: str

class RecipeContent(BaseModel):
    content: str
    validate_recipe: bool = True

@router.get("/files")
async def list_files(path: str = "") -> List[Dict[str, Any]]:
    """List files and directories at the specified path"""
    return await fs_manager.list_directory(path)

@router.get("/files/{path:path}")
async def get_file_content(path: str) -> Dict[str, str]:
    """Get the content of a specific file"""
    content = await fs_manager.read_file(path)
    return {"path": path, "content": content}

@router.put("/files/{path:path}")
async def update_file_content(path: str, file_data: FileContent) -> Dict[str, str]:
    """Update the content of a specific file"""
    return await fs_manager.write_file(path, file_data.content)

@router.post("/files/{path:path}")
async def create_file(path: str, file_data: FileContent) -> Dict[str, str]:
    """Create a new file with content"""
    return await fs_manager.write_file(path, file_data.content)

@router.delete("/files/{path:path}")
async def delete_file(path: str) -> Dict[str, str]:
    """Delete a specific file"""
    return await fs_manager.delete_file(path)

@router.post("/files/{path:path}/move")
async def move_file(path: str, move_data: FileMove) -> Dict[str, str]:
    """Move/rename a file to a new location"""
    try:
        # Read the file content
        content = await fs_manager.read_file(path)
        
        # Write to new location
        result = await fs_manager.write_file(move_data.destination, content)
        
        # Delete old file
        await fs_manager.delete_file(path)
        
        return {"message": f"File moved from {path} to {move_data.destination}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to move file: {str(e)}")

@router.get("/directories")
async def get_directory_tree(path: str = "") -> Dict[str, Any]:
    """Get directory tree structure"""
    try:
        items = await fs_manager.list_directory(path)
        
        # Build tree structure
        tree = {
            "name": path if path else "recipes",
            "path": path,
            "type": "directory",
            "children": []
        }
        
        for item in items:
            if item["type"] == "directory":
                # Recursively get subdirectories (limiting depth for performance)
                subdir_path = f"{path}/{item['name']}" if path else item["name"]
                sub_items = await fs_manager.list_directory(subdir_path)
                item["children"] = [x for x in sub_items if x["type"] == "directory"]
            tree["children"].append(item)
        
        return tree
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get directory tree: {str(e)}")

@router.post("/directories/{path:path}")
async def create_directory(path: str) -> Dict[str, str]:
    """Create a new directory"""
    return await fs_manager.create_directory(path)

@router.delete("/directories/{path:path}")
async def delete_directory(path: str) -> Dict[str, str]:
    """Delete a directory (must be empty)"""
    try:
        dir_path = fs_manager._validate_path(path)
        if not dir_path.exists():
            raise HTTPException(status_code=404, detail="Directory not found")
        
        if not dir_path.is_dir():
            raise HTTPException(status_code=400, detail="Path is not a directory")
        
        # Check if directory is empty
        if any(dir_path.iterdir()):
            raise HTTPException(status_code=400, detail="Directory is not empty")
        
        dir_path.rmdir()
        return {"message": "Directory deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete directory: {str(e)}")

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), path: str = Form(...)) -> Dict[str, str]:
    """Upload a file to the specified path"""
    try:
        content = await file.read()
        content_str = content.decode('utf-8')
        return await fs_manager.write_file(path, content_str)
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be valid UTF-8 text")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

# Recipe-specific endpoints
@router.get("/recipes/template")
async def get_recipe_template(title: str = "New Recipe") -> Dict[str, str]:
    """Get a recipe template"""
    template = recipe_validator.get_template(title)
    return {"template": template}

@router.post("/recipes/validate")
async def validate_recipe(recipe_data: RecipeContent) -> Dict[str, Any]:
    """Validate recipe content structure"""
    is_valid, errors = recipe_validator.validate_recipe(recipe_data.content)
    
    result = {
        "is_valid": is_valid,
        "errors": errors
    }
    
    if is_valid:
        result["info"] = recipe_validator.extract_recipe_info(recipe_data.content)
    
    return result

@router.put("/recipes/{path:path}")
async def save_recipe(path: str, recipe_data: RecipeContent) -> Dict[str, str]:
    """Save a recipe with optional validation"""
    if not path.endswith('.md'):
        path += '.md'
    
    # Validate if requested
    if recipe_data.validate_recipe:
        is_valid, errors = recipe_validator.validate_recipe(recipe_data.content)
        if not is_valid:
            raise HTTPException(status_code=400, detail={
                "message": "Recipe validation failed",
                "errors": errors
            })
    
    # Format the recipe content
    formatted_content = recipe_validator.format_recipe(recipe_data.content)
    
    return await fs_manager.write_file(path, formatted_content)

@router.post("/recipes/{path:path}")
async def create_recipe(path: str, use_template: bool = True) -> Dict[str, str]:
    """Create a new recipe, optionally with template"""
    if not path.endswith('.md'):
        path += '.md'
    
    if use_template:
        # Auto-populate template based on filename
        content = recipe_validator.auto_populate_template(path)
    else:
        content = ""
    
    return await fs_manager.write_file(path, content)

@router.get("/recipes/{path:path}/info")
async def get_recipe_info(path: str) -> Dict[str, Any]:
    """Get recipe information and validation status"""
    content = await fs_manager.read_file(path)
    
    is_valid, errors = recipe_validator.validate_recipe(content)
    info = recipe_validator.extract_recipe_info(content)
    
    return {
        "path": path,
        "is_valid": is_valid,
        "errors": errors,
        "info": info
    }