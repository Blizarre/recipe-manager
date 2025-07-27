# Recipe Manager v2.0

A modern, lightweight recipe management application built with FastAPI and vanilla JavaScript. Simplified architecture with no validation complexity, featuring a clean single-panel editor with syntax highlighting.

## ✨ Features

- **📝 Simple Editor**: Lightweight textarea with Prism.js markdown syntax highlighting
- **🔍 Powerful Search**: Search by content or filename with real-time results
- **📁 File Organization**: Create folders and organize recipes hierarchically
- **💾 Auto-Save**: Automatic saving with debounced input and retry logic
- **📱 Mobile-Friendly**: Touch gestures, responsive design, optimized for mobile
- **⚡ High Performance**: 97% bundle size reduction (250KB → 18KB)
- **🚫 No Validation**: Write recipes in any format - complete creative freedom
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

## 🐳 Docker Configuration

### Dockerfile
The application uses the official uv Docker image for optimal performance:

- **uv base image**: Fast dependency resolution with `ghcr.io/astral-sh/uv:python3.12-bookworm-slim`
- **Security**: Runs as non-root user
- **Performance**: Optimized dependency installation with uv sync

### Docker Compose
The `docker-compose.yml` provides:
- **Volume mounting**: Persist recipes between container restarts
- **Port mapping**: Access on localhost:8000
- **Environment**: Production-ready configuration
- **Auto-restart**: Container restarts automatically

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

## 📁 Project Structure

```
recipes/
├── api/                    # FastAPI backend
│   ├── __init__.py
│   ├── filesystem.py       # File system operations
│   └── routes.py          # API endpoints
├── static/                # Frontend assets
│   ├── index.html         # Main application
│   ├── styles.css         # Styling
│   ├── utils.js          # Shared utilities
│   ├── api.js            # API client
│   ├── app.js            # Main application logic
│   ├── simple-editor.js  # Editor component
│   ├── file-tree.js      # File browser
│   ├── search.js         # Search functionality
│   └── touch-gestures.js # Mobile touch support
├── tests/                 # Test suite
├── recipes/              # Recipe storage (created automatically)
├── main.py              # Application entry point
├── Dockerfile           # Docker configuration
├── docker-compose.yml   # Docker Compose setup
└── README.md           # This file
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

**Test Coverage:**
- ✅ 19 tests covering all API endpoints
- ✅ File operations (CRUD)
- ✅ Recipe creation and management
- ✅ Search functionality
- ✅ Directory operations
- ✅ Security validation
- ✅ Utility function testing

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
3. **Lightweight**: 97% bundle size reduction from CodeMirror migration
4. **Touch-First**: Designed for mobile with gesture support
5. **Auto-Save**: Seamless experience with background persistence

### Performance Optimizations

- **Bundle Size**: 18KB total (vs 250KB with CodeMirror)
- **Load Time**: <100ms editor initialization
- **Save Speed**: <50ms save operations
- **Search**: Real-time with debounced input
- **Caching**: Browser-friendly static asset caching

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

### Docker Volume Mounting
Persist recipes outside the container:

```bash
docker run -v /host/recipes:/app/recipes recipe-manager
```

## 🐛 Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Change port
docker-compose up -e PORT=8080
```

**Permission issues with volumes:**
```bash
# Fix permissions
sudo chown -R 1000:1000 ./recipes
```

**Container won't start:**
```bash
# Check logs
docker-compose logs -f
```

### Development Tips

**Enable debug mode:**
```bash
# Add to environment
DEBUG=true
```

**Reset database:**
```bash
# Remove all recipes (be careful!)
rm -rf ./recipes/*
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `uv run pytest tests/ -v`
5. Commit changes: `git commit -m "Add feature"`
6. Push to branch: `git push origin feature-name`
7. Submit a pull request

### Code Style
- Use consistent formatting
- Add tests for new features
- Update documentation
- Follow existing patterns

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **FastAPI** - High-performance async web framework
- **Prism.js** - Lightweight syntax highlighting
- **Claude Code** - AI-assisted development
- **uvicorn** - Lightning-fast ASGI server

---

**Recipe Manager v2.0** - Simple, fast, and powerful recipe management for everyone! 🍳✨