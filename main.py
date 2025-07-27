from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import os
from api.routes import router as api_router

app = FastAPI(
    title="Recipe Manager API",
    description="A FastAPI backend for managing recipe files",
    version="0.1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create recipes directory if it doesn't exist
RECIPES_DIR = Path("recipes")
RECIPES_DIR.mkdir(exist_ok=True)

# Mount static files for frontend
app.mount("/static", StaticFiles(directory="static"), name="static")

# Serve frontend
@app.get("/", response_class=FileResponse)
async def serve_frontend():
    return "static/index.html"

# Include API routes
app.include_router(api_router)

@app.get("/")
async def root():
    return {"message": "Recipe Manager API", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "recipes_dir": str(RECIPES_DIR.absolute())}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)