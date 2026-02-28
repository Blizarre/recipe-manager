from fastapi import APIRouter, HTTPException, File, UploadFile
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import re
import time
import logging
from .filesystem import FileSystemManager
from .translation import (
    translate_markdown,
    markdown_to_html,
    TranslationError,
    get_cached_translation,
    cache_translation,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["files"])
fs_manager = FileSystemManager()


class FileCreateContent(BaseModel):
    content: str


class FileUpdateContent(BaseModel):
    content: str
    version: int  # Required for updates to prevent conflicts


class FileMoveRequest(BaseModel):
    destination: str


@router.get("/files")
async def list_files(path: str = "") -> List[Dict[str, Any]]:
    """List files and directories at the specified path"""
    return await fs_manager.list_directory(path)


@router.get("/files/{path:path}")
async def get_file_content(path: str) -> Dict[str, Any]:
    """Get the content of a specific file with version info"""
    return await fs_manager.read_file_with_version(path)


@router.put("/files/{path:path}")
async def update_file_content(
    path: str, file_data: FileUpdateContent
) -> Dict[str, Any]:
    """Update the content of a specific file with version conflict detection"""
    return await fs_manager.write_file(path, file_data.content, file_data.version)


@router.post("/files/{path:path}/move")
async def move_file(path: str, move_data: FileMoveRequest) -> Dict[str, str]:
    """Move/rename a file to a new location"""
    # Read the file content
    content = await fs_manager.read_file(path)

    # If it's a recipe file, try to move associated photo first
    if path.endswith(".md") and move_data.destination.endswith(".md"):
        await fs_manager.move_photo(path, move_data.destination)

    # Write to new location
    await fs_manager.write_file(move_data.destination, content)

    # Delete old file (this will also handle photo cleanup if move failed)
    await fs_manager.delete_file(path)

    return {"message": f"File moved from {path} to {move_data.destination}"}


@router.post("/files/{path:path}")
async def create_file(path: str, file_data: FileCreateContent) -> Dict[str, Any]:
    """Create a new file with content"""
    return await fs_manager.write_file(path, file_data.content)


@router.delete("/files/{path:path}")
async def delete_file(path: str) -> Dict[str, str]:
    """Delete a specific file"""
    return await fs_manager.delete_file(path)


@router.post("/directories/{path:path}")
async def create_directory(path: str) -> Dict[str, str]:
    """Create a new directory"""
    return await fs_manager.create_directory(path)


@router.delete("/directories/{path:path}")
async def delete_directory(path: str) -> Dict[str, str]:
    """Delete a directory (must be empty)"""
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


# Recipe-specific endpoints


@router.put("/recipes/{path:path}")
async def save_recipe(path: str, recipe_data: FileUpdateContent) -> Dict[str, Any]:
    """Save a recipe file with version conflict detection"""
    if not path.endswith(".md"):
        path += ".md"

    return await fs_manager.write_file(path, recipe_data.content, recipe_data.version)


@router.post("/recipes/{path:path}")
async def create_recipe(path: str) -> Dict[str, Any]:
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


@router.get("/search")
async def search_content(q: str, limit: int = 50) -> Dict[str, Any]:
    """Search for content within recipe files"""
    start_time = time.time()

    if not q or len(q.strip()) < 2:
        return {"query": q, "results": [], "total": 0, "duration_ms": 0}

    results = await _search_file_contents(q.strip(), limit)
    duration_ms = int((time.time() - start_time) * 1000)

    return {
        "query": q,
        "results": results,
        "total": len(results),
        "duration_ms": duration_ms,
    }


@router.get("/search/files")
async def search_files(q: str, limit: int = 50) -> Dict[str, Any]:
    """Search for files by filename"""
    start_time = time.time()

    if not q or len(q.strip()) < 1:
        return {"query": q, "results": [], "total": 0, "duration_ms": 0}

    results = await _search_filenames(q.strip(), limit)
    duration_ms = int((time.time() - start_time) * 1000)

    return {
        "query": q,
        "results": results,
        "total": len(results),
        "duration_ms": duration_ms,
    }


async def _search_file_contents(query: str, limit: int) -> List[Dict[str, Any]]:
    """Internal function to search file contents"""
    results = []
    query_lower = query.lower()
    query_words = re.findall(r"\w+", query_lower)
    all_files = await _get_all_files_recursive("")

    for file_info in all_files:
        if file_info["type"] != "file" or not file_info["name"].endswith(".md"):
            continue

        try:
            content = await fs_manager.read_file(file_info["path"])
            content_lower = content.lower()

            score = 0
            matches = []

            # Exact phrase match
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
                if len(word) >= 2:
                    word_count = content_lower.count(word)
                    if word_count > 0:
                        score += word_count * 2
                        matches.append(
                            {"type": "word", "text": word, "count": word_count}
                        )

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

        except Exception:
            continue

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]


async def _search_filenames(query: str, limit: int) -> List[Dict[str, Any]]:
    """Internal function to search filenames"""
    results = []
    query_lower = query.lower()
    all_files = await _get_all_files_recursive("")

    for file_info in all_files:
        name_lower = file_info["name"].lower()

        # Calculate filename relevance score
        if query_lower == name_lower:
            score = 100
        elif name_lower.startswith(query_lower):
            score = 50
        elif query_lower in name_lower:
            score = 25
        else:
            # Fuzzy matching
            matched_chars = sum(1 for c in query_lower if c in name_lower)
            score = matched_chars * 2 if matched_chars >= len(query_lower) * 0.7 else 0

        if score > 0:
            results.append(
                {
                    "path": file_info["path"],
                    "name": file_info["name"],
                    "type": file_info["type"],
                    "score": score,
                }
            )

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


# Photo endpoints


@router.get("/photos/{path:path}")
async def get_photo(path: str) -> Response:
    """Get photo for a recipe - returns 404 if no photo exists"""
    # Ensure path ends with .md for consistency
    if not path.endswith(".md"):
        path += ".md"

    # Check if photo exists
    if not await fs_manager.photo_exists(path):
        raise HTTPException(status_code=404, detail="Photo not found")

    # Read photo content
    photo_content = await fs_manager.read_photo(path)

    # Return photo with appropriate headers
    return Response(
        content=photo_content,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "public, max-age=3600",
            "Content-Disposition": f"inline; filename={path.replace('.md', '.jpeg')}",
        },
    )


@router.post("/photos/{path:path}")
async def upload_photo(path: str, file: UploadFile = File(...)) -> Dict[str, str]:
    """Upload a photo for a recipe - only JPEG files allowed"""
    # Ensure path ends with .md for consistency
    if not path.endswith(".md"):
        path += ".md"

    # Validate file type
    if not file.filename or not file.filename.lower().endswith((".jpg", ".jpeg")):
        raise HTTPException(status_code=400, detail="Only JPEG files are allowed")

    # Validate MIME type
    if file.content_type and not file.content_type.startswith("image/jpeg"):
        raise HTTPException(status_code=400, detail="File must be a JPEG image")

    # Check file size (10MB limit)
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 10MB")

    # Read file content
    photo_content = await file.read()

    # Validate that we actually have content
    if not photo_content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Save photo
    result = await fs_manager.write_photo(path, photo_content)

    return {
        "message": "Photo uploaded successfully",
        "recipe_path": path,
        "photo_path": result["path"],
    }


@router.delete("/photos/{path:path}")
async def delete_photo(path: str) -> Dict[str, str]:
    """Delete photo for a recipe"""
    # Ensure path ends with .md for consistency
    if not path.endswith(".md"):
        path += ".md"

    # Delete photo
    await fs_manager.delete_photo(path)

    return {"message": "Photo deleted successfully", "recipe_path": path}


@router.get("/recipes/{path:path}/translate", response_class=HTMLResponse)
async def translate_recipe(path: str) -> HTMLResponse:
    """Translate a recipe to French and return as HTML"""
    try:
        # Ensure path ends with .md
        if not path.endswith(".md"):
            path += ".md"

        # Get file modification time for caching
        file_path = fs_manager._validate_path(path)
        file_mtime = file_path.stat().st_mtime

        # Check cache first (but we still need to check for photo changes)
        cached = get_cached_translation(path, file_mtime)
        if cached:
            # Even with cached translation, we need to check if photo status changed
            photo_url = None
            if await fs_manager.photo_exists(path):
                photo_url = f"/api/photos/{path}"

            # If the cached content doesn't match current photo status, regenerate
            has_photo_in_cache = 'class="recipe-photo"' in cached.html_content
            has_photo_now = photo_url is not None

            if has_photo_in_cache == has_photo_now:
                return HTMLResponse(content=cached.html_content, status_code=200)
            # If photo status changed, continue to regenerate

        # Read the recipe file using existing filesystem manager
        markdown_content = await fs_manager.read_file(path)

        # Extract title from content for HTML title
        title = (
            _extract_title_from_content(markdown_content)
            or path.replace(".md", "").replace("_", " ").replace("-", " ").title()
        )

        # Translate content to French
        translated_content = await translate_markdown(markdown_content)

        # Check if photo exists for this recipe
        photo_url = None
        if await fs_manager.photo_exists(path):
            photo_url = f"/api/photos/{path}"

        # Convert to HTML
        html_content = markdown_to_html(translated_content, title, photo_url)

        # Cache the result
        cache_translation(path, translated_content, html_content, file_mtime)

        return HTMLResponse(content=html_content, status_code=200)

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Recipe file '{path}' not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except TranslationError as e:
        logger.error(f"Translation error for path '{path}': {str(e)}")
        raise HTTPException(
            status_code=503, detail="Translation service temporarily unavailable"
        )
    except Exception as e:
        logger.error(f"Unexpected error translating '{path}': {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
