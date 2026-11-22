"""FastAPI application factory."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from .filesystem import FileSystemManager
from .openrouter_client import close_openrouter_client, initialize_openrouter_client
from .routes import router as api_router
from .routes import translate_recipe
from .settings import Settings

BASE_DIR = Path(__file__).resolve().parent.parent


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build a FastAPI app with its configuration and filesystem state."""
    settings = settings or Settings.from_env()
    settings.recipes_dir.mkdir(parents=True, exist_ok=True)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        initialize_openrouter_client(settings)
        try:
            yield
        finally:
            await close_openrouter_client()

    app = FastAPI(
        title="Recipe Manager API",
        description="A FastAPI backend for managing recipe files",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.fs_manager = FileSystemManager(str(settings.recipes_dir))

    templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
    app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

    app.include_router(api_router)

    @app.get("/", response_class=HTMLResponse)
    async def serve_frontend(request: Request):
        return templates.TemplateResponse(request=request, name="index.html")

    @app.get("/translate/{path:path}", response_class=HTMLResponse)
    async def translate_recipe_frontend(request: Request, path: str):
        return await translate_recipe(
            path,
            fs_manager=request.app.state.fs_manager,
            settings=request.app.state.settings,
        )

    @app.get("/edit/{path:path}", response_class=HTMLResponse)
    async def serve_recipe_editor(request: Request, path: str):
        """Serve the unified HTML page for individual recipe URLs."""
        return templates.TemplateResponse(request=request, name="index.html")

    @app.get("/health")
    async def health_check():
        return {
            "status": "healthy",
            "recipes_dir": str(settings.recipes_dir.absolute()),
        }

    return app
