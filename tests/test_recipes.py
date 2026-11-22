def test_create_recipe(client):
    """Test creating a new recipe"""
    response = client.post("/api/recipes/chocolate-cake")
    assert response.status_code == 200

    # Verify file was created with basic template
    response = client.get("/api/files/chocolate-cake.md")
    assert response.status_code == 200
    content = response.json()["content"]
    assert "# Chocolate Cake" in content
    assert "## Ingredients" in content


def test_save_recipe(client):
    """Test saving a recipe without validation"""
    recipe_content = """# Test Recipe

## Ingredients

- 1 ingredient

## Instructions

1. Do something

## Notes

Test
"""

    # Create recipe first to get version
    create_response = client.post("/api/recipes/test-recipe")
    version = create_response.json()["version"]

    # Now save with version
    response = client.put(
        "/api/files/test-recipe.md",
        json={"content": recipe_content, "version": version},
    )
    assert response.status_code == 200

    # Verify file was saved
    response = client.get("/api/files/test-recipe.md")
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == recipe_content


def test_save_recipe_any_format(client):
    """Test saving a recipe with any format (no validation)"""
    recipe_content = """# Simple Recipe

Just some text without specific formatting.
This should work fine now.
"""

    # Create recipe first to get version
    create_response = client.post("/api/recipes/simple-recipe")
    version = create_response.json()["version"]

    response = client.put(
        "/api/files/simple-recipe.md",
        json={"content": recipe_content, "version": version},
    )
    assert response.status_code == 200

    # Verify file was saved
    response = client.get("/api/files/simple-recipe.md")
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == recipe_content


def test_create_recipe_in_subdirectory(client):
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


def test_save_recipe_updates_existing(client):
    """Test that saving a recipe updates existing content"""
    # Create initial recipe
    create_response = client.post("/api/recipes/update-test")
    version1 = create_response.json()["version"]

    initial_content = "# Test Recipe\n\nInitial content"
    response = client.put(
        "/api/files/update-test.md",
        json={"content": initial_content, "version": version1},
    )
    assert response.status_code == 200
    version2 = response.json()["version"]

    # Update the recipe
    updated_content = "# Test Recipe\n\nUpdated content with more details"
    response = client.put(
        "/api/files/update-test.md",
        json={"content": updated_content, "version": version2},
    )
    assert response.status_code == 200

    # Verify update
    response = client.get("/api/files/update-test.md")
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == updated_content
