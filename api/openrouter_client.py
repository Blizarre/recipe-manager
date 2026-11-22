import logging

from openai import AsyncOpenAI

from .settings import Settings

logger = logging.getLogger(__name__)

# Shared OpenRouter client - initialized during FastAPI startup
openrouter_client: AsyncOpenAI | None = None


def initialize_openrouter_client(settings: Settings) -> None:
    """Initialize the OpenRouter client during FastAPI startup."""
    global openrouter_client

    if not settings.openrouter_api_key:
        logger.warning(
            "OPENROUTER_API_KEY is not set; translation and formatting are disabled"
        )
        openrouter_client = None
        return

    openrouter_client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.openrouter_api_key,
        default_headers={
            "HTTP-Referer": settings.openrouter_site_url,
            "X-Title": settings.openrouter_app_name,
        },
    )


async def close_openrouter_client() -> None:
    """Close the OpenRouter client during FastAPI shutdown."""
    global openrouter_client

    if openrouter_client is not None:
        await openrouter_client.close()
        openrouter_client = None
