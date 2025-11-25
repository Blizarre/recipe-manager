import pytest


@pytest.fixture(autouse=True)
def mock_openai_key(monkeypatch):
    """Automatically mock OpenAI API key for all tests"""
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-fake-key-for-testing")
