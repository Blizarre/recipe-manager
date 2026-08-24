# Recipe Manager v2.0

A modern, lightweight recipe management application built with FastAPI and vanilla JavaScript. It is really just a simple Markdown
editor at the moment with a recipe template, but I will gradually add features as I feel the need for them.

I forgot: **THIS IS A VIBE-CODED app made with Claude. I DID NOT REVIEW ALL THE CODE BUT EVERY TIME I LOOK AT SOMETHING I FIND A CRITICAL OWASP TOP 10
VULNERABILITY IN IT. DO NOT PUT THIS ON THE OPEN INTERNET. IT SHOULD RUN STRICTLY ON A CONTAINER, BE SINGLE USER (YOU) AND BE PROTECTED BEHIND AN AUTH PROXY
THAT IS PROPERLY CONFIGURED.**

## ✨ Features

- **📝 Simple Editor**: EasyMDE (CodeMirror) Markdown editor with live syntax highlighting
- **🔍 Powerful Search**: Search by content or filename with real-time results
- **📁 File Organization**: Create folders and organize recipes hierarchically
- **🖼️ Recipe Photos**: Attach a photo to each recipe
- **🇫🇷 Translate & Format**: Translate recipes to French and auto-format them (via OpenAI)
- **💾 Auto-Save**: Automatic saving with debounced input and version-conflict detection
- **📱 Mobile-Friendly**: Touch gestures, responsive design, optimized for mobile

## 🚀 Quick Start

### Using Docker Compose (Recommended)

1. Clone the repository:

```bash
git clone <your-repo-url>
cd recipes
```

2. Start with Docker Compose:

```bash
docker-compose up -d
```

3. Open your browser to `http://localhost:8000`

### Manual Installation

#### Prerequisites

- Python 3.12+
- uv package manager

#### Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd recipes
```

2. Install dependencies:

```bash
uv sync
```

3. Start the server:

```bash
uv run python main.py
```

4. Open your browser to `http://localhost:8000`

### Environment Variables

Configure the application using environment variables:

| Variable         | Default    | Description                            |
| ---------------- | ---------- | -------------------------------------- |
| `RECIPES_DIR`    | `recipes`  | Directory to store recipe files        |
| `HOST`           | `0.0.0.0`  | Server host binding (via `main.py`)    |
| `PORT`           | `8000`     | Server port (via `main.py`)            |
| `OPENAI_API_KEY` | —          | Required for translate/format features |

Example with custom configuration:

```bash
export RECIPES_DIR=/path/to/your/recipes
export PORT=3000
OPENAI_API_KEY=sk-... uv run python main.py
```

> **Note:** `HOST`/`PORT` only apply when starting the server with
> `uv run python main.py` (not when using `uvicorn` directly). In the Docker image
> they default to `0.0.0.0`/`8000`.

## 🔧 API Endpoints

### Files

- `GET /api/files` - List files and directories
- `GET /api/files/{path}` - Get file content
- `PUT /api/files/{path}` - Update file content
- `POST /api/files/{path}` - Create new file
- `DELETE /api/files/{path}` - Delete file
- `POST /api/files/{path}/move` - Rename/move file

### Recipes

- `PUT /api/recipes/{path}` - Save recipe
- `POST /api/recipes/{path}` - Create recipe with template
- `POST /api/recipes/{path}/format` - Auto-format recipe (returns reformatted markdown)
- `GET /api/recipes/{path}/translate` - Translate recipe to French (returns HTML)

### Search

- `GET /api/search?q={query}` - Search recipe content
- `GET /api/search/files?q={query}` - Search filenames

### Directories

- `POST /api/directories/{path}` - Create directory
- `DELETE /api/directories/{path}` - Delete directory

### Photos

- `GET /api/photos/{path}` - Get the photo for a recipe
- `POST /api/photos/{path}` - Upload a recipe photo (JPEG)
- `DELETE /api/photos/{path}` - Delete a recipe photo

## 🧪 Testing

Run the test suite:

```bash
uv run pytest
```

## 🏗️ Development

### Architecture Highlights

**Backend (FastAPI):**

- Async file operations for performance
- Path validation and security
- Comprehensive error handling
- RESTful API design

**Frontend (Vanilla JS):**

- No framework dependencies
- Component-based architecture
- Shared utility functions
- Mobile-first responsive design

**Editor System:**

- EasyMDE (CodeMirror) with `contenteditable` input for mobile keyboard support
- Native browser spellchecking and autocapitalize
- Optimistic concurrency via an mtime-based version with conflict detection
- The `/translate/{path}` route serves a standalone HTML version of a recipe

### Key Design Decisions

1. **No Validation**: Complete creative freedom in recipe formatting
2. **Single Panel**: Simplified UI eliminating preview complexity
3. **Touch-First**: Designed for mobile with gesture support
4. **Auto-Save**: Seamless experience with background persistence

## 🔧 Configuration

### File Storage

By default, recipes are stored in the `recipes/` directory. Configure with:

```bash
export RECIPES_DIR=/path/to/your/recipes
```

### Server Settings

Configure the server host and port (applies when running `uv run python main.py`):

```bash
export HOST=0.0.0.0
export PORT=8000
```

### OpenAI

Translation and auto-formatting require an OpenAI API key:

```bash
export OPENAI_API_KEY=sk-...
```
