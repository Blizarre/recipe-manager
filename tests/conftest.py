import pytest
from fastapi.testclient import TestClient

from api.app import create_app
from api.settings import Settings


@pytest.fixture(autouse=True)
def mock_openrouter_key(monkeypatch):
    """Automatically mock OpenRouter API key for all tests"""
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test-fake-key-for-testing")


@pytest.fixture
def app(tmp_path):
    """Create an app instance backed by a temporary recipes directory."""
    return create_app(Settings(recipes_dir=tmp_path))


@pytest.fixture
def client(app):
    """Test client bound to the per-test app instance."""
    with TestClient(app) as test_client:
        yield test_client
