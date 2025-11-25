// Unified Recipe Manager Application
class UnifiedRecipeApp {
  constructor() {
    this.currentFile = null;
    this.editor = null;
    this.isLoading = false;
    this.sidebar = null;
    this.mobileFileTree = null;
    this.photoManager = null;

    // Cache DOM elements
    this.elements = {
      initialLoading: document.getElementById("initialLoading"),
      welcomeScreen: document.getElementById("welcomeScreen"),
      editorInterface: document.getElementById("editorInterface"),
      sidebar: document.getElementById("sidebar"),
      undoBtn: document.getElementById("undoBtn"),
      renameBtn: document.getElementById("renameBtn"),
      translateBtn: document.getElementById("translateBtn"),
      togglePhotoBtn: document.getElementById("togglePhotoBtn"),
      togglePhotoMobileBtn: document.getElementById("togglePhotoMobileBtn"),
      headerActions: document.querySelector(".header-actions"),
      actionButtons: document.querySelector(".action-buttons"),
      fileName: document.getElementById("fileName"),
    };

    this.init();
  }

  init() {
    // Extract recipe path from URL if present
    this.currentFile = this.extractPathFromUrl();

    // Setup components
    this.setupComponents();
    this.setupEventListeners();
    this.setupResponsiveButtons();

    // Show appropriate interface based on whether we have a file
    this.updateInterface();

    // If we have a file to load, setup editor and load content
    if (this.currentFile) {
      this.initializeEditorMode();
    }
  }

  setupComponents() {
    // Initialize shared sidebar manager
    this.sidebar = new SidebarManager(
      (path) => this.onFileSelect(path),
      (files) => this.onFilesLoaded(files),
    );

    // Initialize mobile file tree (for the welcome screen)
    const mobileFileTreeContainer = document.getElementById("mobileFileTree");
    if (mobileFileTreeContainer) {
      this.mobileFileTree = new FileTree(mobileFileTreeContainer, (path) =>
        this.onFileSelect(path),
      );
    }

    // Set callbacks for file operations that affect current URL
    this.sidebar.setCallbacks({
      onFileRenamed: (oldPath, newPath) =>
        this.handleFileRenamed(oldPath, newPath),
      onFileDeleted: (deletedPath) => this.handleFileDeleted(deletedPath),
    });

    // Initialize photo manager
    this.photoManager = new PhotoManager();
  }

  setupEventListeners() {
    // Action buttons (only active in editor mode)
    document
      .getElementById("undoBtn")
      ?.addEventListener("click", () => this.editor?.undo());
    document
      .getElementById("renameBtn")
      ?.addEventListener("click", () => this.showRenameModal());
    document
      .getElementById("translateBtn")
      ?.addEventListener("click", () => this.redirectToTranslate());

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.hideRenameModal();
      }
    });
  }

  setupResponsiveButtons() {
    const moveButtons = () => {
      const {
        undoBtn,
        renameBtn,
        translateBtn,
        togglePhotoBtn,
        togglePhotoMobileBtn,
        headerActions,
        actionButtons,
      } = this.elements;

      if (
        !undoBtn ||
        !renameBtn ||
        !translateBtn ||
        !headerActions ||
        !actionButtons
      )
        return;

      if (window.innerWidth <= 768) {
        // Mobile: keep buttons in header - they're already there
        // Hide desktop photo button on mobile
        if (togglePhotoBtn) {
          togglePhotoBtn.style.display = "none";
        }
        // Show mobile photo button
        if (togglePhotoMobileBtn) {
          togglePhotoMobileBtn.style.display = "block";
        }
      } else {
        // Desktop: move buttons to editor header and show desktop photo button
        if (!actionButtons.contains(undoBtn)) {
          actionButtons.appendChild(undoBtn);
        }
        if (!actionButtons.contains(renameBtn)) {
          actionButtons.appendChild(renameBtn);
        }
        if (!actionButtons.contains(translateBtn)) {
          actionButtons.appendChild(translateBtn);
        }

        // Show desktop photo button
        if (togglePhotoBtn) {
          togglePhotoBtn.style.display = "block";
        }
        // Hide mobile photo button on desktop
        if (togglePhotoMobileBtn) {
          togglePhotoMobileBtn.style.display = "none";
        }
      }
    };

    // Initial positioning and resize listener
    moveButtons();
    window.addEventListener("resize", moveButtons);
  }

  extractPathFromUrl() {
    const pathname = window.location.pathname;
    const editPrefix = "/edit/";

    if (pathname === "/" || !pathname.startsWith(editPrefix)) {
      return null;
    }

    return pathname.substring(editPrefix.length);
  }

  updateInterface() {
    const {
      initialLoading,
      welcomeScreen,
      editorInterface,
      sidebar,
      undoBtn,
      renameBtn,
      translateBtn,
      togglePhotoBtn,
      togglePhotoMobileBtn,
      fileName,
    } = this.elements;

    // Hide initial loading
    if (initialLoading) {
      initialLoading.style.display = "none";
    }

    if (this.currentFile) {
      // Editor mode - hide welcome, show editor
      welcomeScreen.style.display = "none";
      editorInterface.style.display = "block";

      // Show action buttons when file is open
      if (undoBtn) undoBtn.style.display = "block";
      if (renameBtn) renameBtn.style.display = "block";
      if (translateBtn) translateBtn.style.display = "block";
      if (togglePhotoBtn) togglePhotoBtn.style.display = "block";
      if (togglePhotoMobileBtn) togglePhotoMobileBtn.style.display = "block";

      // Update page info
      this.updatePageInfo();
    } else {
      // Welcome mode - show welcome, hide editor, ensure sidebar is visible
      welcomeScreen.style.display = "block";
      editorInterface.style.display = "none";

      // Hide action buttons when no file is open
      if (undoBtn) undoBtn.style.display = "none";
      if (renameBtn) renameBtn.style.display = "none";
      if (translateBtn) translateBtn.style.display = "none";
      if (togglePhotoBtn) togglePhotoBtn.style.display = "none";
      if (togglePhotoMobileBtn) togglePhotoMobileBtn.style.display = "none";

      // Ensure sidebar is visible in welcome mode
      sidebar.classList.add("sidebar-open");

      // Update title
      document.title = "Recipe Manager";
      fileName.textContent = "Recipe Manager";
    }
  }

  updatePageInfo() {
    if (!this.currentFile) return;

    const fileName = this.currentFile.split("/").pop();
    document.title = `${fileName} - Recipe Manager`;

    // Update file name displays
    const fileNameMobile = document.getElementById("fileName");
    const fileNameDesktop = document.getElementById("fileNameDesktop");

    if (fileNameMobile) {
      fileNameMobile.textContent = fileName;
    }
    if (fileNameDesktop) {
      fileNameDesktop.textContent = fileName;
    }
  }

  async initializeEditorMode() {
    // Initialize editor when CodeMirror is ready
    if (window.CodeMirrorReady) {
      await this.setupEditor();
      this.loadRecipeContent();
    } else {
      window.addEventListener("codemirror-ready", async () => {
        await this.setupEditor();
        this.loadRecipeContent();
      });
    }
  }

  async setupEditor() {
    try {
      const editorContainer = document.getElementById("editorContainer");
      this.editor = new CodeMirrorEditor(editorContainer, () =>
        this.onContentChange(),
      );
    } catch (error) {
      console.error("Failed to setup editor:", error);
      this.showError("Failed to initialize editor");
    }
  }

  async loadRecipeContent() {
    if (!this.editor || !this.currentFile || this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.showStatus("Loading recipe...");

    try {
      const response = await window.api.getFile(this.currentFile);

      // Load content into editor
      this.editor.currentFile = this.currentFile;
      this.editor.currentVersion = response.version; // Set version before content
      this.editor.lastSavedContent = response.content || "";
      this.editor.setContent(response.content || "");
      this.editor.isDirty = false;
      this.editor.updateUI();

      // Hide loading and show editor
      this.showEditorContent();

      this.showStatus("Recipe loaded");
    } catch (error) {
      console.error("Failed to load recipe:", error);
      this.showError(
        "Failed to load recipe: " + Utils.extractErrorMessage(error),
      );
      // Still show editor on error (user can see the error)
      this.showEditorContent();
    } finally {
      this.isLoading = false;
    }
  }

  showEditorContent() {
    const editorLoading = document.getElementById("editorLoading");
    const editorPanel = document.getElementById("editorPanel");
    const editorStatus = document.querySelector(".editor-status");

    if (editorLoading) {
      editorLoading.style.display = "none";
    }
    if (editorPanel) {
      editorPanel.style.display = "block";
    }
    if (editorStatus) {
      editorStatus.style.display = "block";
    }

    // Load photo for the current recipe
    if (this.photoManager && this.currentFile) {
      this.photoManager.setCurrentRecipe(this.currentFile);
    }
  }

  // Event handlers
  onFilesLoaded(files) {
    // Update mobile file tree whenever sidebar loads files
    if (this.mobileFileTree) {
      this.mobileFileTree.setFiles(files);
    }
  }

  async onFileSelect(path) {
    if (path) {
      // Navigate to the file's URL - this will load the page for that file
      window.location.href = `/edit/${path}`;
    }
  }

  onContentChange() {
    // Called when editor content changes
    // The CodeMirrorEditor class handles auto-save and UI updates
  }

  // Handle file operations that affect current URL
  handleFileRenamed(oldPath, newPath) {
    if (oldPath === this.currentFile) {
      window.history.replaceState({}, "", `/edit/${newPath}`);
      this.currentFile = newPath;
      this.updatePageInfo();

      // Update photo manager with new recipe path
      if (this.photoManager) {
        this.photoManager.setCurrentRecipe(newPath);
      }
    }
  }

  handleFileDeleted(deletedPath) {
    if (deletedPath === this.currentFile) {
      // Navigate back to welcome screen
      window.history.pushState({}, "", "/");
      this.currentFile = null;
      this.updateInterface();

      // Clear photo manager
      if (this.photoManager) {
        this.photoManager.setCurrentRecipe(null);
      }
    }
  }

  showStatus(message) {
    const statusElement = document.getElementById("fileStatus");
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  showSuccess(message) {
    this.showToast(message, "success");
  }

  showError(message) {
    this.showToast(message, "error");
  }

  showToast(message, type = "info") {
    if (this.sidebar) {
      this.sidebar.showToast(message, type);
    }
  }

  // Rename functionality
  showRenameModal() {
    if (!this.currentFile) return;

    const modal = document.getElementById("renameFileModal");
    const fileNameInput = document.getElementById("newFileName");

    // Pre-fill with current filename
    const currentFileName = this.currentFile.split("/").pop();
    fileNameInput.value = currentFileName;

    // Setup modal event listeners
    this.setupRenameModal();

    modal.classList.add("active");
    fileNameInput.focus();
    fileNameInput.select();
  }

  setupRenameModal() {
    const modal = document.getElementById("renameFileModal");
    const form = document.getElementById("renameFileForm");
    const closeBtn = document.getElementById("renameModalClose");
    const cancelBtn = document.getElementById("cancelRename");

    // Remove existing listeners to avoid duplicates
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    closeBtn?.addEventListener("click", () => this.hideRenameModal());
    cancelBtn?.addEventListener("click", () => this.hideRenameModal());

    document
      .getElementById("renameFileForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.renameCurrentFile();
      });

    // Close modal when clicking outside
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) {
        this.hideRenameModal();
      }
    });
  }

  hideRenameModal() {
    const modal = document.getElementById("renameFileModal");
    modal.classList.remove("active");
  }

  async renameCurrentFile() {
    if (!this.currentFile) return;

    try {
      const newFileName = document.getElementById("newFileName").value.trim();

      if (!newFileName) {
        alert("Please enter a new file name");
        return;
      }

      // Ensure .md extension
      const finalFileName = newFileName.endsWith(".md")
        ? newFileName
        : newFileName + ".md";

      // Validate filename
      if (!/^[a-zA-Z0-9\s\-_.]+$/.test(finalFileName.replace(".md", ""))) {
        alert(
          "Please use only letters, numbers, spaces, hyphens, underscores, and dots",
        );
        return;
      }

      // Build new path
      const pathParts = this.currentFile.split("/");
      pathParts[pathParts.length - 1] = finalFileName;
      const newPath = pathParts.join("/");

      // Don't rename if it's the same
      if (newPath === this.currentFile) {
        this.hideRenameModal();
        return;
      }

      // Use the existing file rename API
      await window.api.moveFile(this.currentFile, newPath);

      // Update current file and URL
      this.currentFile = newPath;
      window.history.replaceState({}, "", `/edit/${newPath}`);

      // Update page info
      this.updatePageInfo();

      // Update editor's current file reference
      if (this.editor) {
        this.editor.currentFile = newPath;
      }

      // Refresh file tree
      await this.sidebar.refreshFileTree();

      this.hideRenameModal();
      this.showSuccess("File renamed successfully");
    } catch (error) {
      console.error("Failed to rename file:", error);
      this.showError(
        "Failed to rename file: " + Utils.extractErrorMessage(error),
      );
    }
  }

  redirectToTranslate() {
    if (!this.currentFile) return;

    // Redirect from /edit/filename.md to /translate/filename.md
    window.location.href = `/translate/${this.currentFile}`;
  }
}

// Initialize the unified app
document.addEventListener("DOMContentLoaded", () => {
  new UnifiedRecipeApp();
});

// Handle browser back/forward navigation
window.addEventListener("popstate", () => {
  // Reload the page to handle navigation properly
  window.location.reload();
});
