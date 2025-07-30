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


def test_html_includes_utils():
    """Test that index.html includes the utils.js script"""
    from pathlib import Path

    html_file = Path(__file__).parent.parent / "static" / "index.html"
    content = html_file.read_text()

    assert 'src="/static/utils.js"' in content, "index.html should include utils.js"

    # Check that utils.js is loaded before other scripts that depend on it
    lines = content.split("\n")
    utils_line = None
    api_line = None

    for i, line in enumerate(lines):
        if 'src="/static/utils.js"' in line:
            utils_line = i
        elif 'src="/static/api.js"' in line:
            api_line = i

    assert utils_line is not None, "utils.js script tag should be found"
    assert api_line is not None, "api.js script tag should be found"
    assert utils_line < api_line, "utils.js should be loaded before api.js"
