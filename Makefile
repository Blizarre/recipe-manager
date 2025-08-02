fmt:
	prettier -w static/ README.md
	uv tool run black .

check:
	prettier --check static/
	uv tool run black --check .
	uv tool run ruff check
	uv run pytest

run:
	uv run uvicorn main:app --reload
