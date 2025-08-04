import aiofiles
from pathlib import Path
from fastapi import HTTPException
from typing import List, Dict, Any
import re
import logging
import os.path


class FileSystemManager:
    """Secure file system operations for recipe management"""

    def __init__(self, base_dir: str = None):
        if base_dir is None:
            import os

            base_dir = os.getenv("RECIPES_DIR", "recipes")
        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(exist_ok=True)
        self.logger = logging.getLogger(__name__)

    def _validate_path(self, path: str) -> Path:
        """Validate and sanitize file paths to prevent directory traversal"""
        # Remove any path traversal attempts
        clean_path = re.sub(r"\.\./", "", path)
        clean_path = clean_path.strip("/")

        # Resolve the full path and ensure it's within base_dir
        full_path = (self.base_dir / clean_path).resolve()

        if not str(full_path).startswith(str(self.base_dir)):
            raise HTTPException(status_code=400, detail="Invalid path")

        return full_path

    async def list_directory(self, path: str = "") -> List[Dict[str, Any]]:
        """List files and directories, filtering out photo files"""
        try:
            dir_path = self._validate_path(path)
            if not dir_path.exists():
                return []

            items = []
            for item in dir_path.iterdir():
                # Filter out .jpeg photo files from directory listings
                if item.is_file() and item.suffix.lower() == '.jpeg':
                    continue
                    
                relative_path = item.relative_to(self.base_dir)
                items.append(
                    {
                        "name": item.name,
                        "path": str(relative_path),
                        "type": "directory" if item.is_dir() else "file",
                        "size": item.stat().st_size if item.is_file() else None,
                    }
                )

            return sorted(items, key=lambda x: (x["type"] == "file", x["name"]))
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to list directory: {str(e)}"
            )

    async def read_file(self, path: str) -> str:
        """Read file content"""
        try:
            file_path = self._validate_path(path)
            if not file_path.exists() or not file_path.is_file():
                raise HTTPException(status_code=404, detail="File not found")

            async with aiofiles.open(file_path, "r", encoding="utf-8") as f:
                return await f.read()
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to read file: {str(e)}"
            )

    async def write_file(self, path: str, content: str) -> Dict[str, str]:
        """Write content to file"""
        try:
            file_path = self._validate_path(path)

            # Create parent directories if needed
            file_path.parent.mkdir(parents=True, exist_ok=True)

            async with aiofiles.open(file_path, "w", encoding="utf-8") as f:
                await f.write(content)

            return {
                "message": "File saved successfully",
                "path": str(file_path.relative_to(self.base_dir)),
            }
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to write file: {str(e)}"
            )

    async def delete_file(self, path: str) -> Dict[str, str]:
        """Delete a file and associated photo if it's a recipe"""
        try:
            file_path = self._validate_path(path)
            if not file_path.exists():
                raise HTTPException(status_code=404, detail="File not found")

            if file_path.is_file():
                # If it's a recipe file (.md), try to delete associated photo
                if path.endswith('.md'):
                    try:
                        await self.delete_photo(path)
                    except HTTPException:
                        # Photo doesn't exist, that's fine
                        pass
                    except Exception as e:
                        # Log but don't fail the file deletion
                        self.logger.warning(f"Failed to delete photo for {path}: {str(e)}")
                
                file_path.unlink()
                return {"message": "File deleted successfully"}
            else:
                raise HTTPException(status_code=400, detail="Path is not a file")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to delete file: {str(e)}"
            )

    async def create_directory(self, path: str) -> Dict[str, str]:
        """Create a directory"""
        try:
            dir_path = self._validate_path(path)
            dir_path.mkdir(parents=True, exist_ok=True)
            return {
                "message": "Directory created successfully",
                "path": str(dir_path.relative_to(self.base_dir)),
            }
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to create directory: {str(e)}"
            )

    # Photo-specific methods
    
    def _get_photo_path_for_recipe(self, recipe_path: str) -> Path:
        """Get the corresponding photo path for a recipe file"""
        recipe_file_path = self._validate_path(recipe_path)
        
        # Change extension from .md to .jpeg
        photo_name = os.path.splitext(recipe_file_path.name)[0] + '.jpeg'
        photo_path = recipe_file_path.parent / photo_name
        
        return photo_path
    
    async def photo_exists(self, recipe_path: str) -> bool:
        """Check if a photo exists for the given recipe"""
        try:
            photo_path = self._get_photo_path_for_recipe(recipe_path)
            return photo_path.exists() and photo_path.is_file()
        except Exception as e:
            self.logger.warning(f"Error checking photo existence for {recipe_path}: {str(e)}")
            return False
    
    async def get_photo_path(self, recipe_path: str) -> str:
        """Get the relative photo path for a recipe"""
        photo_path = self._get_photo_path_for_recipe(recipe_path)
        return str(photo_path.relative_to(self.base_dir))
        
    async def write_photo(self, recipe_path: str, photo_content: bytes) -> Dict[str, str]:
        """Write photo content to corresponding photo file"""
        try:
            photo_path = self._get_photo_path_for_recipe(recipe_path)
            
            # Create parent directories if needed
            photo_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write binary content for JPEG
            async with aiofiles.open(photo_path, "wb") as f:
                await f.write(photo_content)
            
            self.logger.info(f"Photo saved for recipe {recipe_path}")
            return {
                "message": "Photo saved successfully",
                "path": str(photo_path.relative_to(self.base_dir)),
            }
        except Exception as e:
            self.logger.error(f"Failed to write photo for {recipe_path}: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to save photo: {str(e)}"
            )
    
    async def read_photo(self, recipe_path: str) -> bytes:
        """Read photo content as bytes"""
        try:
            photo_path = self._get_photo_path_for_recipe(recipe_path)
            if not photo_path.exists() or not photo_path.is_file():
                raise HTTPException(status_code=404, detail="Photo not found")
            
            async with aiofiles.open(photo_path, "rb") as f:
                return await f.read()
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Failed to read photo for {recipe_path}: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to read photo: {str(e)}"
            )
    
    async def delete_photo(self, recipe_path: str) -> Dict[str, str]:
        """Delete photo associated with a recipe"""
        try:
            photo_path = self._get_photo_path_for_recipe(recipe_path)
            if photo_path.exists() and photo_path.is_file():
                photo_path.unlink()
                self.logger.info(f"Photo deleted for recipe {recipe_path}")
                return {"message": "Photo deleted successfully"}
            else:
                raise HTTPException(status_code=404, detail="Photo not found")
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Failed to delete photo for {recipe_path}: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Failed to delete photo: {str(e)}"
            )
    
    async def move_photo(self, old_recipe_path: str, new_recipe_path: str) -> bool:
        """Move photo when recipe is moved/renamed. Returns True if successful or no photo exists"""
        try:
            old_photo_path = self._get_photo_path_for_recipe(old_recipe_path)
            if not old_photo_path.exists():
                # No photo to move, return success
                return True
            
            new_photo_path = self._get_photo_path_for_recipe(new_recipe_path)
            
            # Create parent directories if needed
            new_photo_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Move the photo file
            old_photo_path.rename(new_photo_path)
            
            self.logger.info(f"Photo moved from {old_recipe_path} to {new_recipe_path}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to move photo from {old_recipe_path} to {new_recipe_path}: {str(e)}")
            # Don't raise exception - photo operations should not break file operations
            return False
