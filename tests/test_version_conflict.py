#!/usr/bin/env python3
"""
Test script to verify version conflict detection works properly.
This creates a test recipe, simulates concurrent modifications, and tests conflict detection.
"""

import asyncio
import os
import tempfile
import json
from pathlib import Path
from api.filesystem import FileSystemManager
from api.routes import router
from fastapi.testclient import TestClient
from fastapi import FastAPI


async def test_version_conflict():
    """Test version conflict detection end-to-end"""

    # Create a temporary directory for testing
    with tempfile.TemporaryDirectory() as temp_dir:
        print(f"Testing in directory: {temp_dir}")

        # Initialize filesystem manager with test directory
        fs_manager = FileSystemManager(temp_dir)

        # Create a test recipe
        test_path = "test_recipe.md"
        initial_content = "# Test Recipe\n\n## Ingredients\n- Test ingredient"

        # Write initial content
        result1 = await fs_manager.write_file(test_path, initial_content)
        print(f"Created initial file with version: {result1['version']}")

        # Read the file with version info
        file_data = await fs_manager.read_file_with_version(test_path)
        print(f"Read file with version: {file_data['version']}")

        # Simulate first user modifying the file
        modified_content1 = initial_content + "\n- Another ingredient"
        result2 = await fs_manager.write_file(
            test_path, modified_content1, file_data["version"]
        )
        print(f"First modification successful, new version: {result2['version']}")

        # Simulate second user trying to modify with old version (should conflict)
        modified_content2 = initial_content + "\n- Different ingredient"

        try:
            await fs_manager.write_file(
                test_path, modified_content2, file_data["version"]
            )
            print("ERROR: Version conflict not detected!")
            return False
        except Exception as e:
            if "version_conflict" in str(e):
                print("SUCCESS: Version conflict detected correctly!")
                print(f"Conflict details: {e}")
                return True
            else:
                print(f"ERROR: Unexpected error: {e}")
                return False


def test_api_endpoints():
    """Test the API endpoints with version conflicts"""
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    with tempfile.TemporaryDirectory() as temp_dir:
        # Set the recipes directory
        os.environ["RECIPES_DIR"] = temp_dir

        # Create a test file
        response = client.post(
            "/api/files/test.md", json={"content": "# Test\nInitial content"}
        )
        assert response.status_code == 200

        # Get the file with version
        response = client.get("/api/files/test.md")
        assert response.status_code == 200
        file_data = response.json()
        print(f"API: File loaded with version {file_data['version']}")

        # First update (should succeed)
        response = client.put(
            "/api/files/test.md",
            json={"content": "# Test\nFirst update", "version": file_data["version"]},
        )
        assert response.status_code == 200
        new_version = response.json()["version"]
        print(f"API: First update successful, new version: {new_version}")

        # Second update with old version (should conflict)
        response = client.put(
            "/api/files/test.md",
            json={
                "content": "# Test\nSecond update",
                "version": file_data["version"],  # Using old version
            },
        )

        if response.status_code == 409:
            error_detail = response.json()["detail"]
            print("API: Version conflict detected correctly!")
            print(f"API: Conflict details: {error_detail}")
            return True
        else:
            print(f"API ERROR: Expected 409, got {response.status_code}")
            return False


if __name__ == "__main__":
    print("Testing version conflict detection system...")
    print("\n1. Testing filesystem layer:")
    success1 = asyncio.run(test_version_conflict())

    print("\n2. Testing API layer:")
    success2 = test_api_endpoints()

    if success1 and success2:
        print("\n✅ All tests passed! Version conflict detection is working correctly.")
    else:
        print("\n❌ Some tests failed. Please check the implementation.")
