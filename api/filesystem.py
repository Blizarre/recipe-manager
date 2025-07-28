import os
import aiofiles
from pathlib import Path
from fastapi import HTTPException
from typing import List, Dict, Any
import re


class FileSystemManager:
    """Secure file system operations for recipe management"""

    def __init__(self, base_dir: str = None):
        if base_dir is None:
            import os

            base_dir = os.getenv("RECIPES_DIR", "recipes")
        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(exist_ok=True)

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
        """List files and directories"""
        try:
            dir_path = self._validate_path(path)
            if not dir_path.exists():
                return []

            items = []
            for item in dir_path.iterdir():
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
        """Delete a file"""
        try:
            file_path = self._validate_path(path)
            if not file_path.exists():
                raise HTTPException(status_code=404, detail="File not found")

            if file_path.is_file():
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
