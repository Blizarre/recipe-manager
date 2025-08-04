import pytest
from pathlib import Path
import tempfile
import shutil
from api.filesystem import FileSystemManager


@pytest.fixture
def temp_filesystem():
    """Create a temporary filesystem manager for testing"""
    temp_dir = tempfile.mkdtemp()
    fs_manager = FileSystemManager(temp_dir)
    yield fs_manager
    shutil.rmtree(temp_dir)


@pytest.mark.asyncio
async def test_photo_filtering_in_directory_listing(temp_filesystem):
    """Test that .jpeg files are filtered out of directory listings"""
    fs = temp_filesystem
    
    # Create test files
    await fs.write_file("recipe1.md", "# Recipe 1")
    await fs.write_file("recipe2.md", "# Recipe 2")
    await fs.write_photo("recipe1.md", b"fake jpeg content")
    
    # List directory
    items = await fs.list_directory("")
    
    # Should only see .md files, not .jpeg files
    file_names = [item["name"] for item in items if item["type"] == "file"]
    assert "recipe1.md" in file_names
    assert "recipe2.md" in file_names
    assert "recipe1.jpeg" not in file_names


@pytest.mark.asyncio
async def test_photo_exists_functionality(temp_filesystem):
    """Test photo existence checking"""
    fs = temp_filesystem
    
    # Create recipe without photo
    await fs.write_file("recipe1.md", "# Recipe 1")
    assert await fs.photo_exists("recipe1.md") is False
    
    # Add photo
    await fs.write_photo("recipe1.md", b"fake jpeg content")
    assert await fs.photo_exists("recipe1.md") is True


@pytest.mark.asyncio
async def test_photo_write_and_read(temp_filesystem):
    """Test writing and reading photo content"""
    fs = temp_filesystem
    test_content = b"fake jpeg binary content"
    
    # Write photo
    result = await fs.write_photo("recipe1.md", test_content)
    assert "Photo saved successfully" in result["message"]
    
    # Read photo back
    read_content = await fs.read_photo("recipe1.md")
    assert read_content == test_content


@pytest.mark.asyncio
async def test_photo_path_generation(temp_filesystem):
    """Test that photo paths are generated correctly"""
    fs = temp_filesystem
    
    # Test basic path
    photo_path = await fs.get_photo_path("recipe1.md")
    assert photo_path == "recipe1.jpeg"
    
    # Test subdirectory path
    await fs.create_directory("subdir")
    photo_path = await fs.get_photo_path("subdir/recipe2.md")
    assert photo_path == "subdir/recipe2.jpeg"


@pytest.mark.asyncio
async def test_photo_move_functionality(temp_filesystem):
    """Test moving photos with recipes"""
    fs = temp_filesystem
    test_content = b"fake jpeg content"
    
    # Create recipe with photo
    await fs.write_file("old_recipe.md", "# Old Recipe")
    await fs.write_photo("old_recipe.md", test_content)
    
    # Move photo
    success = await fs.move_photo("old_recipe.md", "new_recipe.md")
    assert success is True
    
    # Verify photo moved
    assert await fs.photo_exists("old_recipe.md") is False
    assert await fs.photo_exists("new_recipe.md") is True
    
    # Verify content preserved
    moved_content = await fs.read_photo("new_recipe.md")
    assert moved_content == test_content


@pytest.mark.asyncio
async def test_photo_move_without_existing_photo(temp_filesystem):
    """Test moving when no photo exists (should succeed)"""
    fs = temp_filesystem
    
    # Move photo that doesn't exist
    success = await fs.move_photo("nonexistent.md", "new_recipe.md")
    assert success is True  # Should succeed even if no photo exists


@pytest.mark.asyncio
async def test_photo_delete_functionality(temp_filesystem):
    """Test deleting photos"""
    fs = temp_filesystem
    
    # Create photo
    await fs.write_photo("recipe1.md", b"fake content")
    assert await fs.photo_exists("recipe1.md") is True
    
    # Delete photo
    result = await fs.delete_photo("recipe1.md")
    assert "Photo deleted successfully" in result["message"]
    assert await fs.photo_exists("recipe1.md") is False


@pytest.mark.asyncio
async def test_recipe_delete_removes_photo(temp_filesystem):
    """Test that deleting a recipe also deletes its photo"""
    fs = temp_filesystem
    
    # Create recipe with photo
    await fs.write_file("recipe1.md", "# Recipe 1")
    await fs.write_photo("recipe1.md", b"fake content")
    
    # Verify both exist
    assert await fs.photo_exists("recipe1.md") is True
    
    # Delete recipe
    await fs.delete_file("recipe1.md")
    
    # Verify photo is also gone
    assert await fs.photo_exists("recipe1.md") is False