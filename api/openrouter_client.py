import os

from openai import AsyncOpenAI

# Shared OpenRouter client - initialized during FastAPI startup
openrouter_client: AsyncOpenAI | None = None


def initialize_openrouter_client():
    """Initialize the OpenRouter client - called during FastAPI lifespan event"""
    global openrouter_client
    openrouter_client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        default_headers={
            "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://localhost:8000"),
            "X-Title": os.getenv("OPENROUTER_APP_NAME", "Recipe Manager"),
        },
    )
