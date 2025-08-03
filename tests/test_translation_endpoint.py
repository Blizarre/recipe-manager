import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from main import app
from api.translation import TranslationError, translation_cache


client = TestClient(app)


@pytest.fixture
def mock_fs_manager():
    """Mock filesystem manager"""
    with patch("api.routes.fs_manager") as mock:
        # Make read_file return an async coroutine
        mock.read_file = AsyncMock()

        # Mock _validate_path to return a file-like object with stat
        mock_file = mock._validate_path.return_value
        mock_file.stat.return_value.st_mtime = 1234567890.0

        yield mock


@pytest.fixture
def mock_translation():
    """Mock translation functions"""
    with (
        patch(
            "api.routes.translate_markdown_to_french", new_callable=AsyncMock
        ) as mock_translate,
        patch("api.routes.markdown_to_html") as mock_html,
    ):
        yield mock_translate, mock_html


def test_translate_recipe_success(mock_fs_manager, mock_translation):
    """Test successful recipe translation"""
    mock_translate, mock_html = mock_translation

    # Clear cache to ensure clean test
    translation_cache.clear()

    # Setup mocks
    mock_fs_manager.read_file.return_value = (
        "# Test Recipe\n\n## Ingredients\n\n- Flour"
    )
    mock_translate.return_value = "# Recette de Test\n\n## Ingrédients\n\n- Farine"
    mock_html.return_value = "<html><body><h1>Recette de Test</h1></body></html>"

    # Make request
    response = client.get("/api/recipes/test-recipe/translate")

    # Verify response
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/html; charset=utf-8"
    assert "<h1>Recette de Test</h1>" in response.text


def test_translate_recipe_caching(mock_fs_manager, mock_translation):
    """Test that translation caching works correctly"""
    mock_translate, mock_html = mock_translation

    # Clear cache
    translation_cache.clear()

    # Setup mocks
    mock_fs_manager.read_file.return_value = (
        "# Test Recipe\n\n## Ingredients\n\n- Flour"
    )
    mock_translate.return_value = "# Recette de Test\n\n## Ingrédients\n\n- Farine"
    mock_html.return_value = "<html><body><h1>Recette de Test</h1></body></html>"

    # Mock file stat for mtime
    with patch("api.routes.fs_manager._validate_path") as mock_validate:
        mock_file = mock_validate.return_value
        mock_file.stat.return_value.st_mtime = 1234567890.0

        # First request - should translate and cache
        response1 = client.get("/api/recipes/test-recipe/translate")
        assert response1.status_code == 200
        assert mock_translate.call_count == 1
        assert mock_html.call_count == 1

        # Second request with same mtime - should use cache
        response2 = client.get("/api/recipes/test-recipe/translate")
        assert response2.status_code == 200
        assert response2.text == response1.text
        # Translation functions should not be called again
        assert mock_translate.call_count == 1
        assert mock_html.call_count == 1

        # Third request with newer mtime - should translate again
        mock_file.stat.return_value.st_mtime = 1234567990.0  # 100 seconds later
        response3 = client.get("/api/recipes/test-recipe/translate")
        assert response3.status_code == 200
        # Translation functions should be called again
        assert mock_translate.call_count == 2
        assert mock_html.call_count == 2

    # Verify file was read twice (first request and third request with newer mtime)
    assert mock_fs_manager.read_file.call_count == 2


def test_translate_recipe_with_md_extension(mock_fs_manager, mock_translation):
    """Test recipe translation when path already has .md extension"""
    mock_translate, mock_html = mock_translation

    # Clear cache to ensure clean test
    translation_cache.clear()

    # Setup mocks
    mock_fs_manager.read_file.return_value = "# Recipe"
    mock_translate.return_value = "# Recette"
    mock_html.return_value = "<html><body><h1>Recette</h1></body></html>"

    # Make request with .md extension
    response = client.get("/api/recipes/test-recipe.md/translate")

    # Verify response
    assert response.status_code == 200

    # Should not add another .md extension
    mock_fs_manager.read_file.assert_called_once_with("test-recipe.md")


def test_translate_recipe_file_not_found(mock_fs_manager, mock_translation):
    """Test translation with non-existent recipe file"""
    mock_fs_manager.read_file.side_effect = FileNotFoundError()

    response = client.get("/api/recipes/nonexistent/translate")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


def test_translate_recipe_translation_error(mock_fs_manager, mock_translation):
    """Test translation service error handling"""
    mock_translate, mock_html = mock_translation

    # Clear cache to ensure clean test
    translation_cache.clear()

    # Setup mocks
    mock_fs_manager.read_file.return_value = "# Recipe"
    mock_translate.side_effect = TranslationError("OpenAI API error")

    response = client.get("/api/recipes/test-recipe/translate")

    assert response.status_code == 503
    assert "Translation service temporarily unavailable" in response.json()["detail"]


def test_translate_recipe_validation_error(mock_fs_manager, mock_translation):
    """Test translation with validation error"""
    mock_translate, mock_html = mock_translation

    # Setup mocks
    mock_fs_manager.read_file.return_value = ""
    mock_translate.side_effect = ValueError("Content cannot be empty")

    response = client.get("/api/recipes/empty-recipe/translate")

    assert response.status_code == 400
    assert "Content cannot be empty" in response.json()["detail"]


def test_translate_recipe_path_with_title(mock_fs_manager, mock_translation):
    """Test recipe translation with title extraction"""
    mock_translate, mock_html = mock_translation

    # Setup mocks with content that has a title
    mock_fs_manager.read_file.return_value = "# Pasta Carbonara\n\n## Ingredients"
    mock_translate.return_value = "# Pâtes Carbonara\n\n## Ingrédients"
    mock_html.return_value = "<html><body><h1>Pâtes Carbonara</h1></body></html>"

    response = client.get("/api/recipes/pasta-carbonara/translate")

    assert response.status_code == 200

    # Verify title was extracted and used
    mock_html.assert_called_once_with(
        "# Pâtes Carbonara\n\n## Ingrédients", "Pasta Carbonara"
    )


def test_translate_recipe_path_without_title(mock_fs_manager, mock_translation):
    """Test recipe translation when content has no title"""
    mock_translate, mock_html = mock_translation

    # Setup mocks with content that has no h1 title
    mock_fs_manager.read_file.return_value = "## Ingredients\n\n- Flour"
    mock_translate.return_value = "## Ingrédients\n\n- Farine"
    mock_html.return_value = "<html><body><h2>Ingrédients</h2></body></html>"

    response = client.get("/api/recipes/some-recipe/translate")

    assert response.status_code == 200

    # Verify fallback title was used (path converted to title)
    mock_html.assert_called_once_with("## Ingrédients\n\n- Farine", "Some Recipe")


def test_translate_recipe_unexpected_error(mock_fs_manager, mock_translation):
    """Test unexpected error handling"""
    mock_translate, mock_html = mock_translation

    # Clear cache to ensure clean test
    translation_cache.clear()

    # Setup mocks
    mock_fs_manager.read_file.return_value = "# Recipe"
    mock_translate.side_effect = RuntimeError("Unexpected error")

    response = client.get("/api/recipes/test-recipe/translate")

    assert response.status_code == 500
    assert "Internal server error" in response.json()["detail"]


def test_translate_recipe_path_validation(mock_fs_manager, mock_translation):
    """Test that path validation uses existing filesystem security"""
    mock_translate, mock_html = mock_translation

    # Test with potentially dangerous path
    mock_fs_manager.read_file.side_effect = FileNotFoundError()

    response = client.get("/api/recipes/../../../etc/passwd/translate")

    # Should return 404 (handled by filesystem manager validation)
    assert response.status_code == 404


def test_translate_recipe_frontend_route(mock_fs_manager, mock_translation):
    """Test translation via frontend edit route"""
    mock_translate, mock_html = mock_translation

    # Setup mocks
    mock_fs_manager.read_file.return_value = (
        "# Test Recipe\n\n## Ingredients\n\n- Flour"
    )
    mock_translate.return_value = "# Recette de Test\n\n## Ingrédients\n\n- Farine"
    mock_html.return_value = "<html><body><h1>Recette de Test</h1></body></html>"

    # Make request to frontend route
    response = client.get("/edit/test-recipe/translate")

    # Verify response
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/html; charset=utf-8"
    assert "<h1>Recette de Test</h1>" in response.text
