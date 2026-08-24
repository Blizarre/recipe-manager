# Code Cleanup Findings

Audit of the recipe-manager codebase looking for dead code, over-complicated logic,
documentation drift, and low-hanging simplifications. Ordered by file, with concrete
`file:line` references and KISS-oriented recommendations.

---

## Summary

The app is small and mostly readable, but it has accumulated several layers of
unnecessary abstraction (multiple `show*`/toast wrappers, duplicated OpenAI calls,
duplicated modal/checkbox logic) and some genuinely dead code. There are also a few
real bugs hiding in the "clever" bits (healthcheck, path validation, cache invalidation)
and the docs are out of sync with the code.

Suggested order of attack: (1) fix the bugs, (2) delete dead code, (3) collapse
duplication, (4) refresh docs.

---

## Backend

### `main.py`

- **Dead / redundant recipe-dir setup** (`main.py:36-37`)
  `RECIPES_DIR = Path("recipes")` is hardcoded and duplicates the directory creation
  that `FileSystemManager.__init__` already does (`api/filesystem.py:15-17`). It also
  ignores the `RECIPES_DIR` env var that `FileSystemManager` honors, so the two paths
  can disagree.
  - `/health` (`main.py:68-70`) reports this hardcoded path, not the directory the app
    actually reads/writes. Fix: derive the value from `fs_manager.base_dir` or delete the
    local constant entirely.

- **Over-complicated static cache-busting** (`main.py:39-43`)
  ```python
  static_dir = f"/static_dir/{randint(1440, 1989)}"
  app.mount(static_dir, StaticFiles(...))
  ```
  A random URL per restart defeats browser caching and provides no real benefit (the
  intent was cache-busting, but there are no long-lived cache headers on static files).
  The `randint(1440, 1989)` range is unexplained. KISS: mount at a fixed path
  (`/static`) and control caching with `Cache-Control` headers.

- **Unused parameter** (`main.py:62-65`)
  `serve_recipe_editor(request, path)` takes `path` but never uses it (both `/` and
  `/edit/{path}` just render the same `index.html`). Drop the parameter.

- `translate_recipe_frontend` (`main.py:56-58`) is a pure delegate to
  `api.routes.translate_recipe`; consider dropping the frontend route entirely if it's
  only a shortcut, or documenting why both exist.

### `api/routes.py`

- **Reaching into private methods** (`routes.py:97`, `routes.py:473`)
  `delete_directory` and `translate_recipe` call `fs_manager._validate_path(...)`
  directly. `_validate_path` is a private implementation detail; `delete_directory`
  re-implements existence/emptiness checks that belong in `FileSystemManager`.
  Fix: add a public `FileSystemManager.delete_directory(path)` (and `stat(path)` or
  `exists(path)`) and use it.

- **Fragile cache invalidation** (`routes.py:484-490`)
  ```python
  has_photo_in_cache = 'class="recipe-photo"' in cached.html_content
  ```
  Detecting whether a photo was rendered by string-matching on a CSS class in the HTML
  is brittle (breaks if the class/HTML changes). The cache entry already stores metadata;
  add a `photo_url` (or `has_photo`) field to `CachedTranslation` instead.

- **Non-atomic move** (`routes.py:57-73`)
  `move_file` does read → write → delete with no version check, and ignores the return
  value of `fs_manager.move_photo`. If the write succeeds but the delete fails, you get a
  duplicate. KISS: consider an `fs_manager.move_file` (os.rename within the base dir),
  or at least document the non-atomic behavior.

- **Over-complicated search scoring** (`routes.py:213-337`)
  `_search_file_contents`, `_search_filenames`, `_get_all_files_recursive`,
  `_extract_title_from_content`, `_generate_content_preview` contain a lot of hand-rolled
  scoring (phrase/word/title/filename bonuses). The "fuzzy matching" in
  `_search_filenames` (`routes.py:299-301`) is especially confusing:
  ```python
  matched_chars = sum(1 for c in query_lower if c in name_lower)
  score = matched_chars * 2 if matched_chars >= len(query_lower) * 0.7 else 0
  ```
  This isn't a real fuzzy match (character-order agnostic, duplicates counted once).
  Recommend: keep simple `substring`/`startswith` scoring and drop the pseudo-fuzzy
  branch, or use `difflib` if real fuzziness is wanted.

- **Duplicated title generation** (`routes.py:157`, `routes.py:498`)
  The `path → Title` transformation (`.replace("_", " ").replace("-", " ").title()`) is
  duplicated between `create_recipe` and `translate_recipe`. Extract a helper.

- `format_recipe` returns only `{"content": ...}` while the frontend overwrites the
  editor but relies on auto-save to persist — fine, but worth a comment.

### `api/filesystem.py`

- **Unbounded lock registry** (`filesystem.py:19`, `filesystem.py:21-24`)
  `self._file_locks` grows forever; a lock is never removed after use. For a single-user
  app this is negligible, but it's a memory leak. Either drop the locks entirely (single
  user, low concurrency) or clean up after each write.

- **Inconsistent exception handling** (`filesystem.py:40-67`, `filesystem.py:185-197`)
  `list_directory` and `create_directory` wrap everything in `except Exception` and return
  500, but they don't re-raise `HTTPException`. `_validate_path` raises
  `HTTPException(400)` for invalid paths, so an invalid path becomes a 500 instead of 400
  in these two methods. Other methods do `except HTTPException: raise` first — apply that
  consistently.

- **Naive path sanitization** (`filesystem.py:26-38`)
  ```python
  clean_path = path.replace("../", "")
  ...
  if not str(full_path).startswith(str(self.base_dir)):
  ```
  `startswith` prefix matching is fragile (a sibling dir like `/app/recipes2` passes) and
  string-replacing `../` is not robust. Use `full_path.is_relative_to(self.base_dir)`
  (Python 3.9+) and validate against the resolved path. This is security-sensitive given
  the README's own warning.

- **Over-complicated version bumping** (`filesystem.py:134-139`)
  The `os.utime` mtime-fudging to guarantee a monotonically increasing version is clever
  but hard to reason about. Simpler alternative: return an integer version stored in the
  file metadata, or just use `mtime_ns` and accept that two writes within the same
  millisecond are unlikely. At minimum, add a comment explaining *why* the utime hack
  exists.

- **~~Unused return value~~** (`filesystem.py:282-305`) — **RESOLVED**
  `move_photo` used to return `bool` and swallow failures with `return False`. It now
  raises `HTTPException` on failure (see "Exception swallowing anti-patterns" below).

### `api/formatting.py` and `api/translation.py`

- **Near-duplicate OpenAI plumbing** (`formatting.py:45-110`, `translation.py:64-132`)
  The two modules repeat the same structure: empty-check, client-null-check, timed
  `chat.completions.create` call with a hardcoded model, code-fence stripping, and the
  same `RateLimitError`/`APITimeoutError`/`APIError`/`Exception` mapping to a custom
  error. Extract a shared helper (e.g. `_openai_chat(prompt) -> str` raising a common
  `LLMError`) to cut ~100 lines of duplication.

- **Inline imports** (`formatting.py:66`, `translation.py:85`)
  `import time` inside the function; move to module top.

- **Hardcoded model** (`formatting.py:71`, `translation.py:90`)
  `model="gpt-5-mini"` is duplicated; move to a constant or env var.

### `api/openai_client.py`

- **Wrong type annotation** (`openai_client.py:4`)
  `openai_client: AsyncOpenAI = None` — annotated as `AsyncOpenAI` but assigned `None`.
  Use `Optional[AsyncOpenAI]` (or `AsyncOpenAI | None`).

---

## Exception swallowing / silent-failure anti-patterns

Good practice is to let exceptions bubble up until a layer that knows how to handle them
(typically the route, which maps them to an HTTP status). Swallowing an exception and
returning a sentinel (`False`, `None`, `[]`) or just `pass`/`continue` hides genuine
failures and turns bugs into silent data loss or wrong behavior. These are the remaining
instances found in the codebase (the `move_photo` case is already fixed and raised):

### `api/filesystem.py`

- **`photo_exists` swallows all exceptions** (`filesystem.py:215-224`)
  ```python
  except Exception as e:
      self.logger.warning(...)
      return False
  ```
  The legitimate "no photo" case is already expressed by `photo_path.exists() and
  photo_path.is_file()` returning `False`, so the `try/except` only fires on *unexpected*
  errors (permission denied, I/O error, etc.), which are silently converted into "no photo
  exists". Callers (`translate_recipe`, `get_photo` in `routes.py`) then misbehave as if
  there were simply no photo. Fix: drop the `try/except` and let it raise.

- **`delete_file` swallows photo-deletion failures** (`filesystem.py:164-172`)
  ```python
  try:
      await self.delete_photo(path)
  except HTTPException:
      pass            # "photo doesn't exist" — but this also catches 500s
  except Exception as e:
      self.logger.warning(...)   # genuine error silently ignored
  ```
  The broad `except HTTPException: pass` catches *any* `HTTPException` (including a 500
  raised by `delete_photo`), and `except Exception` swallows the rest. A recipe file gets
  deleted while its photo may be left orphaned. Fix: only ignore the "not found" case
  (e.g. have `delete_photo` return/raise a specific "no photo" signal), and let real
  failures bubble up.

### `api/routes.py`

- **`_search_file_contents` silently skips unreadable files** (`routes.py:275-276`)
  ```python
  except Exception:
      continue
  ```
  A file that fails to read is dropped from search results with no logging. At minimum log
  the failure; better, surface it so the user isn't silently missing matches.

- **`_get_all_files_recursive` silently skips unreadable directories** (`routes.py:333-335`)
  ```python
  except Exception:
      pass
  ```
  Same pattern — an unreadable directory is silently ignored during search traversal.

### `static/file-tree.js`

- **`getDragData` swallows parse errors and returns `null`** (`file-tree.js:400-401`)
  ```javascript
  try { return JSON.parse(...); } catch { return null; }
  ```
  A malformed drag payload is indistinguishable from "no drag data". Minor (drag-and-drop
  is best-effort), but a logged/guarded failure is clearer than a bare `catch { return null }`.

---

## Frontend

### `static/unified-app.js`

- **Empty callback** (`unified-app.js:340-343`)
  `onContentChange()` is empty. Either delete it and the wiring, or implement it.

- **Pointless button state** (`unified-app.js:509-521`)
  `redirectToTranslate` disables the button and injects a spinner, then immediately
  `window.location.href = ...` navigates away. The disabled/spinner state is never seen.

- **Listener-removal hack** (`unified-app.js:413-439`)
  `setupRenameModal` clones the form element to strip existing listeners. Prefer attaching
  a single delegated listener once, or use `{ once: true }`, instead of DOM cloning.

- **Toast layering** (`unified-app.js:373-392`)
  `showStatus` / `showSuccess` / `showError` / `showToast` chain through the sidebar
  manager. `PhotoManager` and `MarkdownEditor` also define their own `showSuccess` that
  just forwards to `window.app`. Consolidate to one notification API.

- `elements.headerActions` (`unified-app.js:23`) is fetched and checked for null in
  `setupResponsiveButtons` but never functionally used. Remove it.

### `static/easymde-editor.js`

- **Dead methods** (`easymde-editor.js:197-203`, `easymde-editor.js:246-272`, `easymde-editor.js:274-283`)
  `showSuccess()`, `refreshFile()`, and `destroy()` are never called anywhere in the
  codebase. Remove them (or wire `destroy` into a real teardown path if ever needed).

- **Hardcoded layout math** (`easymde-editor.js:209-223`)
  `calculateMaxHeight`/`updateEditorHeight` hardcode header/footer pixel heights; combined
  with the EasyMDE `autoRefresh` this is fragile. Prefer letting CSS/flexbox size the
  editor.

### `static/file-tree.js`

- **Dead file-creation branch** (`file-tree.js:288-306`)
  `createFile(path, isDirectory)` is only ever called with `isDirectory = true`
  (`sidebar-manager.js:475`). The `.md`/generic-file branches, and the `true` argument
  passed to `createRecipe(path, true)` (which `createRecipe` ignores), are dead.

- **Dead icon branches** (`file-tree.js:222-238`)
  `jpg`/`png`/`gif` icons are identical to `jpeg` and are never shown (`jpeg` files are
  filtered out of listings, and only `.md` files otherwise appear). Keep just the `md`
  icon and a generic fallback.

- **Over-complicated level calculation** (`file-tree.js:275-276`)
  ```javascript
  const level = (element.style.paddingLeft.match(/\d+/) || ["16"])[0];
  const currentLevel = Math.floor((parseInt(level) - 16) / 20);
  ```
  Derives the tree depth by parsing an inline `paddingLeft` style. Pass the numeric level
  through instead of reverse-engineering it from CSS.

- **Duplicated expand/collapse SVG** (`file-tree.js:255-256`, `263-264`)
  The exact same SVG string is set in both branches of `toggleDirectory`. Set it once.

- **Duplicated edit-mode checkbox logic** (`file-tree.js:112-135` and `178-210`)
  `renderDirectory` and `renderFile` repeat the same "in edit mode toggle checkbox"
  handling. Extract a shared handler.

### `static/photo-manager.js`

- **Unused field** (`photo-manager.js:5`)
  `this.isLoading` is set but never read. Remove.

### `templates/index.html`

- **Dead editor-ready event** (`index.html:98-101` and `unified-app.js:248-259`)
  ```html
  <script>
    window.EditorReady = true;
    window.dispatchEvent(new Event("editor-ready"));
  </script>
  ```
  This runs synchronously in `<head>`, before `unified-app.js` loads, so the
  `editor-ready` listener in `initializeEditorMode`'s `else` branch can never fire. The
  `if (window.EditorReady)` branch always runs. Remove the event dispatch + `else` branch
  and just load synchronously (EasyMDE is already a blocking `<script>`).

---

## Documentation & config drift

### `CLAUDE.md`

- **Wrong make target** (`CLAUDE.md:20`)
  Says `make format`, but the Makefile defines `fmt` (there is no `format` target).
  Update to `make fmt` (or add a `format` alias in the Makefile).

### `README.md`

- **Wrong editor described** (`README.md:12`, `README.md:140-145`)
  Says "Prism.js markdown syntax highlighting" and "Textarea + syntax overlay approach",
  but the code uses **EasyMDE** (CodeMirror) with `inputStyle: "contenteditable"`. Rewrite
  the "Editor System" section.

- **Env vars that don't exist** (`README.md:72-82`, `README.md:164-171`)
  Documents `HOST` and `PORT` env vars and even gives a
  `docker run -p 3000:3000 -e PORT=3000 ...` example, but the app ignores both
  (`main.py` hardcodes `host="0.0.0.0"`, `port=8000`; only `RECIPES_DIR` is read in
  `api/filesystem.py:15`). Either implement `HOST`/`PORT` or remove them from the docs and
  Docker config.

- **Incomplete API reference** (`README.md:84-108`)
  Missing the photo endpoints (`/api/photos/...`), `POST /api/recipes/{path}/format`, and
  `GET /api/recipes/{path}/translate`. Add them or trim the section to a link to the code.

- **Testing command** (`README.md:116`)
  Says `uv run pytest tests/ -v`; `CLAUDE.md` and the Makefile use `uv run pytest`. Pick one.

### `Dockerfile` / `docker-compose.yml`

- **Broken healthcheck** (`Dockerfile:41`, `docker-compose.yml:26`)
  Both use `import requests`, but `requests` is not in `pyproject.toml` or `uv.lock`
  (verified). The healthcheck will always fail. Use a dependency-free check, e.g.
  `python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"`.

- **Dead env vars** (`Dockerfile:7-10`, `docker-compose.yml:16-19`)
  `HOST` and `PORT` are set but never read (see above).

### `pyproject.toml`

- **Duplicated dev dependencies** (`pyproject.toml:16-21` vs `30-36`)
  `[project.optional-dependencies] dev` and `[dependency-groups] dev` both declare
  `pytest`, `pytest-asyncio`, `httpx`. Consolidate into one (prefer `[dependency-groups]`
  since that's what `uv run pytest` uses); keep `pyright` in one place.

---

## Repo cruft (safe to delete / gitignore)

- `p.tgz` — stray tarball in the repo root (10 KB).
- `.DS_Store` — macOS metadata, should be gitignored/removed.
- `__pycache__/`, `.pytest_cache/`, `.ruff_cache/` — build/cache artifacts (also appear
  inside `api/` and `tests/`); ensure `.gitignore` covers them.
- `recipes/` contains leftover manual-test data (`test-recipe-1.md` … `test-recipe-15.md`,
  `test-recipe.md`, `test.md`, `aaa.*`, `bbb.*`, `sss.md`, plus `.jpeg` fixtures). Decide
  whether these are intended sample content or should be removed from the repo.

---

## Recommended priority

1. **Fix bugs**: Docker/compose healthcheck (`requests` missing); `list_directory` /
   `create_directory` swallowing `HTTPException`; `HOST`/`PORT` docs-vs-reality.
2. **Delete dead code**: empty `onContentChange`, unused editor methods, dead icon/file
   branches, dead `editor-ready` event, `headerActions`, `PhotoManager.isLoading`.
3. **Collapse duplication**: shared OpenAI helper; single title-generation helper; single
   notification/toast API; shared edit-mode checkbox handler; fixed static mount.
4. **Simplify the clever bits**: remove mtime-fudging (or comment it), simplify search
   scoring, replace string-sniffing cache invalidation with a metadata field.
5. **Refresh docs**: CLAUDE.md make target, README editor/env/API sections, consolidate
   `pyproject.toml` dev deps.
