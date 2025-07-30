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
        const fileTreeContainer = document.getElementById('fileTree');
        this.fileTree = new FileTree(
            fileTreeContainer,
            (path) => this.handleFileSelect(path)
        );

        // Initialize search component
        this.search = new SearchComponent(
            (path) => this.handleFileSelect(path)
        );

        // Initialize touch gestures (mobile only)
        if (window.innerWidth <= 768) {
            this.touchGestures = new TouchGesturesHandler(this);
            this.setupVirtualKeyboardHandling();
        }

    }

    setupEventListeners() {
        // New recipe buttons
        document.getElementById('desktopNewBtn')?.addEventListener('click', () => this.showNewRecipeModal());
        
        // New folder button
        document.getElementById('newFolderBtn')?.addEventListener('click', () => this.showNewFolderModal());
        
        // Edit mode button
        document.getElementById('editModeBtn')?.addEventListener('click', () => this.toggleEditMode());
        
        // Delete selected button
        document.getElementById('deleteSelectedBtn')?.addEventListener('click', () => this.deleteSelectedItems());

        // Refresh button
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.refreshFileTree());


        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'n':
                        e.preventDefault();
                        this.showNewRecipeModal();
                        break;
                    case 'r':
                        e.preventDefault();
                        this.refreshFileTree();
                        break;
                    case 'f':
                        // Search focus is handled in search.js
                        break;
                }
            }
            
            if (e.key === 'Escape') {
                this.hideModal();
                this.hideFolderModal();
                // Search escape is handled in search.js
            }
        });
    }

    setupMobile() {
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');

        const toggleMobileMenu = () => {
            const isActive = sidebar.classList.contains('active');
            
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
            menuToggle.classList.toggle('active');
            
            // Prevent body scroll when menu is open
            document.body.style.overflow = isActive ? '' : 'hidden';
        };

        menuToggle?.addEventListener('click', toggleMobileMenu);
        overlay?.addEventListener('click', toggleMobileMenu);

        // Store toggle function for external use
        this.toggleMobileMenu = toggleMobileMenu;
    }

    setupVirtualKeyboardHandling() {
        // Handle virtual keyboard show/hide
        let initialViewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        
        const handleViewportChange = () => {
            if (window.visualViewport) {
                const currentHeight = window.visualViewport.height;
                const heightDiff = initialViewportHeight - currentHeight;
                
                // If keyboard is likely open (height reduced by more than 150px)
                if (heightDiff > 150) {
                    document.body.classList.add('keyboard-open');
                } else {
                    document.body.classList.remove('keyboard-open');
                }
            }
        };

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleViewportChange);
        } else {
            // Fallback for older browsers
            window.addEventListener('resize', handleViewportChange);
        }

        // Scroll input into view when focused
        const inputs = document.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                setTimeout(() => {
                    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            });
        });
    }

    setupModal() {
        const modal = document.getElementById('newRecipeModal');
        const form = document.getElementById('newRecipeForm');
        const closeBtn = document.getElementById('modalClose');
        const cancelBtn = document.getElementById('cancelNew');

        closeBtn?.addEventListener('click', () => this.hideModal());
        cancelBtn?.addEventListener('click', () => this.hideModal());

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createNewRecipe();
        });

        // Close modal when clicking outside
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideModal();
            }
        });
    }

    setupFolderModal() {
        const modal = document.getElementById('newFolderModal');
        const form = document.getElementById('newFolderForm');
        const closeBtn = document.getElementById('folderModalClose');
        const cancelBtn = document.getElementById('cancelNewFolder');

        closeBtn?.addEventListener('click', () => this.hideFolderModal());
        cancelBtn?.addEventListener('click', () => this.hideFolderModal());

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createNewFolder();
        });

        // Close modal when clicking outside
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideFolderModal();
            }
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
    showNewRecipeModal(defaultFolder = '') {
        const modal = document.getElementById('newRecipeModal');
        const titleInput = document.getElementById('recipeTitle');
        const folderInput = document.getElementById('recipeFolder');
        
        // Clear previous values FIRST
        document.getElementById('newRecipeForm').reset();
        
        // Set default folder AFTER reset if provided
        if (defaultFolder) {
            folderInput.value = defaultFolder;
        }
        
        // Load directories for autocomplete
        this.loadDirectoriesForAutocomplete?.();
        
        modal.classList.add('active');
        titleInput.focus();
    }

    hideModal() {
        const modal = document.getElementById('newRecipeModal');
        modal.classList.remove('active');
    }

    showNewFolderModal() {
        const modal = document.getElementById('newFolderModal');
        const folderInput = document.getElementById('folderName');
        
        // Clear previous values
        document.getElementById('newFolderForm').reset();
        
        modal.classList.add('active');
        folderInput.focus();
    }

    hideFolderModal() {
        const modal = document.getElementById('newFolderModal');
        modal.classList.remove('active');
    }


    // File operations
    async createNewRecipe() {
        try {
            const title = document.getElementById('recipeTitle').value.trim();
            const folder = document.getElementById('recipeFolder').value.trim();

            if (!title) {
                alert('Please enter a recipe title');
                return;
            }

            // Generate filename
            let filename = title.toLowerCase()
                               .replace(/[^a-z0-9\s-]/g, '')
                               .replace(/\s+/g, '-')
                               .replace(/-+/g, '-')
                               .trim();
            
            if (!filename.endsWith('.md')) {
                filename += '.md';
            }

            // Add folder path if specified
            let fullPath = filename;
            if (folder) {
                const folderName = folder.toLowerCase()
                                        .replace(/[^a-z0-9\s-]/g, '')
                                        .replace(/\s+/g, '-');
                fullPath = `${folderName}/${filename}`;
            }

            // Create the recipe
            await window.api.createRecipe(fullPath);

            // Refresh file tree and handle navigation
            await this.refreshFileTree();
            this.handleFileSelect(fullPath);
            
            this.hideModal();
            this.showSuccess('Recipe created successfully');

        } catch (error) {
            this.showError('Failed to create recipe: ' + Utils.extractErrorMessage(error, 'Unknown error'));
        }
    }

    async createNewFolder() {
        try {
            const folderName = document.getElementById('folderName').value.trim();

            if (!folderName) {
                alert('Please enter a folder name');
                return;
            }

            // Validate and sanitize folder name
            const sanitizedName = folderName.toLowerCase()
                                           .replace(/[^a-z0-9\s-]/g, '')
                                           .replace(/\s+/g, '-')
                                           .replace(/-+/g, '-')
                                           .trim();

            if (!sanitizedName) {
                alert('Please enter a valid folder name');
                return;
            }

            // Check for duplicates by looking at existing directories
            const existingFolders = this.cachedFiles
                .filter(file => file.type === 'directory')
                .map(dir => dir.name.toLowerCase());

            if (existingFolders.includes(sanitizedName)) {
                alert('A folder with this name already exists');
                return;
            }

            // Create the folder
            await this.fileTree.createFile(sanitizedName, true);

            // Refresh file tree and close modal
            await this.refreshFileTree();
            this.hideFolderModal();
            this.showSuccess('Folder created successfully');

        } catch (error) {
            this.showError('Failed to create folder: ' + Utils.extractErrorMessage(error, 'Unknown error'));
        }
    }

    async renameItem() {
        const currentName = this.currentContextPath.split('/').pop();
        const newName = prompt(`Rename ${this.currentContextType}:`, currentName);
        
        if (newName && newName !== currentName) {
            try {
                const pathParts = this.currentContextPath.split('/');
                pathParts[pathParts.length - 1] = newName;
                const newPath = pathParts.join('/');
                
                await this.fileTree.renameFile(this.currentContextPath, newPath);
                this.showSuccess(`${this.currentContextType} renamed successfully`);
                
                // Notify about file rename for URL updates
                this.onFileRenamed?.(this.currentContextPath, newPath);
            } catch (error) {
                this.showError(Utils.extractErrorMessage(error, 'Failed to rename item'));
            }
        }
    }

    async deleteItem() {
        const itemName = this.currentContextPath.split('/').pop();
        const confirmed = confirm(`Are you sure you want to delete "${itemName}"?`);
        
        if (confirmed) {
            try {
                await this.fileTree.deleteFile(
                    this.currentContextPath, 
                    this.currentContextType === 'directory'
                );
                this.showSuccess(`${this.currentContextType} deleted successfully`);
                
                // Notify about file deletion for URL updates
                this.onFileDeleted?.(this.currentContextPath);
            } catch (error) {
                this.showError(Utils.extractErrorMessage(error, 'Failed to delete item'));
            }
        }
    }

    setupFolderAutocomplete() {
        const folderInput = document.getElementById('recipeFolder');
        const dropdown = document.getElementById('recipeFolderDropdown');
        let directories = [];
        let selectedIndex = -1;

        // Load directories when modal opens
        const loadDirectories = () => {
            try {
                // Use cached files if available, otherwise empty array
                const files = this.cachedFiles || [];
                directories = files
                    .filter(file => file.type === 'directory')
                    .map(dir => dir.path)
                    .sort();
            } catch (error) {
                console.error('Failed to load directories:', error);
                directories = [];
            }
        };

        // Filter and show matching directories
        const showMatches = (value) => {
            if (!value.trim()) {
                dropdown.classList.remove('show');
                return;
            }

            const matches = directories.filter(dir => 
                dir.toLowerCase().includes(value.toLowerCase())
            );

            if (matches.length === 0) {
                dropdown.classList.remove('show');
                return;
            }

            dropdown.innerHTML = matches.map((dir, index) => 
                `<div class="autocomplete-item" data-value="${dir}" data-index="${index}">
                    <span class="folder-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                    </span>${dir}
                </div>`
            ).join('');

            dropdown.classList.add('show');
            selectedIndex = -1;
        };

        // Handle input events
        folderInput?.addEventListener('input', (e) => {
            showMatches(e.target.value);
        });

        // Handle keyboard navigation
        folderInput?.addEventListener('keydown', (e) => {
            const items = dropdown.querySelectorAll('.autocomplete-item');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                updateSelection(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                updateSelection(items);
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                items[selectedIndex].click();
            } else if (e.key === 'Escape') {
                dropdown.classList.remove('show');
                selectedIndex = -1;
            }
        });

        // Handle item clicks
        dropdown?.addEventListener('click', (e) => {
            const item = e.target.closest('.autocomplete-item');
            if (item) {
                folderInput.value = item.dataset.value;
                dropdown.classList.remove('show');
                selectedIndex = -1;
            }
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!folderInput?.contains(e.target) && !dropdown?.contains(e.target)) {
                dropdown?.classList.remove('show');
                selectedIndex = -1;
            }
        });

        // Update visual selection
        const updateSelection = (items) => {
            items.forEach((item, index) => {
                item.classList.toggle('selected', index === selectedIndex);
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
            console.error('Failed to load files:', error);
            this.showError('Failed to load files: ' + Utils.extractErrorMessage(error));
        }
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        // Simple toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? 'var(--error-color)' : 'var(--success-color)'};
            color: white;
            padding: 12px 16px;
            border-radius: var(--radius);
            box-shadow: var(--shadow-lg);
            z-index: 1001;
            animation: slideIn 0.3s ease;
            max-width: 300px;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
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
            alert('No items selected');
            return;
        }
        
        const itemNames = selectedItems.map(path => path.split('/').pop()).join(', ');
        const confirmed = confirm(`Are you sure you want to delete ${selectedItems.length} item(s)?\n\n${itemNames}\n\nThis action cannot be undone.`);
        
        if (!confirmed) return;
        
        try {
            // Delete items in parallel
            const deletePromises = selectedItems.map(async (path) => {
                // Determine if it's a directory by checking if the item itself is marked as directory
                // or if any files exist within this path
                const fileObject = this.cachedFiles.find(file => file.path === path);
                const isDirectory = (fileObject && fileObject.type === 'directory') ||
                    this.cachedFiles.some(file => 
                        file.path !== path && file.path.startsWith(path + '/')
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
            selectedItems.forEach(path => {
                this.onFileDeleted?.(path);
            });
            
            this.showSuccess(`Successfully deleted ${selectedItems.length} item(s)`);
            
        } catch (error) {
            console.error('Failed to delete items:', error);
            this.showError('Failed to delete some items: ' + Utils.extractErrorMessage(error));
        }
    }

    // Optional callbacks that can be set by parent classes
    setCallbacks(callbacks) {
        this.onFileRenamed = callbacks.onFileRenamed;
        this.onFileDeleted = callbacks.onFileDeleted;
    }
}