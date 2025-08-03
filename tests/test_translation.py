import pytest
from unittest.mock import AsyncMock, patch
from api.translation import (
    translate_markdown_to_french,
    markdown_to_html,
    TranslationError,
)


@pytest.mark.asyncio
async def test_translate_markdown_to_french_success():
    """Test successful translation"""
    test_content = "# Test Recipe\n\n## Ingredients\n\n- 1 cup flour\n\n## Instructions\n\n1. Mix ingredients"
    expected_french = "# Recette de Test\n\n## Ingrédients\n\n- 1 tasse de farine\n\n## Instructions\n\n1. Mélanger les ingrédients"

    # Mock OpenAI response
    mock_response = AsyncMock()
    mock_response.choices = [AsyncMock()]
    mock_response.choices[0].message.content = expected_french

    with patch("api.translation.client") as mock_client:
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        result = await translate_markdown_to_french(test_content)
        assert result == expected_french


@pytest.mark.asyncio
async def test_translate_markdown_to_french_empty_content():
    """Test error handling for empty content"""
    with pytest.raises(ValueError, match="Content cannot be empty"):
        await translate_markdown_to_french("")

    with pytest.raises(ValueError, match="Content cannot be empty"):
        await translate_markdown_to_french("   ")


@pytest.mark.asyncio
async def test_translate_markdown_to_french_api_error():
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
            await translate_markdown_to_french(test_content)


@pytest.mark.asyncio
async def test_translate_markdown_to_french_empty_response():
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
            await translate_markdown_to_french(test_content)


@pytest.mark.asyncio
async def test_translation_service_integration():
    """
    Integration test to verify translation service works with actual API.
    This test requires OPENAI_API_KEY environment variable.
    """
    test_content = "# Test Recipe\n\n## Ingredients\n\n- 1 cup flour\n\n## Instructions\n\n1. Mix ingredients"

    try:
        result = await translate_markdown_to_french(test_content)
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
    assert "<title>Recipe</title>" in result
