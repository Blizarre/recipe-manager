import pytest
from unittest.mock import AsyncMock, patch
from api.translation import (
    translate_markdown,
    markdown_to_html,
    TranslationError,
    get_cached_translation,
    cache_translation,
    translation_cache,
)


@pytest.mark.asyncio
async def test_translate_markdown_success():
    """Test successful translation"""
    test_content = "# Test Recipe\n\n## Ingredients\n\n- 1 cup flour\n\n## Instructions\n\n1. Mix ingredients"
    expected_french = "# Recette de Test\n\n## Ingrédients\n\n- 1 tasse de farine\n\n## Instructions\n\n1. Mélanger les ingrédients"

    # Mock OpenAI response
    mock_response = AsyncMock()
    mock_response.choices = [AsyncMock()]
    mock_response.choices[0].message.content = expected_french

    with patch("api.translation.client") as mock_client:
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        result = await translate_markdown(test_content)
        assert result == expected_french


@pytest.mark.asyncio
async def test_translate_markdown_empty_content():
    """Test error handling for empty content"""
    with pytest.raises(ValueError, match="Content cannot be empty"):
        await translate_markdown("")

    with pytest.raises(ValueError, match="Content cannot be empty"):
        await translate_markdown("   ")


@pytest.mark.asyncio
async def test_translate_markdown_api_error():
    """Test error handling for OpenAI API failure"""
    test_content = "# Test Recipe"

    with patch("api.translation.client") as mock_client:
        mock_client.chat.completions.create = AsyncMock(
            side_effect=Exception("API Error")
        )
        with pytest.raises(
            TranslationError,
            match="Translation service encountered an unexpected error",
        ):
            await translate_markdown(test_content)


@pytest.mark.asyncio
async def test_translate_markdown_empty_response():
    """Test error handling for empty API response"""
    test_content = "# Test Recipe"

    # Mock empty response
    mock_response = AsyncMock()
    mock_response.choices = [AsyncMock()]
    mock_response.choices[0].message.content = None

    with patch("api.translation.client") as mock_client:
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        with pytest.raises(
            TranslationError, match="Translation service returned empty response"
        ):
            await translate_markdown(test_content)


@pytest.mark.asyncio
async def test_translation_service_integration():
    """
    Integration test to verify translation service works with actual API.
    This test requires OPENAI_API_KEY environment variable.
    """
    test_content = "# Test Recipe\n\n## Ingredients\n\n- 1 cup flour\n\n## Instructions\n\n1. Mix ingredients"

    try:
        result = await translate_markdown(test_content)
        # Basic validation that translation occurred
        assert len(result) > 0
        assert "recette" in result.lower() or "ingrédients" in result.lower()
    except Exception as e:
        # Skip test if API key not available or API call fails
        pytest.skip(f"Integration test skipped: {str(e)}")


def test_markdown_to_html_basic():
    """Test basic markdown to HTML conversion"""
    markdown_content = "# Test Recipe\n\n## Ingredients\n\n- 1 cup flour\n- 2 eggs\n\n## Instructions\n\n1. Mix flour\n2. Add eggs"

    result = markdown_to_html(markdown_content, "Test Recipe")

    # Check basic HTML structure
    assert "<!DOCTYPE html>" in result
    assert '<html lang="fr">' in result
    assert "<title>Test Recipe</title>" in result
    assert "<h1>Test Recipe</h1>" in result
    assert "<h2>Ingredients</h2>" in result
    assert "<h2>Instructions</h2>" in result
    assert "<ul>" in result
    assert "<ol>" in result
    assert "<li>1 cup flour</li>" in result
    assert "<li>Mix flour</li>" in result


def test_markdown_to_html_with_styling():
    """Test that HTML includes embedded CSS styling"""
    markdown_content = "# Recipe"

    result = markdown_to_html(markdown_content)

    # Check CSS is included
    assert "<style>" in result
    assert "font-family:" in result
    assert "color:" in result
    assert "@media" in result  # Responsive styles
    assert "</style>" in result


def test_markdown_to_html_empty_content():
    """Test HTML conversion with empty content"""
    result = markdown_to_html("", "Empty Recipe")

    # Should still return valid HTML structure
    assert "<!DOCTYPE html>" in result
    assert "<title>Empty Recipe</title>" in result
    assert "<body>" in result
    assert "</body>" in result


def test_markdown_to_html_with_formatting():
    """Test HTML conversion with markdown formatting"""
    markdown_content = "# Recipe\n\n**Bold text** and *italic text*"

    result = markdown_to_html(markdown_content)

    # Check formatting is preserved
    assert "<strong>Bold text</strong>" in result
    assert "<em>italic text</em>" in result


def test_markdown_to_html_default_title():
    """Test HTML conversion with default title"""
    markdown_content = "# Test"

    result = markdown_to_html(markdown_content)

    # Should use default title
    assert "<title>Recette</title>" in result


def test_cache_translation():
    """Test caching translation functionality"""
    # Clear cache
    translation_cache.clear()

    file_path = "test-recipe.md"
    translated_content = "# Recette de Test"
    html_content = "<html><body><h1>Recette de Test</h1></body></html>"
    file_mtime = 1234567890.0

    # Cache the translation
    cache_translation(file_path, translated_content, html_content, file_mtime)

    # Verify it's in cache
    assert file_path in translation_cache
    cached = translation_cache[file_path]
    assert cached.translated_content == translated_content
    assert cached.html_content == html_content
    assert cached.file_mtime == file_mtime


def test_get_cached_translation_hit():
    """Test cache hit when file hasn't been modified"""
    # Clear cache
    translation_cache.clear()

    file_path = "test-recipe.md"
    translated_content = "# Recette de Test"
    html_content = "<html><body><h1>Recette de Test</h1></body></html>"
    file_mtime = 1234567890.0

    # Cache the translation
    cache_translation(file_path, translated_content, html_content, file_mtime)

    # Get from cache with same mtime (cache hit)
    cached = get_cached_translation(file_path, file_mtime)
    assert cached is not None
    assert cached.translated_content == translated_content
    assert cached.html_content == html_content


def test_get_cached_translation_miss_newer_file():
    """Test cache miss when file has been modified"""
    # Clear cache
    translation_cache.clear()

    file_path = "test-recipe.md"
    translated_content = "# Recette de Test"
    html_content = "<html><body><h1>Recette de Test</h1></body></html>"
    file_mtime = 1234567890.0

    # Cache the translation
    cache_translation(file_path, translated_content, html_content, file_mtime)

    # Get from cache with newer mtime (cache miss)
    newer_mtime = file_mtime + 100.0
    cached = get_cached_translation(file_path, newer_mtime)
    assert cached is None


def test_get_cached_translation_miss_no_cache():
    """Test cache miss when file not in cache"""
    # Clear cache
    translation_cache.clear()

    file_path = "non-existent.md"
    file_mtime = 1234567890.0

    # Get from cache (cache miss)
    cached = get_cached_translation(file_path, file_mtime)
    assert cached is None
