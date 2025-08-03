from openai import AsyncOpenAI, APIError, RateLimitError, APITimeoutError
import logging
import markdown
from typing import Dict, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class CachedTranslation:
    """Cached translation with file modification time"""

    translated_content: str
    html_content: str
    file_mtime: float


class TranslationError(Exception):
    """Custom exception for translation service errors"""

    pass


# OpenAI client - initialized in FastAPI lifespan event
client: AsyncOpenAI = None

# Translation cache - maps file path to cached translation
translation_cache: Dict[str, CachedTranslation] = {}

# Placeholder translation prompt - to be customized later
TRANSLATION_PROMPT = """
Translate the following markdown recipe content to French. 
Preserve the markdown formatting and structure.
Keep ingredient quantities and measurements accurate.
Return only the translated markdown content.

Content to translate:
{content}
"""


def initialize_openai_client():
    """Initialize the OpenAI client - called during FastAPI startup"""
    global client
    client = AsyncOpenAI()


def get_cached_translation(
    file_path: str, file_mtime: float
) -> Optional[CachedTranslation]:
    """Get cached translation if file hasn't been modified"""
    cached = translation_cache.get(file_path)
    if cached and cached.file_mtime >= file_mtime:
        logger.info(f"Cache hit for {file_path}")
        return cached
    return None


def cache_translation(
    file_path: str, translated_content: str, html_content: str, file_mtime: float
):
    """Cache a translation with file modification time"""
    translation_cache[file_path] = CachedTranslation(
        translated_content=translated_content,
        html_content=html_content,
        file_mtime=file_mtime,
    )
    logger.info(f"Cached translation for {file_path}")


async def translate_markdown_to_french(content: str) -> str:
    """
    Translate markdown recipe content to French using OpenAI API.

    Args:
        content: The markdown content to translate

    Returns:
        The translated markdown content in French

    Raises:
        ValueError: If content is empty
        TranslationError: If OpenAI API call fails
    """
    if not content or not content.strip():
        raise ValueError("Content cannot be empty")

    if client is None:
        raise TranslationError("OpenAI client not initialized")

    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "user", "content": TRANSLATION_PROMPT.format(content=content)}
            ],
            max_tokens=16000,
            temperature=0.3,  # Lower temperature for more consistent translations
            timeout=30.0,  # 30 second timeout
        )

        translated_content = response.choices[0].message.content

        if not translated_content:
            logger.error("OpenAI API returned empty response")
            raise TranslationError("Translation service returned empty response")

        logger.info(
            f"Successfully translated content ({len(content)} -> {len(translated_content)} characters)"
        )
        return translated_content.strip()

    except TranslationError:
        # Re-raise TranslationError as-is
        raise
    except RateLimitError as e:
        logger.error(f"OpenAI rate limit exceeded: {str(e)}")
        raise TranslationError("Translation service is currently rate limited") from e
    except APITimeoutError as e:
        logger.error(f"OpenAI API timeout: {str(e)}")
        raise TranslationError("Translation service timeout") from e
    except APIError as e:
        logger.error(f"OpenAI API error: {str(e)}")
        raise TranslationError("Translation service is currently unavailable") from e
    except Exception as e:
        logger.error(f"Unexpected translation error: {str(e)}")
        raise TranslationError(
            "Translation service encountered an unexpected error"
        ) from e


def markdown_to_html(markdown_content: str, title: str = "Recipe") -> str:
    """
    Convert markdown content to a complete HTML document with styling.

    Args:
        markdown_content: The markdown content to convert
        title: The title for the HTML document

    Returns:
        Complete HTML document string with embedded CSS
    """
    # Convert markdown to HTML body content
    html_body = markdown.markdown(markdown_content)

    # Embedded CSS for recipe formatting
    css_styles = """
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
            background-color: #fff;
        }
        
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            margin-bottom: 20px;
            font-size: 2.2em;
        }
        
        h2 {
            color: #34495e;
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 1.5em;
            border-left: 4px solid #3498db;
            padding-left: 15px;
        }
        
        h3 {
            color: #34495e;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        
        ul, ol {
            margin: 15px 0;
            padding-left: 30px;
        }
        
        li {
            margin-bottom: 8px;
            line-height: 1.5;
        }
        
        ul li {
            list-style-type: disc;
        }
        
        ol li {
            list-style-type: decimal;
            font-weight: 500;
        }
        
        p {
            margin: 15px 0;
            text-align: justify;
        }
        
        strong {
            color: #2c3e50;
        }
        
        em {
            color: #7f8c8d;
        }
        
        @media (max-width: 600px) {
            body {
                padding: 15px;
                font-size: 14px;
            }
            
            h1 {
                font-size: 1.8em;
            }
            
            h2 {
                font-size: 1.3em;
            }
        }
    </style>
    """

    # Complete HTML document
    html_document = f"""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    {css_styles}
</head>
<body>
    {html_body}
</body>
</html>"""

    return html_document
