from openai import AsyncOpenAI

# Shared OpenAI client - initialized during FastAPI startup
openai_client: AsyncOpenAI = None


def initialize_openai_client():
    """Initialize the OpenAI client - called during FastAPI lifespan event"""
    global openai_client
    openai_client = AsyncOpenAI()
