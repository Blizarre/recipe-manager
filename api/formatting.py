from openai import APIError, RateLimitError, APITimeoutError
import logging
from . import openai_client as _openai_module

logger = logging.getLogger(__name__)


class FormattingError(Exception):
    """Custom exception for formatting service errors"""

    pass


FORMATTING_PROMPT = """
Reformat the following recipe text into a standard markdown recipe structure.

Output exactly this structure:
# Title

## Ingredients

- ingredient 1
- ingredient 2

## Instructions

1. Step one
2. Step two

## Notes

Any notes here (leave this section empty if there are no notes)

Rules:
- Preserve all measurements and quantities exactly as written
- Write instructions as linear, numbered steps
- Do not invent or remove any information
- Return only the raw markdown content, no code fences or extra commentary

Recipe text to reformat:
{content}
"""


async def format_recipe_markdown(content: str) -> str:
    """
    Reformat unstructured recipe content into standard markdown using OpenAI API.

    Args:
        content: The recipe text to reformat

    Returns:
        The reformatted markdown content

    Raises:
        ValueError: If content is empty
        FormattingError: If OpenAI API call fails
    """
    if not content or not content.strip():
        raise ValueError("Content cannot be empty")

    if _openai_module.openai_client is None:
        raise FormattingError("OpenAI client not initialized")

    try:
        import time

        logger.info(f"Starting OpenAI formatting request ({len(content)} chars)")
        start = time.time()
        response = await _openai_module.openai_client.chat.completions.create(
            model="gpt-5-mini",
            messages=[
                {"role": "user", "content": FORMATTING_PROMPT.format(content=content)}
            ],
            timeout=120.0,
        )
        duration = time.time() - start
        logger.info(f"OpenAI formatting completed in {duration:.1f}s")

        formatted_content = response.choices[0].message.content

        if formatted_content and formatted_content.startswith("```markdown"):
            formatted_content = formatted_content.removeprefix("```markdown")
            formatted_content = formatted_content.removesuffix("```")

        if not formatted_content:
            logger.error("OpenAI API returned empty response")
            raise FormattingError("Formatting service returned empty response")

        logger.info(
            f"Successfully formatted content ({len(content)} -> {len(formatted_content)} characters)"
        )
        return formatted_content.strip()

    except FormattingError:
        raise
    except RateLimitError as e:
        logger.error(f"OpenAI rate limit exceeded: {str(e)}")
        raise FormattingError("Formatting service is currently rate limited") from e
    except APITimeoutError as e:
        logger.error(f"OpenAI API timeout: {str(e)}")
        raise FormattingError("Formatting service timeout") from e
    except APIError as e:
        logger.error(f"OpenAI API error: {str(e)}")
        raise FormattingError("Formatting service is currently unavailable") from e
    except Exception as e:
        logger.error(f"Unexpected formatting error: {str(e)}")
        raise FormattingError(
            "Formatting service encountered an unexpected error"
        ) from e
