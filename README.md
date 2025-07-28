# Recipe Manager v2.0

A modern, lightweight recipe management application built with FastAPI and vanilla JavaScript. It is really just a simple Markdown
editor at the moment, but I will gradually add features as I feel the need for them.

I forgot: **THIS IS A VIBE-CODED app made with Claude. I DID NOT REVIEW ALL THE CODE BUT EVERY TIME I LOOK AT SOMETHING I FIND A CRITICAL OWASP TOP 10
VULNERABILITY IN IT. DO NOT PUT THIS ON THE OPEN INTERNET. IT SHOULD RUN STRICTLY ON A CONTAINER, BE SINGLE USER (YOU) AND BE PROTECTED BEHIND AN AUTH PROXY
THAT IS PROPERLY CONFIGURED.**

## ✨ Features

- **📝 Simple Editor**: Lightweight textarea with Prism.js markdown syntax highlighting
- **🔍 Powerful Search**: Search by content or filename with real-time results
- **📁 File Organization**: Create folders and organize recipes hierarchically
- **💾 Auto-Save**: Automatic saving with debounced input and retry logic
- **📱 Mobile-Friendly**: Touch gestures, responsive design, optimized for mobile
- **🌙 Dark Mode**: Automatic dark/light theme based on system preferences

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

| Variable | Default | Description |
|----------|---------|-------------|
| `RECIPES_DIR` | `/app/recipes` | Directory to store recipe files |
| `HOST` | `0.0.0.0` | Server host binding |
| `PORT` | `8000` | Server port |

Example with custom configuration:
```bash
docker run -p 3000:3000 -e PORT=3000 -v ./my-recipes:/app/recipes recipe-manager
```


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

### Search
- `GET /api/search?q={query}` - Search recipe content
- `GET /api/search/files?q={query}` - Search filenames

### Directories
- `POST /api/directories/{path}` - Create directory
- `DELETE /api/directories/{path}` - Delete directory

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Using uv
uv run pytest tests/ -v

# Or directly
pytest tests/ -v
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
- Textarea + syntax overlay approach
- Prism.js for lightweight syntax highlighting
- Real-time highlighting without performance impact
- Scroll synchronization between textarea and overlay

### Key Design Decisions

1. **No Validation**: Complete creative freedom in recipe formatting
2. **Single Panel**: Simplified UI eliminating preview complexity  
4. **Touch-First**: Designed for mobile with gesture support
5. **Auto-Save**: Seamless experience with background persistence

## 🔧 Configuration

### File Storage
By default, recipes are stored in the `recipes/` directory. Configure with:

```bash
export RECIPES_DIR=/path/to/your/recipes
```

### Server Settings
Configure the server host and port:

```bash
export HOST=0.0.0.0
export PORT=8000
```

