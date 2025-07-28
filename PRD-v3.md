# Recipe Manager v3.0 - Product Requirements Document

## Executive Summary

Recipe Manager v3.0 adds shareable URLs to individual recipes with minimal code changes. The core goal is simple: transform `/` + client-side navigation to `/edit/{path}` URLs that can be copied and shared directly.

## Problem Statement

The current SPA architecture works well but has one critical limitation:
- **URLs are not shareable** - no direct links to specific recipes
- Users cannot bookmark or share specific recipes
- All recipes are accessed through the main page only

## Vision

Add shareable recipe URLs while keeping everything else the same:
- Each recipe gets its own URL: `/edit/desserts/chocolate-cake.md`
- URLs can be copied and shared directly
- Keep current file tree, search, and editor functionality
- Minimal development effort

## Key Principles

1. **Minimal Changes**: Reuse existing API endpoints and UI components
2. **Shareable URLs**: Every recipe accessible via clean, direct URLs  
3. **Keep What Works**: Maintain current file tree, search, and editor experience
4. **Single User Focus**: Modern browser, no backward compatibility needed

## Target Architecture

### URL Structure
```
/                           # Current home page (unchanged)
/edit/{path}               # NEW: Individual recipe editor page
/api/files/{path}          # Existing API endpoints (unchanged)
/api/search                # Existing search API (unchanged)
```

### Implementation Approach
- **Keep existing SPA** for home page with file tree and search
- **Add new route** `/edit/{path}` for direct recipe access
- **Reuse existing APIs** for loading and saving recipes
- **Single HTML template** for editor page

## Core Features

### 1. Shareable Recipe URLs
- **Requirement**: Each recipe accessible via `/edit/{path}` URL
- **Behavior**: 
  - URL loads recipe content directly in CodeMirror editor
  - Same editor experience as current v2
  - URL can be copied and shared
  - Browser back/forward/bookmark work correctly

### 2. Minimal Editor Page
- **Requirement**: Simple standalone editor page for individual recipes
- **Behavior**:
  - Static HTML page with CodeMirror editor
  - JavaScript loads recipe content via existing `/api/files/{path}`
  - JavaScript saves via existing `/api/files/{path}` (PUT request)
  - Same features as current editor: syntax highlighting, auto-save, line wrap

### 3. Navigation Integration
- **Requirement**: Easy navigation between home page and recipe URLs
- **Behavior**:
  - Home page file tree links to `/edit/{path}` URLs
  - Editor pages have "Back to recipes" link to `/`
  - Optional: "Share" button to copy current URL

## Technical Implementation

### Backend Changes (Minimal)
```python
@app.get("/edit/{path:path}")
async def edit_recipe(path: str):
    """Serve static editor HTML page"""
    return FileResponse("static/editor.html")

# All existing API endpoints remain unchanged:
# GET /api/files/{path} - load recipe content  
# PUT /api/files/{path} - save recipe content
# GET /api/files - list files
# GET /api/search - search recipes
```

### Frontend Changes
1. **New editor.html**: Standalone page with CodeMirror editor
2. **Update file tree**: Change links from JavaScript handlers to `/edit/{path}` URLs
3. **Editor JavaScript**: Extract URL path parameter and load/save accordingly

### File Structure
```
static/
├── editor.html          # NEW: Standalone editor page
├── editor.js            # NEW: Editor page JavaScript  
├── index.html           # EXISTING: Home page (minor updates)
├── app.js               # EXISTING: Home page logic (minor updates)
├── styles.css           # EXISTING: Shared styles
└── codemirror-editor.js # EXISTING: Editor component (reuse)
```

## User Experience Flow

### Accessing a Recipe via URL
1. User receives URL: `https://recipes.example.com/edit/desserts/chocolate-cake.md`
2. Server serves static `editor.html` page
3. JavaScript extracts path from URL: `desserts/chocolate-cake.md`
4. JavaScript loads content via `GET /api/files/desserts/chocolate-cake.md`
5. CodeMirror editor displays content ready for editing

### Editing and Saving
1. User edits content in CodeMirror editor (same as current v2)
2. Auto-save triggers `PUT /api/files/{path}` (existing API)
3. Visual feedback shows save status
4. URL remains the same, content is shareable

### Navigation
1. User visits home page `/` to browse recipes (unchanged)
2. Clicks recipe link → navigates to `/edit/{path}` 
3. Uses "Back to recipes" button to return to `/`
4. Can copy URL from browser address bar to share

## Success Metrics

- **URL Shareability**: 100% of recipes accessible via direct URLs
- **Development Speed**: Implementation completed in 1-2 days
- **Code Reuse**: >90% of existing code remains unchanged
- **User Experience**: Identical editing experience to current v2

## Implementation Tasks

1. **Create `/edit/{path}` route** (5 minutes)
2. **Create editor.html template** (30 minutes) 
3. **Create editor.js for URL handling** (1 hour)
4. **Update file tree links** (30 minutes)
5. **Add "Back to recipes" navigation** (15 minutes)
6. **Testing and polish** (2 hours)

**Total Estimated Time: 4-5 hours**

## Out of Scope (v3.0)

- Server-side rendering
- Template engines (Jinja2)
- Complex routing
- Breadcrumb navigation
- Search results pages
- Folder listing pages
- Migration strategies
- Progressive enhancement
- SEO optimization

---

This ultra-simplified approach achieves the core goal (shareable recipe URLs) with minimal development effort while preserving all existing functionality.