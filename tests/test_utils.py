def test_utils_js_exists():
    """Test that the utils.js file exists and has expected content"""
    from pathlib import Path

    utils_file = Path(__file__).parent.parent / "static" / "utils.js"
    assert utils_file.exists(), "utils.js file should exist"

    content = utils_file.read_text()
    assert "class Utils" in content, "Utils class should be defined"
    assert "extractErrorMessage" in content, "extractErrorMessage method should exist"
    assert "escapeHtml" in content, "escapeHtml method should exist"
    assert "window.Utils = Utils" in content, "Utils should be made globally available"
