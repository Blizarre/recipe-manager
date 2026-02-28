// Shared Sidebar Management Component
class SidebarManager {
  constructor(onFileSelect, onFilesLoaded) {
    this.onFileSelect = onFileSelect || (() => {});
    this.onFilesLoaded = onFilesLoaded || (() => {});
    this.fileTree = null;
    this.search = null;
    this.cachedFiles = [];

    this.init();
  }

  init() {
    this.setupComponents();
    this.setupEventListeners();
    this.setupMobile();
    this.setupModal();
    this.setupFolderModal();
    this.setupFolderAutocomplete();

    // Initial load of file tree
    this.refreshFileTree();
  }

  setupComponents() {
    // Initialize file tree
    const fileTreeContainer = document.getElementById("fileTree");
    this.fileTree = new FileTree(fileTreeContainer, (path) =>
      this.handleFileSelect(path),
    );

    // Initialize search
    this.setupSearch();

    // Mobile-specific setup
    if (window.innerWidth <= 768) {
      this.setupOverlayTouch();
      this.setupVirtualKeyboardHandling();
    }
  }

  setupEventListeners() {
    // New recipe buttons
    document
      .getElementById("desktopNewBtn")
      ?.addEventListener("click", () => this.showNewRecipeModal());

    // New folder button
    document
      .getElementById("newFolderBtn")
      ?.addEventListener("click", () => this.showNewFolderModal());

    // Edit mode button
    document
      .getElementById("editModeBtn")
      ?.addEventListener("click", () => this.toggleEditMode());

    // Delete selected button
    document
      .getElementById("deleteSelectedBtn")
      ?.addEventListener("click", () => this.deleteSelectedItems());

    // Refresh button
    document
      .getElementById("refreshBtn")
      ?.addEventListener("click", () => this.refreshFileTree());

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "n":
            e.preventDefault();
            this.showNewRecipeModal();
            break;
          case "r":
            e.preventDefault();
            this.refreshFileTree();
            break;
          case "f":
            // Search focus is handled in search.js
            break;
        }
      }

      if (e.key === "Escape") {
        this.hideModal();
        this.hideFolderModal();
        // Search escape is handled in search.js
      }
    });
  }

  setupMobile() {
    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("overlay");

    const toggleMobileMenu = () => {
      const isActive = sidebar.classList.contains("active");

      sidebar.classList.toggle("active");
      overlay.classList.toggle("active");
      menuToggle.classList.toggle("active");

      // Prevent body scroll when menu is open
      document.body.style.overflow = isActive ? "" : "hidden";
    };

    menuToggle?.addEventListener("click", toggleMobileMenu);
    overlay?.addEventListener("click", toggleMobileMenu);

    // Store toggle function for external use
    this.toggleMobileMenu = toggleMobileMenu;
  }

  setupOverlayTouch() {
    const overlay = document.getElementById("overlay");
    overlay?.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        this.toggleMobileMenu();
      },
      { passive: false },
    );
  }

  // Search functionality (merged from SearchComponent)
  setupSearch() {
    this.isSearching = false;
    this.currentQuery = "";
    this.currentSearchType = "content";

    const searchInput = document.getElementById("searchInput");
    const searchClear = document.getElementById("searchClear");
    const searchFilters = document.querySelectorAll('input[name="searchType"]');

    searchInput?.addEventListener("input", (e) => {
      const query = e.target.value.trim();
      this.currentQuery = query;
      searchClear.style.display = query ? "block" : "none";

      if (query.length >= 2) {
        this.performSearch(query, this.currentSearchType);
      } else if (query.length === 0) {
        this.clearSearch();
      }
    });

    searchClear?.addEventListener("click", () => {
      searchInput.value = "";
      this.currentQuery = "";
      searchClear.style.display = "none";
      this.clearSearch();
      searchInput.focus();
    });

    searchFilters.forEach((filter) => {
      filter.addEventListener("change", (e) => {
        this.currentSearchType = e.target.value;
        if (this.currentQuery && this.currentQuery.length >= 2) {
          this.performSearch(this.currentQuery, this.currentSearchType);
        }
      });
    });

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInput?.focus();
      }
      if (e.key === "Escape" && document.activeElement === searchInput) {
        this.clearSearch();
        searchInput.blur();
      }
    });
  }

  async performSearch(query, searchType) {
    if (this.isSearching) return;
    this.isSearching = true;

    const searchResults = document.getElementById("searchResults");
    const searchResultsList = document.getElementById("searchResultsList");
    searchResults.style.display = "block";
    searchResultsList.innerHTML = '<div class="search-loading">Searching</div>';

    try {
      let results;
      if (searchType === "content") {
        results = await window.api.searchContent(query);
      } else {
        results = await window.api.searchFiles(query);
      }
      this.displaySearchResults(results, searchType);
    } catch (error) {
      console.error("Search failed:", error);
      searchResults.style.display = "block";
      searchResultsList.innerHTML = `<div class="search-empty" style="color: #ef4444;">${Utils.escapeHtml("Search failed: " + Utils.extractErrorMessage(error))}</div>`;
    } finally {
      this.isSearching = false;
    }
  }

  displaySearchResults(results, searchType) {
    const searchResults = document.getElementById("searchResults");
    const searchResultsCount = document.getElementById("searchResultsCount");
    const searchDuration = document.getElementById("searchDuration");
    const searchResultsList = document.getElementById("searchResultsList");

    searchResults.style.display = "block";
    const count = results.total || 0;
    searchResultsCount.textContent = `${count} result${count !== 1 ? "s" : ""}`;
    searchDuration.textContent = `(${results.duration_ms}ms)`;
    searchResultsList.innerHTML = "";

    if (count === 0) {
      searchResultsList.innerHTML =
        '<div class="search-empty">No results found</div>';
      return;
    }

    results.results.forEach((result) => {
      const a = document.createElement("a");
      a.className = "search-result-item";
      a.href = `/edit/${result.path}`;

      let typeLabel = "";
      let preview = "";
      let matches = "";

      if (searchType === "content") {
        typeLabel = '<span class="search-result-type content">Content</span>';
        preview = this.highlightSearchTerms(
          result.content_preview,
          this.currentQuery,
        );
        if (result.matches && result.matches.length > 0) {
          const matchTypes = result.matches.map((m) => m.type).join(", ");
          matches = `<div class="search-result-matches">Matches: ${matchTypes}</div>`;
        }
      } else {
        typeLabel = '<span class="search-result-type filename">File</span>';
        preview = result.path;
      }

      a.innerHTML = `
        <div class="search-result-title">
          ${Utils.escapeHtml(result.title || result.name)}
          ${typeLabel}
        </div>
        <div class="search-result-preview">${preview}</div>
        <div class="search-result-path">${Utils.escapeHtml(result.path)}</div>
        ${matches}
      `;
      searchResultsList.appendChild(a);
    });
  }

  highlightSearchTerms(text, query) {
    if (!text || !query) return Utils.escapeHtml(text);
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1);
    let highlightedText = Utils.escapeHtml(text);
    words.forEach((word) => {
      const regex = new RegExp(`(${Utils.escapeRegex(word)})`, "gi");
      highlightedText = highlightedText.replace(
        regex,
        '<span class="search-match-highlight">$1</span>',
      );
    });
    return highlightedText;
  }

  clearSearch() {
    const searchResults = document.getElementById("searchResults");
    searchResults.style.display = "none";
    this.currentQuery = "";
  }

  setupVirtualKeyboardHandling() {
    // Handle virtual keyboard show/hide
    let initialViewportHeight = window.visualViewport
      ? window.visualViewport.height
      : window.innerHeight;

    const handleViewportChange = () => {
      if (window.visualViewport) {
        const currentHeight = window.visualViewport.height;
        const heightDiff = initialViewportHeight - currentHeight;

        // If keyboard is likely open (height reduced by more than 150px)
        if (heightDiff > 150) {
          document.body.classList.add("keyboard-open");
        } else {
          document.body.classList.remove("keyboard-open");
        }
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportChange);
    } else {
      // Fallback for older browsers
      window.addEventListener("resize", handleViewportChange);
    }

    // Scroll input into view when focused
    const inputs = document.querySelectorAll("input, textarea");
    inputs.forEach((input) => {
      input.addEventListener("focus", () => {
        setTimeout(() => {
          input.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
      });
    });
  }

  setupGenericModal(config) {
    const { modalId, formId, closeBtnId, cancelBtnId, onClose, onSubmit } =
      config;
    const modal = document.getElementById(modalId);
    const form = document.getElementById(formId);
    const closeBtn = document.getElementById(closeBtnId);
    const cancelBtn = document.getElementById(cancelBtnId);

    closeBtn?.addEventListener("click", () => onClose());
    cancelBtn?.addEventListener("click", () => onClose());

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await onSubmit();
    });

    // Close modal when clicking outside
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) {
        onClose();
      }
    });
  }

  setupModal() {
    this.setupGenericModal({
      modalId: "newRecipeModal",
      formId: "newRecipeForm",
      closeBtnId: "modalClose",
      cancelBtnId: "cancelNew",
      onClose: () => this.hideModal(),
      onSubmit: () => this.createNewRecipe(),
    });
  }

  setupFolderModal() {
    this.setupGenericModal({
      modalId: "newFolderModal",
      formId: "newFolderForm",
      closeBtnId: "folderModalClose",
      cancelBtnId: "cancelNewFolder",
      onClose: () => this.hideFolderModal(),
      onSubmit: () => this.createNewFolder(),
    });
  }

  // File selection handler
  handleFileSelect(path) {
    if (window.innerWidth <= 768) {
      this.toggleMobileMenu();
    }
    this.onFileSelect(path);
  }

  // Modal methods
  showNewRecipeModal(defaultFolder = "") {
    const modal = document.getElementById("newRecipeModal");
    const titleInput = document.getElementById("recipeTitle");
    const folderInput = document.getElementById("recipeFolder");

    // Clear previous values FIRST
    document.getElementById("newRecipeForm").reset();

    // Set default folder AFTER reset if provided
    if (defaultFolder) {
      folderInput.value = defaultFolder;
    }

    // Load directories for autocomplete
    this.loadDirectoriesForAutocomplete?.();

    modal.classList.add("active");
    titleInput.focus();
  }

  hideModal() {
    const modal = document.getElementById("newRecipeModal");
    modal.classList.remove("active");
  }

  showNewFolderModal() {
    const modal = document.getElementById("newFolderModal");
    const folderInput = document.getElementById("folderName");

    // Clear previous values
    document.getElementById("newFolderForm").reset();

    modal.classList.add("active");
    folderInput.focus();
  }

  hideFolderModal() {
    const modal = document.getElementById("newFolderModal");
    modal.classList.remove("active");
  }

  // File operations
  async createNewRecipe() {
    try {
      const title = document.getElementById("recipeTitle").value.trim();
      const folder = document.getElementById("recipeFolder").value.trim();

      if (!title) {
        alert("Please enter a recipe title");
        return;
      }

      // Generate filename
      let filename = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();

      if (!filename.endsWith(".md")) {
        filename += ".md";
      }

      // Add folder path if specified
      let fullPath = filename;
      if (folder) {
        const folderName = folder
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-");
        fullPath = `${folderName}/${filename}`;
      }

      // Create the recipe
      await window.api.createRecipe(fullPath);

      // Refresh file tree and handle navigation
      await this.refreshFileTree();
      this.handleFileSelect(fullPath);

      this.hideModal();
      this.showSuccess("Recipe created successfully");
    } catch (error) {
      this.showError(
        "Failed to create recipe: " +
          Utils.extractErrorMessage(error, "Unknown error"),
      );
    }
  }

  async createNewFolder() {
    try {
      const folderName = document.getElementById("folderName").value.trim();

      if (!folderName) {
        alert("Please enter a folder name");
        return;
      }

      // Validate and sanitize folder name
      const sanitizedName = folderName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();

      if (!sanitizedName) {
        alert("Please enter a valid folder name");
        return;
      }

      // Check for duplicates by looking at existing directories
      const existingFolders = this.cachedFiles
        .filter((file) => file.type === "directory")
        .map((dir) => dir.name.toLowerCase());

      if (existingFolders.includes(sanitizedName)) {
        alert("A folder with this name already exists");
        return;
      }

      // Create the folder
      await this.fileTree.createFile(sanitizedName, true);

      // Refresh file tree and close modal
      await this.refreshFileTree();
      this.hideFolderModal();
      this.showSuccess("Folder created successfully");
    } catch (error) {
      this.showError(
        "Failed to create folder: " +
          Utils.extractErrorMessage(error, "Unknown error"),
      );
    }
  }

  setupFolderAutocomplete() {
    const folderInput = document.getElementById("recipeFolder");
    const dropdown = document.getElementById("recipeFolderDropdown");
    let directories = [];
    let selectedIndex = -1;

    // Load directories when modal opens
    const loadDirectories = () => {
      try {
        // Use cached files if available, otherwise empty array
        const files = this.cachedFiles || [];
        directories = files
          .filter((file) => file.type === "directory")
          .map((dir) => dir.path)
          .sort();
      } catch (error) {
        console.error("Failed to load directories:", error);
        directories = [];
      }
    };

    // Filter and show matching directories
    const showMatches = (value) => {
      if (!value.trim()) {
        dropdown.classList.remove("show");
        return;
      }

      const matches = directories.filter((dir) =>
        dir.toLowerCase().includes(value.toLowerCase()),
      );

      if (matches.length === 0) {
        dropdown.classList.remove("show");
        return;
      }

      dropdown.innerHTML = matches
        .map(
          (dir, index) =>
            `<div class="autocomplete-item" data-value="${dir}" data-index="${index}">
                    <span class="folder-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                    </span>${dir}
                </div>`,
        )
        .join("");

      dropdown.classList.add("show");
      selectedIndex = -1;
    };

    // Handle input events
    folderInput?.addEventListener("input", (e) => {
      showMatches(e.target.value);
    });

    // Handle keyboard navigation
    folderInput?.addEventListener("keydown", (e) => {
      const items = dropdown.querySelectorAll(".autocomplete-item");

      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        updateSelection(items);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        updateSelection(items);
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        items[selectedIndex].click();
      } else if (e.key === "Escape") {
        dropdown.classList.remove("show");
        selectedIndex = -1;
      }
    });

    // Handle item clicks
    dropdown?.addEventListener("click", (e) => {
      const item = e.target.closest(".autocomplete-item");
      if (item) {
        folderInput.value = item.dataset.value;
        dropdown.classList.remove("show");
        selectedIndex = -1;
      }
    });

    // Hide dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!folderInput?.contains(e.target) && !dropdown?.contains(e.target)) {
        dropdown?.classList.remove("show");
        selectedIndex = -1;
      }
    });

    // Update visual selection
    const updateSelection = (items) => {
      items.forEach((item, index) => {
        item.classList.toggle("selected", index === selectedIndex);
      });
    };

    // Load directories when modal is shown
    this.loadDirectoriesForAutocomplete = loadDirectories;
  }

  // Utility methods
  async refreshFileTree() {
    try {
      // Load files once
      const files = await window.api.listFiles();

      // Update file tree
      this.fileTree.setFiles(files);

      // Update cached files for autocomplete
      this.cachedFiles = files;

      // Notify that files are loaded
      this.onFilesLoaded(files);
    } catch (error) {
      console.error("Failed to load files:", error);
      this.showError(
        "Failed to load files: " + Utils.extractErrorMessage(error),
      );
    }
  }

  showSuccess(message) {
    this.showToast(message, "success");
  }

  showError(message) {
    this.showToast(message, "error");
  }

  showToast(message, type = "info") {
    // Simple toast notification
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icon =
      type === "error"
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    toast.innerHTML = `${icon}<span>${Utils.escapeHtml(message)}</span>`;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "slideOut 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Edit mode functionality
  toggleEditMode() {
    if (this.fileTree) {
      this.fileTree.toggleEditMode();
    }
  }

  async deleteSelectedItems() {
    if (!this.fileTree) return;

    const selectedItems = this.fileTree.getSelectedItems();
    if (selectedItems.length === 0) {
      alert("No items selected");
      return;
    }

    const itemNames = selectedItems
      .map((path) => path.split("/").pop())
      .join(", ");
    const confirmed = confirm(
      `Are you sure you want to delete ${selectedItems.length} item(s)?\n\n${itemNames}\n\nThis action cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      // Delete items in parallel
      const deletePromises = selectedItems.map(async (path) => {
        // Determine if it's a directory by checking if the item itself is marked as directory
        // or if any files exist within this path
        const fileObject = this.cachedFiles.find((file) => file.path === path);
        const isDirectory =
          (fileObject && fileObject.type === "directory") ||
          this.cachedFiles.some(
            (file) => file.path !== path && file.path.startsWith(path + "/"),
          );

        if (isDirectory) {
          return window.api.deleteDirectory(path);
        } else {
          return window.api.deleteFile(path);
        }
      });

      await Promise.all(deletePromises);

      // Exit edit mode and refresh
      this.fileTree.toggleEditMode();
      await this.refreshFileTree();

      // Notify about deletions for URL updates
      selectedItems.forEach((path) => {
        this.onFileDeleted?.(path);
      });

      this.showSuccess(`Successfully deleted ${selectedItems.length} item(s)`);
    } catch (error) {
      console.error("Failed to delete items:", error);
      this.showError(
        "Failed to delete some items: " + Utils.extractErrorMessage(error),
      );
    }
  }

  // Optional callbacks that can be set by parent classes
  setCallbacks(callbacks) {
    this.onFileRenamed = callbacks.onFileRenamed;
    this.onFileDeleted = callbacks.onFileDeleted;
  }
}
