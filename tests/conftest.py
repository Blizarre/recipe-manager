import pytest


@pytest.fixture(autouse=True)
def mock_openrouter_key(monkeypatch):
    """Automatically mock OpenRouter API key for all tests"""
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test-fake-key-for-testing")
