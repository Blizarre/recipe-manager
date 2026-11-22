fmt:
	npx --no-install prettier -w static/ README.md
	uv run black .

check:
	npx --no-install prettier --check static/
	uv run black --check .
	uv run ruff check
	uv run pyright
	uv run pytest

run:
	uv run uvicorn main:app --reload
