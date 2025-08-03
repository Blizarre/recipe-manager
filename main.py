from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from contextlib import asynccontextmanager
from pathlib import Path
from api.routes import router as api_router
from api.routes import translate_recipe
from api.translation import initialize_openai_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    initialize_openai_client()
    yield
    # Shutdown (nothing to cleanup currently)


app = FastAPI(
    title="Recipe Manager API",
    description="A FastAPI backend for managing recipe files",
    version="0.1.0",
    lifespan=lifespan,
)

# Create recipes directory if it doesn't exist
RECIPES_DIR = Path("recipes")
RECIPES_DIR.mkdir(exist_ok=True)

# Mount static files for frontend
app.mount("/static", StaticFiles(directory="static"), name="static")


# Include API routes
app.include_router(api_router)


@app.get("/api")
async def root():
    return {"message": "Recipe Manager API", "status": "running"}


# Serve frontend
@app.get("/", response_class=FileResponse)
async def serve_frontend():
    return "static/index.html"


# Translation endpoint for frontend routes
@app.get("/translate/{path:path}", response_class=HTMLResponse)
async def translate_recipe_frontend(path: str):
    return await translate_recipe(path)


# Serve individual recipe editor pages (now unified with main page)
@app.get("/edit/{path:path}", response_class=FileResponse)
async def serve_recipe_editor(path: str):
    """Serve unified HTML page for individual recipe URLs"""
    return "static/index.html"


@app.get("/health")
async def health_check():
    return {"status": "healthy", "recipes_dir": str(RECIPES_DIR.absolute())}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
