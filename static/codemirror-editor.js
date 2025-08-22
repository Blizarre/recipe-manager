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
    this.currentVersion = null; // Track file version
    this.autoSaveTimeoutId = null;
    this.autoSaveDelay = 1000; // 1 second
    this.editableCompartment = null; // For managing read-only state

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
      const { EditorView, basicSetup, EditorState, markdown, Compartment } =
        window.CodeMirror;

      // Create compartment for editable state
      this.editableCompartment = new Compartment();

      // Create extensions array
      const extensions = [
        basicSetup,
        markdown(),
        window.CodeMirror.syntaxHighlighting(
          window.CodeMirror.markdownHighlighting,
        ),
        EditorView.lineWrapping,
        this.editableCompartment.of(EditorView.editable.of(true)),
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
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
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
    this.currentVersion = null;
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
      const result = await window.api.saveFile(
        this.currentFile,
        content,
        this.currentVersion,
      );

      // Update version and content tracking
      this.lastSavedContent = content;
      this.currentVersion = result.version;

      // Only mark as not dirty if the content matches what we just saved
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

      // Handle version conflicts in auto-save
      if (error.isVersionConflict && error.conflictData) {
        this.cancelAutoSave();
        this.showConflictWarning();
        return;
      }

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

  setReadOnly() {
    if (!this.view || !this.editableCompartment) return;

    this.view.dispatch({
      effects: this.editableCompartment.reconfigure(
        window.CodeMirror.EditorView.editable.of(false),
      ),
    });
  }

  showConflictWarning() {
    // Make editor read-only to prevent further changes
    this.setReadOnly();

    // Show alert for immediate attention
    alert(
      "⚠️ Version Conflict!\n\nThis recipe was modified in another browser tab or session. The editor is now read-only.\n\nPlease refresh the page to see the latest changes.",
    );

    const fileStatus = document.getElementById("fileStatus");
    if (fileStatus) {
      fileStatus.textContent = "⚠️ File modified elsewhere - refresh required";
      fileStatus.classList.add("conflict-warning");
    }
    this.showError(
      "File was modified in another browser. Editor is now read-only. Please refresh the page to see the latest changes.",
    );
  }

  async refreshFile() {
    if (!this.currentFile) return;

    try {
      const response = await window.api.getFile(this.currentFile);
      this.setContent(response.content || "");
      this.lastSavedContent = response.content || "";
      this.currentVersion = response.version;
      this.isDirty = false;
      this.updateUI();

      // Clear any conflict warnings
      const fileStatus = document.getElementById("fileStatus");
      if (fileStatus) {
        fileStatus.textContent = "";
        fileStatus.classList.remove("conflict-warning");
      }

      this.showSuccess("Recipe refreshed with latest changes");
    } catch (error) {
      this.showError("Failed to refresh: " + Utils.extractErrorMessage(error));
    }
  }

  // Cleanup method
  destroy() {
    this.cancelAutoSave();
    if (this.view) {
      this.view.destroy();
    }
  }
}
