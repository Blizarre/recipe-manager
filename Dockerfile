# Recipe Manager v2.0 - Production Docker Image
# Using uv base image for faster dependency resolution

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

# Set environment variables
ENV UV_COMPILE_BYTECODE=1 \
    RECIPES_DIR=/app/recipes \
    HOST=0.0.0.0 \
    PORT=8000

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install Python dependencies using uv
RUN uv sync --locked --no-install-project --no-dev

# Copy application code
COPY . .

# Create non-root user for security
RUN groupadd -r recipes && useradd -m -r -g recipes recipes

# Create recipes directory and set permissions
RUN mkdir -p /app/recipes && \
    chown -R recipes:recipes /app

# Switch to non-root user
USER recipes

# Expose port
EXPOSE 8000

ENV PATH="/app/.venv/bin:$PATH"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

# Start command
CMD ["python", "main.py"]
