import pytest
from fastapi.testclient import TestClient
from pathlib import Path
import tempfile
import shutil
import os


@pytest.fixture(autouse=True)
def clean_test_dir():
    """Clean test directory before and after each test"""
    test_dir = tempfile.mkdtemp()
    os.environ["RECIPES_DIR"] = test_dir

    # Re-import to get fresh filesystem manager with new test dir
    import importlib
    import api.routes

    importlib.reload(api.routes)

    yield

    if Path(test_dir).exists():
        shutil.rmtree(test_dir)


from main import app

client = TestClient(app)


def test_health_endpoint():
    """Test the health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "recipes_dir" in data


def test_root_endpoint():
    """Test the API root endpoint"""
    response = client.get("/api")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Recipe Manager API"
    assert data["status"] == "running"


def test_list_empty_directory():
    """Test listing an empty directory"""
    response = client.get("/api/files")
    assert response.status_code == 200
    assert response.json() == []


def test_create_and_read_file():
    """Test creating and reading a file"""
    # Create a file
    file_content = {"content": "# Test Recipe\n\nThis is a test recipe."}
    response = client.post("/api/files/test.md", json=file_content)
    assert response.status_code == 200

    # Read the file
    response = client.get("/api/files/test.md")
    assert response.status_code == 200
    data = response.json()
    assert data["path"] == "test.md"
    assert data["content"] == "# Test Recipe\n\nThis is a test recipe."


def test_update_file():
    """Test updating a file"""
    # Create a file
    file_content = {"content": "Original content"}
    client.post("/api/files/update_test.md", json=file_content)

    # Update the file
    updated_content = {"content": "Updated content"}
    response = client.put("/api/files/update_test.md", json=updated_content)
    assert response.status_code == 200

    # Verify the update
    response = client.get("/api/files/update_test.md")
    assert response.status_code == 200
    assert response.json()["content"] == "Updated content"


def test_delete_file():
    """Test deleting a file"""
    # Create a file
    file_content = {"content": "To be deleted"}
    client.post("/api/files/delete_test.md", json=file_content)

    # Delete the file
    response = client.delete("/api/files/delete_test.md")
    assert response.status_code == 200

    # Verify file is gone
    response = client.get("/api/files/delete_test.md")
    assert response.status_code == 404


def test_create_directory():
    """Test creating a directory"""
    response = client.post("/api/directories/test_dir")
    assert response.status_code == 200

    # Verify directory appears in listing
    response = client.get("/api/files")
    assert response.status_code == 200
    items = response.json()
    dir_item = next((item for item in items if item["name"] == "test_dir"), None)
    assert dir_item is not None
    assert dir_item["type"] == "directory"


def test_invalid_path_security():
    """Test that path traversal attempts are blocked"""
    # Try to access files outside the recipes directory
    response = client.get("/api/files/../../../etc/passwd")
    # The path validation works, so this should either be 400 or 404
    # since the sanitized path doesn't exist
    assert response.status_code in [400, 404]


def test_file_not_found():
    """Test accessing a non-existent file"""
    response = client.get("/api/files/nonexistent.md")
    assert response.status_code == 404


def test_search_content():
    """Test content search functionality"""
    # Create a test file with searchable content
    file_content = {
        "content": "# Test Recipe\n\nThis is about chocolate cake with eggs."
    }
    client.post("/api/files/search_test.md", json=file_content)

    # Search for content
    response = client.get("/api/search?q=chocolate")
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "chocolate"
    assert data["total"] >= 1
    assert any("search_test.md" in result["path"] for result in data["results"])


def test_search_files():
    """Test filename search functionality"""
    # Create test files
    client.post("/api/files/chocolate-cookies.md", json={"content": "# Cookies"})
    client.post("/api/files/vanilla-cake.md", json={"content": "# Cake"})

    # Search for files by name
    response = client.get("/api/search/files?q=chocolate")
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "chocolate"
    assert data["total"] >= 1
    assert any("chocolate-cookies.md" in result["name"] for result in data["results"])


def test_directory_operations():
    """Test directory creation and listing"""
    # Create a directory
    response = client.post("/api/directories/test_category")
    assert response.status_code == 200

    # Create a file in the directory
    file_content = {"content": "# Category Recipe"}
    response = client.post("/api/files/test_category/recipe.md", json=file_content)
    assert response.status_code == 200

    # List files in directory
    response = client.get("/api/files?path=test_category")
    assert response.status_code == 200
    items = response.json()
    assert len(items) >= 1
    assert any(item["name"] == "recipe.md" for item in items)
