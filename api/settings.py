"""Application configuration loaded from environment variables."""

import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

DEFAULT_RECIPES_DIR = "recipes"
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8000
DEFAULT_OPENROUTER_MODEL = "openai/gpt-6-luna"
DEFAULT_OPENROUTER_REASONING_EFFORT = "high"
DEFAULT_OPENROUTER_SITE_URL = "http://localhost:8000"
DEFAULT_OPENROUTER_APP_NAME = "Recipe Manager"
DEFAULT_LLM_TIMEOUT_SECONDS = 120.0


@dataclass(frozen=True, slots=True)
class Settings:
    """Runtime settings for the recipe manager."""

    recipes_dir: Path
    host: str = DEFAULT_HOST
    port: int = DEFAULT_PORT
    openrouter_api_key: str | None = None
    openrouter_model: str = DEFAULT_OPENROUTER_MODEL
    openrouter_reasoning_effort: str = DEFAULT_OPENROUTER_REASONING_EFFORT
    openrouter_site_url: str = DEFAULT_OPENROUTER_SITE_URL
    openrouter_app_name: str = DEFAULT_OPENROUTER_APP_NAME
    llm_timeout_seconds: float = DEFAULT_LLM_TIMEOUT_SECONDS

    def __post_init__(self) -> None:
        if not 1 <= self.port <= 65535:
            raise ValueError(f"PORT must be between 1 and 65535, got {self.port}")
        if self.llm_timeout_seconds <= 0:
            raise ValueError("OPENROUTER_TIMEOUT_SECONDS must be positive")

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "Settings":
        """Build settings from environment variables."""
        environ = os.environ if env is None else env

        try:
            port = int(environ.get("PORT", str(DEFAULT_PORT)))
        except ValueError as exc:
            raise ValueError("PORT must be an integer") from exc

        try:
            llm_timeout = float(
                environ.get(
                    "OPENROUTER_TIMEOUT_SECONDS", str(DEFAULT_LLM_TIMEOUT_SECONDS)
                )
            )
        except ValueError as exc:
            raise ValueError("OPENROUTER_TIMEOUT_SECONDS must be a number") from exc

        return cls(
            recipes_dir=Path(
                environ.get("RECIPES_DIR", DEFAULT_RECIPES_DIR)
            ).expanduser(),
            host=environ.get("HOST", DEFAULT_HOST),
            port=port,
            openrouter_api_key=environ.get("OPENROUTER_API_KEY") or None,
            openrouter_model=environ.get("OPENROUTER_MODEL", DEFAULT_OPENROUTER_MODEL),
            openrouter_reasoning_effort=environ.get(
                "OPENROUTER_REASONING_EFFORT", DEFAULT_OPENROUTER_REASONING_EFFORT
            ),
            openrouter_site_url=environ.get(
                "OPENROUTER_SITE_URL", DEFAULT_OPENROUTER_SITE_URL
            ),
            openrouter_app_name=environ.get(
                "OPENROUTER_APP_NAME", DEFAULT_OPENROUTER_APP_NAME
            ),
            llm_timeout_seconds=llm_timeout,
        )
