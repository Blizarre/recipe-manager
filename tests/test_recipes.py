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
from api.recipes import RecipeValidator

client = TestClient(app)
validator = RecipeValidator()

def test_get_recipe_template():
    """Test getting a recipe template"""
    response = client.get("/api/recipes/template")
    assert response.status_code == 200
    data = response.json()
    assert "template" in data
    assert "# New Recipe" in data["template"]
    assert "## Ingredients" in data["template"]
    assert "## Instructions" in data["template"]
    assert "## Notes" in data["template"]

def test_get_recipe_template_with_title():
    """Test getting a recipe template with custom title"""
    response = client.get("/api/recipes/template?title=Chocolate%20Cake")
    assert response.status_code == 200
    data = response.json()
    assert "# Chocolate Cake" in data["template"]

def test_create_recipe_with_template():
    """Test creating a new recipe with template"""
    response = client.post("/api/recipes/chocolate-cake")
    assert response.status_code == 200
    
    # Verify file was created with template
    response = client.get("/api/files/chocolate-cake.md")
    assert response.status_code == 200
    content = response.json()["content"]
    assert "# Chocolate Cake" in content
    assert "## Ingredients" in content

def test_validate_valid_recipe():
    """Test validating a properly formatted recipe"""
    valid_recipe = """# Chocolate Cake

## Ingredients

- 2 cups flour
- 1 cup sugar
- 3 eggs

## Instructions

1. Preheat oven to 350°F
2. Mix ingredients
3. Bake for 30 minutes

## Notes

Delicious!
"""
    
    response = client.post("/api/recipes/validate", json={
        "content": valid_recipe,
        "validate_recipe": True
    })
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] == True
    assert len(data["errors"]) == 0
    assert "info" in data
    assert data["info"]["title"] == "Chocolate Cake"
    assert data["info"]["ingredients_count"] == 3
    assert data["info"]["instructions_count"] == 3

def test_validate_invalid_recipe_missing_sections():
    """Test validating a recipe missing required sections"""
    invalid_recipe = """# Chocolate Cake

Some content but missing required sections.
"""
    
    response = client.post("/api/recipes/validate", json={
        "content": invalid_recipe,
        "validate_recipe": True
    })
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] == False
    assert len(data["errors"]) > 0
    assert any("Missing required section: ## Ingredients" in error for error in data["errors"])

def test_validate_recipe_bad_ingredients_format():
    """Test validating a recipe with incorrectly formatted ingredients"""
    invalid_recipe = """# Chocolate Cake

## Ingredients

2 cups flour
1 cup sugar
- 3 eggs

## Instructions

1. Preheat oven to 350°F
2. Mix ingredients
3. Bake for 30 minutes

## Notes

Delicious!
"""
    
    response = client.post("/api/recipes/validate", json={
        "content": invalid_recipe,
        "validate_recipe": True
    })
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] == False
    assert any("Ingredients must use bullet points" in error for error in data["errors"])

def test_validate_recipe_bad_instructions_format():
    """Test validating a recipe with incorrectly formatted instructions"""
    invalid_recipe = """# Chocolate Cake

## Ingredients

- 2 cups flour
- 1 cup sugar
- 3 eggs

## Instructions

Preheat oven to 350°F
Mix ingredients
3. Bake for 30 minutes

## Notes

Delicious!
"""
    
    response = client.post("/api/recipes/validate", json={
        "content": invalid_recipe,
        "validate_recipe": True
    })
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] == False
    assert any("Instructions must use numbered lists" in error for error in data["errors"])

def test_save_recipe_with_validation():
    """Test saving a recipe with validation enabled"""
    valid_recipe = """# Test Recipe

## Ingredients

- 1 ingredient

## Instructions

1. Do something

## Notes

Test
"""
    
    response = client.put("/api/recipes/test-recipe", json={
        "content": valid_recipe,
        "validate_recipe": True
    })
    assert response.status_code == 200
    
    # Verify file was saved
    response = client.get("/api/files/test-recipe.md")
    assert response.status_code == 200

def test_save_invalid_recipe_with_validation():
    """Test saving an invalid recipe with validation enabled should fail"""
    invalid_recipe = """# Test Recipe

Missing required sections.
"""
    
    response = client.put("/api/recipes/test-recipe", json={
        "content": invalid_recipe,
        "validate_recipe": True
    })
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert "Recipe validation failed" in detail["message"]

def test_save_invalid_recipe_without_validation():
    """Test saving an invalid recipe without validation should succeed"""
    invalid_recipe = """# Test Recipe

Missing required sections.
"""
    
    response = client.put("/api/recipes/test-recipe", json={
        "content": invalid_recipe,
        "validate_recipe": False
    })
    assert response.status_code == 200

def test_get_recipe_info():
    """Test getting recipe information"""
    # Create a recipe first
    recipe_content = """# Apple Pie

## Ingredients

- 2 apples
- 1 pie crust

## Instructions

1. Slice apples
2. Make pie

## Notes

Yummy
"""
    
    client.put("/api/recipes/apple-pie", json={
        "content": recipe_content,
        "validate_recipe": False
    })
    
    # Get recipe info
    response = client.get("/api/recipes/apple-pie.md/info")
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] == True
    assert data["info"]["title"] == "Apple Pie"
    assert data["info"]["ingredients_count"] == 2
    assert data["info"]["instructions_count"] == 2

def test_recipe_validator_auto_populate():
    """Test the auto-populate functionality"""
    template = validator.auto_populate_template("chocolate-chip-cookies.md")
    assert "# Chocolate Chip Cookies" in template
    
    template = validator.auto_populate_template("simple_pasta")
    assert "# Simple Pasta" in template