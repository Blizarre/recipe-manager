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

def test_create_recipe():
    """Test creating a new recipe"""
    response = client.post("/api/recipes/chocolate-cake")
    assert response.status_code == 200
    
    # Verify file was created with basic template
    response = client.get("/api/files/chocolate-cake.md")
    assert response.status_code == 200
    content = response.json()["content"]
    assert "# Chocolate Cake" in content
    assert "## Ingredients" in content


def test_save_recipe():
    """Test saving a recipe without validation"""
    recipe_content = """# Test Recipe

## Ingredients

- 1 ingredient

## Instructions

1. Do something

## Notes

Test
"""
    
    response = client.put("/api/recipes/test-recipe", json={
        "content": recipe_content
    })
    assert response.status_code == 200
    
    # Verify file was saved
    response = client.get("/api/files/test-recipe.md")
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == recipe_content

def test_save_recipe_any_format():
    """Test saving a recipe with any format (no validation)"""
    recipe_content = """# Simple Recipe

Just some text without specific formatting.
This should work fine now.
"""
    
    response = client.put("/api/recipes/simple-recipe", json={
        "content": recipe_content
    })
    assert response.status_code == 200
    
    # Verify file was saved
    response = client.get("/api/files/simple-recipe.md")
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == recipe_content

def test_create_recipe_in_subdirectory():
    """Test creating a recipe in a subdirectory"""
    # Create directory first
    client.post("/api/directories/desserts")
    
    # Create recipe in subdirectory
    response = client.post("/api/recipes/desserts/chocolate-cake")
    assert response.status_code == 200
    
    # Verify file was created with template
    response = client.get("/api/files/desserts/chocolate-cake.md")
    assert response.status_code == 200
    content = response.json()["content"]
    assert "# Desserts/Chocolate Cake" in content
    assert "## Ingredients" in content
    assert "## Instructions" in content

def test_save_recipe_updates_existing():
    """Test that saving a recipe updates existing content"""
    # Create initial recipe
    initial_content = "# Test Recipe\n\nInitial content"
    response = client.put("/api/recipes/update-test", json={"content": initial_content})
    assert response.status_code == 200
    
    # Update the recipe
    updated_content = "# Test Recipe\n\nUpdated content with more details"
    response = client.put("/api/recipes/update-test", json={"content": updated_content})
    assert response.status_code == 200
    
    # Verify update
    response = client.get("/api/files/update-test.md")
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == updated_content