// EasyMDE Markdown Editor wrapper for Recipe Manager
class MarkdownEditor {
  constructor(container, onContentChange) {
    this.container = container;
    this.onContentChange = onContentChange;
    this.editor = null;
    this.currentFile = null;
    this.isDirty = false;
    this.lastSavedContent = "";
    this.currentVersion = null;
    this.autoSaveTimeoutId = null;
    this.autoSaveDelay = 1000; // 1 second

    this.init();
  }

  init() {
    if (typeof EasyMDE !== "undefined") {
      this.setupEditor();
    } else {
      console.error("EasyMDE not loaded");
      this.showError("Editor failed to load. Please refresh the page.");
    }
  }

  setupEditor() {
    const editorElement = document.getElementById("editor");
    if (!editorElement) {
      console.error("Editor element not found");
      return;
    }

    try {
      this.editor = new EasyMDE({
        element: editorElement,
        spellChecker: false, // Disable JS-based spell checker
        nativeSpellcheck: true, // Enable native browser spellcheck
        inputStyle: "contenteditable", // Better mobile keyboard support
        autofocus: false,
        placeholder: "Start typing your recipe here...",
        status: false,
        toolbar: false,
        renderingConfig: {
          singleLineBreaks: false,
          codeSyntaxHighlighting: true,
        },
        lineWrapping: true,
        minHeight: "calc(100vh - 200px)",
      });

      // Enable mobile keyboard features (autocorrect, autocapitalize)
      const cmElement = this.editor.codemirror.getInputField();
      if (cmElement) {
        cmElement.setAttribute("autocorrect", "on");
        cmElement.setAttribute("autocapitalize", "sentences");
        cmElement.setAttribute("spellcheck", "true");
      }

      // Poll for changes (avoids accessing internal codemirror for change events)
      this.lastContent = this.editor.value();
      this.pollInterval = setInterval(() => {
        const currentContent = this.editor.value();
        if (currentContent !== this.lastContent) {
          this.lastContent = currentContent;
          this.isDirty = true;
          this.onContentChange?.();
          this.scheduleAutoSave();
          this.updateUI();
        }
      }, 300);

      this.setupBeforeUnloadWarning();
    } catch (error) {
      console.error("Failed to setup EasyMDE editor:", error);
      this.showError("Editor setup failed: " + error.message);
    }
  }

  setupBeforeUnloadWarning() {
    window.addEventListener("beforeunload", (e) => {
      if (this.isDirty && this.currentFile) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    });
  }

  setContent(content) {
    if (!this.editor) return;
    this.editor.value(content);
    this.lastContent = content;
    this.updateCharCount();
  }

  getContent() {
    if (!this.editor) return "";
    return this.editor.value();
  }

  scheduleAutoSave() {
    if (this.autoSaveTimeoutId) {
      clearTimeout(this.autoSaveTimeoutId);
    }

    this.autoSaveTimeoutId = setTimeout(() => {
      this.autoSave();
    }, this.autoSaveDelay);
  }

  async autoSave() {
    if (!this.currentFile || !this.isDirty) return;

    try {
      const content = this.getContent();
      const result = await window.api.saveFile(
        this.currentFile,
        content,
        this.currentVersion,
      );

      this.lastSavedContent = content;
      this.currentVersion = result.version;

      const currentContent = this.getContent();
      if (currentContent === content) {
        this.isDirty = false;
      }

      const fileStatus = document.getElementById("fileStatus");
      if (fileStatus) {
        fileStatus.textContent = "Auto-saved";
        fileStatus.classList.add("auto-saved");

        setTimeout(() => {
          fileStatus.textContent = "";
          fileStatus.classList.remove("auto-saved");
        }, 2000);
      }

      window.app?.fileTree?.notifyFileChanged(this.currentFile);
    } catch (error) {
      console.error("Auto-save failed:", error);

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
    const undoBtn = document.getElementById("undoBtn");
    if (undoBtn && this.editor) {
      undoBtn.disabled = !this.canUndo();
    }
    this.updateCharCount();
  }

  updateCharCount() {
    const charCountElement = document.getElementById("charCount");
    if (charCountElement && this.editor) {
      const content = this.getContent();
      const charCount = content.length;
      const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
      charCountElement.textContent = `${charCount} characters • ${wordCount} words`;
    }
  }

  undo() {
    if (!this.editor) return false;
    this.editor.codemirror.undo();
    this.updateUI();
    return true;
  }

  canUndo() {
    if (!this.editor || !this.editor.codemirror) return false;
    return this.editor.codemirror.historySize().undo > 0;
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

  getCurrentFile() {
    return this.currentFile;
  }

  refresh() {
    // Trigger EasyMDE to recalculate layout
    if (this.editor && this.editor.codemirror) {
      this.editor.codemirror.refresh();
    }
  }

  showConflictWarning() {
    // Disable the textarea directly
    const textarea = document.getElementById("editor");
    if (textarea) {
      textarea.disabled = true;
    }

    alert(
      "Version Conflict!\n\nThis recipe was modified in another browser tab or session. The editor is now read-only.\n\nPlease refresh the page to see the latest changes.",
    );

    const fileStatus = document.getElementById("fileStatus");
    if (fileStatus) {
      fileStatus.textContent = "File modified elsewhere - refresh required";
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

      // Re-enable textarea
      const textarea = document.getElementById("editor");
      if (textarea) {
        textarea.disabled = false;
      }

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

  destroy() {
    this.cancelAutoSave();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    if (this.editor) {
      this.editor.toTextArea();
      this.editor = null;
    }
  }
}
