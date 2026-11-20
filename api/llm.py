"""Shared OpenRouter chat-completion helper."""

import logging
import os
import time

from openai import APIError, APITimeoutError, RateLimitError

from . import openrouter_client as _openrouter_module

logger = logging.getLogger(__name__)

MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-6-luna")
REASONING_EFFORT = os.getenv("OPENROUTER_REASONING_EFFORT", "high")
TIMEOUT_SECONDS = 120.0


class LLMError(Exception):
    """Raised when a request to the language model fails."""


async def chat_completion(prompt: str) -> str:
    """Send a prompt to the LLM and return the stripped response text.

    Raises:
        LLMError: If the client isn't initialized or the request fails.
    """
    if _openrouter_module.openrouter_client is None:
        raise LLMError("LLM client not initialized")

    try:
        logger.info(f"Starting LLM request ({len(prompt)} chars)")
        start = time.time()
        response = await _openrouter_module.openrouter_client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            timeout=TIMEOUT_SECONDS,
            extra_body={"reasoning": {"effort": REASONING_EFFORT}},
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
