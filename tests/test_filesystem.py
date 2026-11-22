import stat

import pytest
from fastapi import HTTPException

from api.filesystem import FileSystemManager


@pytest.fixture
def fs(tmp_path):
    return FileSystemManager(str(tmp_path))


@pytest.mark.asyncio
async def test_move_file_moves_content(fs):
    await fs.write_file("recipe.md", "# Recipe")

    result = await fs.move_file("recipe.md", "dinner/recipe.md")

    assert result["path"] == "dinner/recipe.md"
    assert await fs.read_file("dinner/recipe.md") == "# Recipe"
    with pytest.raises(HTTPException) as exc_info:
        await fs.read_file("recipe.md")
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_move_file_overwrites_destination(fs):
    await fs.write_file("old.md", "# Old")
    await fs.write_file("new.md", "# Existing")

    await fs.move_file("old.md", "new.md")

    assert await fs.read_file("new.md") == "# Old"


@pytest.mark.asyncio
async def test_move_file_missing_source_raises(fs):
    with pytest.raises(HTTPException) as exc_info:
        await fs.move_file("missing.md", "new.md")

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_move_file_to_directory_raises(fs):
    await fs.write_file("recipe.md", "# Recipe")
    await fs.create_directory("dinner")

    with pytest.raises(HTTPException) as exc_info:
        await fs.move_file("recipe.md", "dinner")

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_atomic_write_preserves_permissions(fs):
    await fs.write_file("recipe.md", "# Recipe")
    recipe_path = fs.base_dir / "recipe.md"
    recipe_path.chmod(0o640)

    await fs.write_file("recipe.md", "# Updated")

    assert stat.S_IMODE(recipe_path.stat().st_mode) == 0o640
    assert await fs.read_file("recipe.md") == "# Updated"
