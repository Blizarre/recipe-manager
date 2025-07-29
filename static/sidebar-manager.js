// Shared Sidebar Management Component
class SidebarManager {
    constructor(onFileSelect, onFilesLoaded) {
        this.onFileSelect = onFileSelect || (() => {});
        this.onFilesLoaded = onFilesLoaded || (() => {});
        this.fileTree = null;
        this.search = null;
        this.contextMenu = null;
        this.currentContextPath = null;
        this.currentContextType = null;
        this.cachedFiles = [];
        
        this.init();
    }

    init() {
        this.setupComponents();
        this.setupEventListeners();
        this.setupMobile();
        this.setupModal();
        this.setupFolderAutocomplete();
        this.setupContextMenu();
        
        // Initial load of file tree
        this.refreshFileTree();
    }

    setupComponents() {
        // Initialize file tree
        const fileTreeContainer = document.getElementById('fileTree');
        this.fileTree = new FileTree(
            fileTreeContainer,
            (path) => this.handleFileSelect(path),
            (event, path, type) => this.onContextMenu(event, path, type)
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

        // Setup context menu
        this.contextMenu = document.getElementById('contextMenu');
    }

    setupEventListeners() {
        // New recipe buttons
        document.getElementById('desktopNewBtn')?.addEventListener('click', () => this.showNewRecipeModal());

        // Refresh button
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.refreshFileTree());

        // Global click handler to close context menu
        document.addEventListener('click', () => this.hideContextMenu());
        
        // Prevent context menu on right click (we handle it ourselves)
        document.addEventListener('contextmenu', (e) => {
            if (!e.target.closest('.file-tree-item')) {
                e.preventDefault();
            }
        });

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
                this.hideContextMenu();
                this.hideModal();
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

    setupContextMenu() {
        document.getElementById('contextOpen')?.addEventListener('click', () => {
            if (this.currentContextType === 'file') {
                this.handleFileSelect(this.currentContextPath);
            }
            this.hideContextMenu();
        });

        document.getElementById('contextRename')?.addEventListener('click', () => {
            this.renameItem();
            this.hideContextMenu();
        });

        document.getElementById('contextDelete')?.addEventListener('click', () => {
            this.deleteItem();
            this.hideContextMenu();
        });

        document.getElementById('contextNewFile')?.addEventListener('click', () => {
            // Pass directory path if context menu was opened on a directory
            const defaultFolder = this.currentContextType === 'directory' ? this.currentContextPath : '';
            this.showNewRecipeModal(defaultFolder);
            this.hideContextMenu();
        });

        document.getElementById('contextNewFolder')?.addEventListener('click', () => {
            this.createNewFolder();
            this.hideContextMenu();
        });
    }

    // File selection handler
    handleFileSelect(path) {
        if (window.innerWidth <= 768) {
            this.toggleMobileMenu();
        }
        this.onFileSelect(path);
    }

    // Context menu handler
    onContextMenu(event, path, type) {
        event.preventDefault();
        event.stopPropagation();
        
        this.currentContextPath = path;
        this.currentContextType = type;
        
        // Position context menu
        const rect = this.contextMenu.getBoundingClientRect();
        let x = event.clientX;
        let y = event.clientY;
        
        // Ensure menu stays within viewport
        if (x + rect.width > window.innerWidth) {
            x = window.innerWidth - rect.width - 10;
        }
        if (y + rect.height > window.innerHeight) {
            y = window.innerHeight - rect.height - 10;
        }
        
        this.contextMenu.style.left = `${x}px`;
        this.contextMenu.style.top = `${y}px`;
        this.contextMenu.classList.add('active');
        
        // Update context menu items based on type
        document.getElementById('contextOpen').style.display = type === 'file' ? 'block' : 'none';
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

    hideContextMenu() {
        this.contextMenu.classList.remove('active');
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
        const folderName = prompt('Enter folder name:');
        if (folderName) {
            try {
                const sanitizedName = folderName.toLowerCase()
                                               .replace(/[^a-z0-9\s-]/g, '')
                                               .replace(/\s+/g, '-');
                
                await this.fileTree.createFile(sanitizedName, true);
                this.showSuccess('Folder created successfully');
            } catch (error) {
                this.showError(Utils.extractErrorMessage(error, 'Failed to create folder'));
            }
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
                    <span class="folder-icon">📁</span>${dir}
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

    // Optional callbacks that can be set by parent classes
    setCallbacks(callbacks) {
        this.onFileRenamed = callbacks.onFileRenamed;
        this.onFileDeleted = callbacks.onFileDeleted;
    }
}