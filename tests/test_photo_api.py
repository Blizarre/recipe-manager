import pytest
from fastapi.testclient import TestClient
from io import BytesIO
import tempfile
import shutil
from pathlib import Path
from main import app
from api.filesystem import FileSystemManager


@pytest.fixture
def temp_recipes_dir():
    """Create a temporary recipes directory for testing"""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture
def client_with_temp_dir(temp_recipes_dir, monkeypatch):
    """Create test client with temporary recipes directory"""
    # Override the FileSystemManager to use temp directory
    monkeypatch.setenv("RECIPES_DIR", temp_recipes_dir)

    with TestClient(app) as client:
        yield client


def create_fake_jpeg_content() -> bytes:
    """Create fake JPEG content for testing"""
    # Minimal JPEG header to pass basic validation
    return b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"fake jpeg content" * 100


def create_fake_png_content() -> bytes:
    """Create fake PNG content for testing"""
    return b"\x89PNG\r\n\x1a\n" + b"fake png content" * 100


class TestPhotoEndpoints:
    """Test photo API endpoints"""

    def test_get_photo_not_found(self, client_with_temp_dir):
        """Test getting photo that doesn't exist returns 404"""
        response = client_with_temp_dir.get("/api/photos/nonexistent-recipe.md")
        assert response.status_code == 404
        assert "Photo not found" in response.json()["detail"]

    def test_upload_and_get_photo(self, client_with_temp_dir):
        """Test uploading and retrieving a photo"""
        # Create a recipe first
        client_with_temp_dir.post(
            "/api/recipes/test-recipe.md",
            json={"content": "# Test Recipe\n\n## Ingredients\n\n- Test ingredient"},
        )

        # Upload photo
        fake_jpeg = create_fake_jpeg_content()
        files = {"file": ("test.jpg", BytesIO(fake_jpeg), "image/jpeg")}

        response = client_with_temp_dir.post("/api/photos/test-recipe.md", files=files)
        assert response.status_code == 200
        assert "Photo uploaded successfully" in response.json()["message"]
        assert response.json()["recipe_path"] == "test-recipe.md"

        # Get photo back
        response = client_with_temp_dir.get("/api/photos/test-recipe.md")
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/jpeg"
        assert response.content == fake_jpeg

    def test_upload_photo_without_md_extension(self, client_with_temp_dir):
        """Test uploading photo to path without .md extension"""
        fake_jpeg = create_fake_jpeg_content()
        files = {"file": ("test.jpg", BytesIO(fake_jpeg), "image/jpeg")}

        response = client_with_temp_dir.post("/api/photos/test-recipe", files=files)
        assert response.status_code == 200
        assert response.json()["recipe_path"] == "test-recipe.md"

    def test_upload_invalid_file_extension(self, client_with_temp_dir):
        """Test uploading non-JPEG file fails"""
        fake_png = create_fake_png_content()
        files = {"file": ("test.png", BytesIO(fake_png), "image/png")}

        response = client_with_temp_dir.post("/api/photos/test-recipe.md", files=files)
        assert response.status_code == 400
        assert "Only JPEG files are allowed" in response.json()["detail"]

    def test_upload_invalid_mime_type(self, client_with_temp_dir):
        """Test uploading file with wrong MIME type fails"""
        fake_content = b"not an image"
        files = {"file": ("test.jpg", BytesIO(fake_content), "text/plain")}

        response = client_with_temp_dir.post("/api/photos/test-recipe.md", files=files)
        assert response.status_code == 400
        assert "File must be a JPEG image" in response.json()["detail"]

    def test_upload_empty_file(self, client_with_temp_dir):
        """Test uploading empty file fails"""
        files = {"file": ("test.jpg", BytesIO(b""), "image/jpeg")}

        response = client_with_temp_dir.post("/api/photos/test-recipe.md", files=files)
        assert response.status_code == 400
        assert "Uploaded file is empty" in response.json()["detail"]

    def test_upload_large_file(self, client_with_temp_dir):
        """Test uploading file larger than 10MB fails"""
        # Create a 11MB fake JPEG
        large_content = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"x" * (11 * 1024 * 1024)

        files = {"file": ("large.jpg", BytesIO(large_content), "image/jpeg")}

        response = client_with_temp_dir.post("/api/photos/test-recipe.md", files=files)
        assert response.status_code == 400
        assert "File size must be less than 10MB" in response.json()["detail"]

    def test_delete_photo(self, client_with_temp_dir):
        """Test deleting a photo"""
        # Upload photo first
        fake_jpeg = create_fake_jpeg_content()
        files = {"file": ("test.jpg", BytesIO(fake_jpeg), "image/jpeg")}

        upload_response = client_with_temp_dir.post(
            "/api/photos/test-recipe.md", files=files
        )
        assert upload_response.status_code == 200

        # Verify photo exists
        get_response = client_with_temp_dir.get("/api/photos/test-recipe.md")
        assert get_response.status_code == 200

        # Delete photo
        delete_response = client_with_temp_dir.delete("/api/photos/test-recipe.md")
        assert delete_response.status_code == 200
        assert "Photo deleted successfully" in delete_response.json()["message"]

        # Verify photo is gone
        get_response = client_with_temp_dir.get("/api/photos/test-recipe.md")
        assert get_response.status_code == 404

    def test_delete_nonexistent_photo(self, client_with_temp_dir):
        """Test deleting photo that doesn't exist returns 404"""
        response = client_with_temp_dir.delete("/api/photos/nonexistent.md")
        assert response.status_code == 404
        assert "Photo not found" in response.json()["detail"]

    def test_delete_photo_without_md_extension(self, client_with_temp_dir):
        """Test deleting photo using path without .md extension"""
        # Upload photo first
        fake_jpeg = create_fake_jpeg_content()
        files = {"file": ("test.jpg", BytesIO(fake_jpeg), "image/jpeg")}

        client_with_temp_dir.post("/api/photos/test-recipe", files=files)

        # Delete using path without .md
        response = client_with_temp_dir.delete("/api/photos/test-recipe")
        assert response.status_code == 200
        assert response.json()["recipe_path"] == "test-recipe.md"

    def test_photo_cache_headers(self, client_with_temp_dir):
        """Test that photo responses include appropriate cache headers"""
        # Upload photo
        fake_jpeg = create_fake_jpeg_content()
        files = {"file": ("test.jpg", BytesIO(fake_jpeg), "image/jpeg")}

        client_with_temp_dir.post("/api/photos/test-recipe.md", files=files)

        # Get photo and check headers
        response = client_with_temp_dir.get("/api/photos/test-recipe.md")
        assert response.status_code == 200
        assert "Cache-Control" in response.headers
        assert "public, max-age=3600" in response.headers["Cache-Control"]
        assert "Content-Disposition" in response.headers
        assert "test-recipe.jpeg" in response.headers["Content-Disposition"]

    def test_upload_replace_existing_photo(self, client_with_temp_dir):
        """Test uploading a new photo replaces existing one"""
        # Upload first photo
        fake_jpeg1 = create_fake_jpeg_content()
        files1 = {"file": ("test1.jpg", BytesIO(fake_jpeg1), "image/jpeg")}

        response1 = client_with_temp_dir.post(
            "/api/photos/test-recipe.md", files=files1
        )
        assert response1.status_code == 200

        # Upload second photo (should replace first)
        fake_jpeg2 = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"different content" * 100
        files2 = {"file": ("test2.jpg", BytesIO(fake_jpeg2), "image/jpeg")}

        response2 = client_with_temp_dir.post(
            "/api/photos/test-recipe.md", files=files2
        )
        assert response2.status_code == 200

        # Get photo and verify it's the second one
        get_response = client_with_temp_dir.get("/api/photos/test-recipe.md")
        assert get_response.status_code == 200
        assert get_response.content == fake_jpeg2
