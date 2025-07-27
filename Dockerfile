# Recipe Manager v2.0 - Production Docker Image
# Using uv base image for faster dependency resolution

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    RECIPES_DIR=/app/recipes \
    HOST=0.0.0.0 \
    PORT=8000

# Create non-root user for security
RUN groupadd -r recipes && useradd -r -g recipes recipes

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install Python dependencies using uv
RUN uv sync --frozen

# Copy application code
COPY . .

# Create recipes directory and set permissions
RUN mkdir -p /app/recipes && \
    chown -R recipes:recipes /app

# Switch to non-root user
USER recipes

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD uv run python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

# Start command
CMD ["uv", "run", "python", "main.py"]