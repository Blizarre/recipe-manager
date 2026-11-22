from pathlib import Path

import pytest

from api.settings import Settings


def test_settings_from_env():
    settings = Settings.from_env(
        {
            "RECIPES_DIR": "/tmp/recipes",
            "HOST": "127.0.0.1",
            "PORT": "9000",
            "OPENROUTER_API_KEY": "sk-test",
            "OPENROUTER_MODEL": "test/model",
            "OPENROUTER_REASONING_EFFORT": "low",
            "OPENROUTER_SITE_URL": "https://example.com",
            "OPENROUTER_APP_NAME": "Test App",
            "OPENROUTER_TIMEOUT_SECONDS": "30",
        }
    )

    assert settings.recipes_dir == Path("/tmp/recipes")
    assert settings.host == "127.0.0.1"
    assert settings.port == 9000
    assert settings.openrouter_api_key == "sk-test"
    assert settings.openrouter_model == "test/model"
    assert settings.openrouter_reasoning_effort == "low"
    assert settings.openrouter_site_url == "https://example.com"
    assert settings.openrouter_app_name == "Test App"
    assert settings.llm_timeout_seconds == 30.0


def test_settings_defaults():
    settings = Settings.from_env({})

    assert settings.recipes_dir == Path("recipes")
    assert settings.host == "0.0.0.0"
    assert settings.port == 8000
    assert settings.openrouter_api_key is None


def test_settings_rejects_invalid_port():
    with pytest.raises(ValueError, match="PORT must be an integer"):
        Settings.from_env({"PORT": "not-a-number"})

    with pytest.raises(ValueError, match="PORT must be between 1 and 65535"):
        Settings.from_env({"PORT": "70000"})


def test_settings_rejects_invalid_timeout():
    with pytest.raises(ValueError, match="OPENROUTER_TIMEOUT_SECONDS must be a number"):
        Settings.from_env({"OPENROUTER_TIMEOUT_SECONDS": "soon"})

    with pytest.raises(ValueError, match="OPENROUTER_TIMEOUT_SECONDS must be positive"):
        Settings.from_env({"OPENROUTER_TIMEOUT_SECONDS": "0"})
