// CodeMirror 6 Editor wrapper for Recipe Manager
class CodeMirrorEditor {
  constructor(container, onContentChange) {
    this.container = container;
    this.onContentChange = onContentChange;
    this.editor = null;
    this.view = null;
    this.currentFile = null;
    this.isDirty = false;
    this.lastSavedContent = "";
    this.autoSaveTimeoutId = null;
    this.autoSaveDelay = 1000; // 1 second

    this.init();
  }

  init() {
    // Wait for CodeMirror to load from ES modules
    if (window.CodeMirrorReady) {
      this.setupEditor();
      this.updateUI();
    } else {
      window.addEventListener("codemirror-ready", () => {
        this.setupEditor();
        this.updateUI();
      });
    }
  }

  setupEditor() {
    const editorElement = document.getElementById("editor");
    if (!editorElement) {
      console.error("CodeMirror editor element not found");
      return;
    }

    // Check if CodeMirror is available
    if (!window.CodeMirror || !window.CodeMirror.EditorView) {
      console.error("CodeMirror not loaded properly");
      this.showError("Editor failed to load. Please refresh the page.");
      return;
    }

    try {
      // Create CodeMirror 6 editor with basic configuration
      const { EditorView, basicSetup, EditorState, markdown } =
        window.CodeMirror;

      // Create extensions array
      const extensions = [
        basicSetup,
        markdown(),
        window.CodeMirror.syntaxHighlighting(
          window.CodeMirror.markdownHighlighting,
        ),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            this.isDirty = true;
            this.updateUI();
            this.onContentChange?.();
            this.scheduleAutoSave();
          }
        }),
        EditorView.theme({
          "&": {
            fontSize: "14px",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          },
          ".cm-content": {
            padding: "16px",
            minHeight: "calc(100vh - 140px)",
            lineHeight: "1.6",
          },
          ".cm-focused": {
            outline: "none",
          },
          ".cm-editor": {
            height: "100%",
          },
          ".cm-scroller": {
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          },
          ".cm-lineNumbers, .cm-gutter": {
            display: "none !important",
          },
        }),
      ];

      // Create editor state
      const state = EditorState.create({
        doc: "Start typing your recipe here...",
        extensions: extensions,
      });

      // Create editor view
      this.view = new EditorView({
        state: state,
        parent: editorElement,
      });

      // Add focus/blur handlers
      this.view.dom.addEventListener("focus", () => {
        this.container.classList.add("focused");
      });

      this.view.dom.addEventListener("blur", () => {
        this.container.classList.remove("focused");
      });

      // Add keyboard shortcuts
      this.setupKeyboardShortcuts();

      // Setup beforeunload warning for unsaved changes
      this.setupBeforeUnloadWarning();
    } catch (error) {
      console.error("Failed to setup CodeMirror editor:", error);
      this.showError("Editor setup failed: " + error.message);
    }
  }

  setupKeyboardShortcuts() {
    if (!this.view) return;

    // Add save shortcut and undo/redo shortcuts
    this.view.dom.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        this.save();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        this.redo();
      }
    });
  }

  setupBeforeUnloadWarning() {
    // Warn user when leaving page with unsaved changes
    window.addEventListener("beforeunload", (e) => {
      if (this.isDirty && this.currentFile) {
        // Modern browsers require setting returnValue
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    });
  }

  async loadFile(path) {
    if (!path) {
      this.clearEditor();
      return;
    }

    try {
      this.showLoading();
      const response = await window.api.getFile(path);

      this.currentFile = path;
      this.setContent(response.content || "");
      this.lastSavedContent = response.content || "";
      this.isDirty = false;
      this.updateUI();

      // Show editor wrapper
      const editorWrapper = document.getElementById("editorWrapper");
      const welcomeScreen = document.getElementById("welcomeScreen");

      if (editorWrapper) editorWrapper.style.display = "flex";
      if (welcomeScreen) welcomeScreen.style.display = "none";
    } catch (error) {
      console.error("Failed to load file:", error);
      this.showError(
        "Failed to load file: " + Utils.extractErrorMessage(error),
      );
    }
  }

  setContent(content) {
    const transaction = this.view.state.update({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: content,
      },
    });
    this.view.dispatch(transaction);
    this.updateCharCount();
  }

  getContent() {
    return this.view.state.doc.toString();
  }

  clearEditor() {
    this.cancelAutoSave();
    this.currentFile = null;
    this.setContent("Start typing your recipe here...");
    this.lastSavedContent = "";
    this.isDirty = false;
    this.updateUI();

    // Hide editor wrapper, show welcome screen
    const editorWrapper = document.getElementById("editorWrapper");
    const welcomeScreen = document.getElementById("welcomeScreen");

    if (editorWrapper) editorWrapper.style.display = "none";
    if (welcomeScreen) welcomeScreen.style.display = "flex";
  }

  async save() {
    if (!this.currentFile || !this.isDirty) return;

    try {
      const content = this.getContent();
      await window.api.saveFile(this.currentFile, content);

      this.lastSavedContent = content;
      this.isDirty = false;
      this.updateUI();

      // Show success message
      this.showSuccess("Recipe saved successfully");

      // Notify file tree of changes
      window.app?.fileTree?.notifyFileChanged(this.currentFile);
    } catch (error) {
      console.error("Failed to save file:", error);
      this.showError(
        "Failed to save recipe: " + Utils.extractErrorMessage(error),
      );
    }
  }

  scheduleAutoSave() {
    // Clear any existing timeout
    if (this.autoSaveTimeoutId) {
      clearTimeout(this.autoSaveTimeoutId);
    }

    // Schedule auto-save after the delay
    this.autoSaveTimeoutId = setTimeout(() => {
      this.autoSave();
    }, this.autoSaveDelay);
  }

  async autoSave() {
    // Only auto-save if file is dirty and we have a current file
    if (!this.currentFile || !this.isDirty) return;

    try {
      const content = this.getContent();
      await window.api.saveFile(this.currentFile, content);

      // Update lastSavedContent - this tracks what's on the server
      // Keep isDirty true if the current content still differs from the baseline
      // This preserves undo history while keeping auto-save functionality
      this.lastSavedContent = content;

      // Only mark as not dirty if the content matches what we just saved
      // This prevents the save button from being disabled while preserving undo history
      const currentContent = this.getContent();
      if (currentContent === content) {
        this.isDirty = false;
      }

      this.updateUI();

      // Show subtle auto-save indicator
      const fileStatus = document.getElementById("fileStatus");
      if (fileStatus) {
        fileStatus.textContent = "Auto-saved";
        fileStatus.classList.add("auto-saved");

        // Clear the indicator after a short time
        setTimeout(() => {
          fileStatus.textContent = "";
          fileStatus.classList.remove("auto-saved");
        }, 2000);
      }

      // Notify file tree of changes
      window.app?.fileTree?.notifyFileChanged(this.currentFile);
    } catch (error) {
      console.error("Auto-save failed:", error);
      this.showError("Auto-save failed: " + Utils.extractErrorMessage(error));
    }
  }

  cancelAutoSave() {
    if (this.autoSaveTimeoutId) {
      clearTimeout(this.autoSaveTimeoutId);
      this.autoSaveTimeoutId = null;
    }
  }

  updateUI() {
    // Update undo/redo button states
    const undoBtn = document.getElementById("undoBtn");
    const redoBtn = document.getElementById("redoBtn");

    if (undoBtn && redoBtn && this.view) {
      const canUndo = this.canUndo();
      const canRedo = this.canRedo();

      undoBtn.disabled = !canUndo;
      redoBtn.disabled = !canRedo;
    }

    this.updateCharCount();
  }

  updateCharCount() {
    const charCountElement = document.getElementById("charCount");
    if (charCountElement) {
      const content = this.getContent();
      const charCount = content.length;
      const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
      charCountElement.textContent = `${charCount} characters • ${wordCount} words`;
    }
  }

  showLoading() {
    this.setContent("Loading...");
  }

  showError(message) {
    if (window.app) {
      window.app.showError(message);
    } else {
      console.error(message);
    }
  }

  showSuccess(message) {
    if (window.app) {
      window.app.showSuccess(message);
    } else {
      console.log(message);
    }
  }

  // Public methods for external use
  getCurrentFile() {
    return this.currentFile;
  }

  isDirtyFile() {
    return this.isDirty;
  }

  focus() {
    this.view.focus();
  }

  undo() {
    if (!this.view) return false;
    return window.CodeMirror.undo(this.view);
  }

  redo() {
    if (!this.view) return false;
    return window.CodeMirror.redo(this.view);
  }

  canUndo() {
    if (!this.view || !this.view.state) return false;
    // Use the undoDepth function from CodeMirror commands
    return window.CodeMirror.undoDepth(this.view.state) > 0;
  }

  canRedo() {
    if (!this.view || !this.view.state) return false;
    // Use the redoDepth function from CodeMirror commands
    return window.CodeMirror.redoDepth(this.view.state) > 0;
  }

  insertText(text) {
    const transaction = this.view.state.update({
      changes: {
        from: this.view.state.selection.main.head,
        insert: text,
      },
    });
    this.view.dispatch(transaction);
  }

  // Cleanup method
  destroy() {
    this.cancelAutoSave();
    if (this.view) {
      this.view.destroy();
    }
  }
}
