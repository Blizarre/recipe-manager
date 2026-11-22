"""Shared OpenRouter chat-completion helper."""

import logging
import time

from openai import APIError, APITimeoutError, RateLimitError

from . import openrouter_client as _openrouter_module
from .settings import (
    DEFAULT_LLM_TIMEOUT_SECONDS,
    DEFAULT_OPENROUTER_MODEL,
    DEFAULT_OPENROUTER_REASONING_EFFORT,
)

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Raised when a request to the language model fails."""


async def chat_completion(
    prompt: str,
    *,
    model: str | None = None,
    reasoning_effort: str | None = None,
    timeout_seconds: float | None = None,
) -> str:
    """Send a prompt to the LLM and return the stripped response text.

    Raises:
        LLMError: If the client isn't initialized or the request fails.
    """
    if _openrouter_module.openrouter_client is None:
        raise LLMError("LLM client not initialized")

    model = model or DEFAULT_OPENROUTER_MODEL
    reasoning_effort = reasoning_effort or DEFAULT_OPENROUTER_REASONING_EFFORT
    timeout_seconds = timeout_seconds or DEFAULT_LLM_TIMEOUT_SECONDS

    try:
        logger.info(f"Starting LLM request ({len(prompt)} chars)")
        start = time.time()
        response = await _openrouter_module.openrouter_client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            timeout=timeout_seconds,
            extra_body={"reasoning": {"effort": reasoning_effort}},
        )
        logger.info(f"LLM request completed in {time.time() - start:.1f}s")

        content = response.choices[0].message.content

        # The model sometimes wraps output in a markdown code fence despite
        # being told not to.
        if content and content.startswith("```markdown"):
            content = content.removeprefix("```markdown").removesuffix("```")

        if not content:
            raise LLMError("LLM service returned empty response")

        return content.strip()

    except LLMError:
        raise
    except RateLimitError as e:
        logger.error(f"LLM rate limit exceeded: {e!s}")
        raise LLMError("LLM service is currently rate limited") from e
    except APITimeoutError as e:
        logger.error(f"LLM API timeout: {e!s}")
        raise LLMError("LLM service timeout") from e
    except APIError as e:
        logger.error(f"LLM API error: {e!s}")
        raise LLMError("LLM service is currently unavailable") from e
    except Exception as e:
        logger.error(f"Unexpected LLM error: {e!s}")
        raise LLMError("LLM service encountered an unexpected error") from e
