from fastapi import APIRouter, HTTPException, Form, File, UploadFile
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import re
import time
from .filesystem import FileSystemManager

router = APIRouter(prefix="/api", tags=["files"])
fs_manager = FileSystemManager()


class FileContent(BaseModel):
    content: str


class FileMoveRequest(BaseModel):
    destination: str


class DirectoryCreate(BaseModel):
    path: str


class RecipeContent(BaseModel):
    content: str


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


@router.post("/files/{path:path}/move")
async def move_file(path: str, move_data: FileMoveRequest) -> Dict[str, str]:
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


@router.post("/files/{path:path}")
async def create_file(path: str, file_data: FileContent) -> Dict[str, str]:
    """Create a new file with content"""
    return await fs_manager.write_file(path, file_data.content)


@router.delete("/files/{path:path}")
async def delete_file(path: str) -> Dict[str, str]:
    """Delete a specific file"""
    return await fs_manager.delete_file(path)


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
            "children": [],
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
        raise HTTPException(
            status_code=500, detail=f"Failed to get directory tree: {str(e)}"
        )


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
        raise HTTPException(
            status_code=500, detail=f"Failed to delete directory: {str(e)}"
        )


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...), path: str = Form(...)
) -> Dict[str, str]:
    """Upload a file to the specified path"""
    try:
        content = await file.read()
        content_str = content.decode("utf-8")
        return await fs_manager.write_file(path, content_str)
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be valid UTF-8 text")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


# Recipe-specific endpoints


@router.put("/recipes/{path:path}")
async def save_recipe(path: str, recipe_data: RecipeContent) -> Dict[str, str]:
    """Save a recipe file"""
    if not path.endswith(".md"):
        path += ".md"

    return await fs_manager.write_file(path, recipe_data.content)


@router.post("/recipes/{path:path}")
async def create_recipe(path: str) -> Dict[str, str]:
    """Create a new recipe file with basic template"""
    if not path.endswith(".md"):
        path += ".md"

    # Create with basic recipe template
    title = path.replace(".md", "").replace("_", " ").replace("-", " ").title()
    content = f"""# {title}

## Ingredients

- 

## Instructions

1. 

## Notes

"""

    return await fs_manager.write_file(path, content)


class SearchResult(BaseModel):
    path: str
    title: str
    content_preview: str
    score: float
    matches: List[Dict[str, Any]]


class FileSearchResult(BaseModel):
    path: str
    name: str
    type: str
    score: float


@router.get("/search")
async def search_content(q: str, limit: int = 50) -> Dict[str, Any]:
    """Search for content within recipe files"""
    start_time = time.time()

    if not q or len(q.strip()) < 2:
        return {"query": q, "results": [], "total": 0, "duration_ms": 0}

    try:
        results = await _search_file_contents(q.strip(), limit)
        duration_ms = int((time.time() - start_time) * 1000)

        return {
            "query": q,
            "results": results,
            "total": len(results),
            "duration_ms": duration_ms,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/search/files")
async def search_files(q: str, limit: int = 50) -> Dict[str, Any]:
    """Search for files by filename"""
    start_time = time.time()

    if not q or len(q.strip()) < 1:
        return {"query": q, "results": [], "total": 0, "duration_ms": 0}

    try:
        results = await _search_filenames(q.strip(), limit)
        duration_ms = int((time.time() - start_time) * 1000)

        return {
            "query": q,
            "results": results,
            "total": len(results),
            "duration_ms": duration_ms,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File search failed: {str(e)}")


async def _search_file_contents(query: str, limit: int) -> List[Dict[str, Any]]:
    """Internal function to search file contents"""
    results = []
    query_lower = query.lower()
    query_words = re.findall(r"\w+", query_lower)

    # Get all files recursively
    all_files = await _get_all_files_recursive("")

    for file_info in all_files:
        if file_info["type"] != "file" or not file_info["name"].endswith(".md"):
            continue

        try:
            content = await fs_manager.read_file(file_info["path"])
            content_lower = content.lower()

            # Calculate relevance score
            score = 0
            matches = []

            # Exact phrase match gets highest score
            if query_lower in content_lower:
                score += 10
                matches.append(
                    {
                        "type": "phrase",
                        "text": query,
                        "position": content_lower.find(query_lower),
                    }
                )

            # Individual word matches
            for word in query_words:
                if len(word) < 2:
                    continue
                word_count = content_lower.count(word)
                if word_count > 0:
                    score += word_count * 2
                    matches.append({"type": "word", "text": word, "count": word_count})

            # Title match bonus
            title_match = _extract_title_from_content(content)
            if title_match and query_lower in title_match.lower():
                score += 15
                matches.append({"type": "title", "text": title_match})

            # Filename match bonus
            if query_lower in file_info["name"].lower():
                score += 8
                matches.append({"type": "filename", "text": file_info["name"]})

            if score > 0:
                # Generate content preview with highlighted matches
                preview = _generate_content_preview(content, query_words, 200)

                results.append(
                    {
                        "path": file_info["path"],
                        "title": title_match or file_info["name"],
                        "content_preview": preview,
                        "score": score,
                        "matches": matches,
                    }
                )

        except Exception as e:
            # Skip files that can't be read
            continue

    # Sort by relevance score (descending)
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]


async def _search_filenames(query: str, limit: int) -> List[Dict[str, Any]]:
    """Internal function to search filenames"""
    results = []
    query_lower = query.lower()

    # Get all files recursively
    all_files = await _get_all_files_recursive("")

    for file_info in all_files:
        name_lower = file_info["name"].lower()

        # Calculate filename relevance score
        score = 0

        # Exact match gets highest score
        if query_lower == name_lower:
            score = 100
        # Starts with query
        elif name_lower.startswith(query_lower):
            score = 50
        # Contains query
        elif query_lower in name_lower:
            score = 25
        # Fuzzy match (contains most characters)
        else:
            # Simple fuzzy matching
            matched_chars = sum(1 for c in query_lower if c in name_lower)
            if matched_chars >= len(query_lower) * 0.7:  # 70% match threshold
                score = matched_chars * 2

        if score > 0:
            results.append(
                {
                    "path": file_info["path"],
                    "name": file_info["name"],
                    "type": file_info["type"],
                    "score": score,
                }
            )

    # Sort by relevance score (descending)
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]


async def _get_all_files_recursive(path: str) -> List[Dict[str, Any]]:
    """Recursively get all files from directory"""
    all_files = []

    try:
        items = await fs_manager.list_directory(path)

        for item in items:
            if item["type"] == "file":
                all_files.append(item)
            elif item["type"] == "directory":
                # Recursively search subdirectories
                subpath = f"{path}/{item['name']}" if path else item["name"]
                sub_files = await _get_all_files_recursive(subpath)
                all_files.extend(sub_files)

    except Exception:
        # Skip directories that can't be read
        pass

    return all_files


def _extract_title_from_content(content: str) -> Optional[str]:
    """Extract title from markdown content"""
    lines = content.split("\n")
    for line in lines:
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
    return None


def _generate_content_preview(
    content: str, query_words: List[str], max_length: int
) -> str:
    """Generate a content preview highlighting search terms"""
    content = content.strip()

    if not query_words:
        return content[:max_length] + ("..." if len(content) > max_length else "")

    # Find the first occurrence of any query word
    first_match_pos = len(content)
    for word in query_words:
        if len(word) < 2:
            continue
        pos = content.lower().find(word.lower())
        if pos >= 0:
            first_match_pos = min(first_match_pos, pos)

    if first_match_pos == len(content):
        # No matches found, return beginning of content
        return content[:max_length] + ("..." if len(content) > max_length else "")

    # Extract text around the first match
    start = max(0, first_match_pos - max_length // 3)
    end = min(len(content), start + max_length)

    preview = content[start:end]

    # Add ellipsis if we're not at the beginning/end
    if start > 0:
        preview = "..." + preview
    if end < len(content):
        preview = preview + "..."

    return preview
