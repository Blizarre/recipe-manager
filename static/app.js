// Main Application
class RecipeApp {
    constructor() {
        this.fileTree = null;
        this.editor = null;
        this.search = null;
        this.contextMenu = null;
        this.currentContextPath = null;
        this.currentContextType = null;
        
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.setupComponents();
        this.setupEventListeners();
        this.setupMobile();
    }

    setupComponents() {
        // Initialize file tree
        const fileTreeContainer = document.getElementById('fileTree');
        this.fileTree = new FileTree(
            fileTreeContainer,
            (path) => this.onFileSelect(path),
            (event, path, type) => this.onContextMenu(event, path, type)
        );

        // Initialize simple markdown editor
        const editorContainer = document.getElementById('editorContainer');
        this.editor = new SimpleMarkdownEditor(
            editorContainer,
            () => this.onEditorChange()
        );

        // Initialize search component
        this.search = new SearchComponent(
            (path) => this.onFileSelect(path)
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
        document.getElementById('mobileNewBtn')?.addEventListener('click', () => this.showNewRecipeModal());
        document.getElementById('welcomeNewBtn')?.addEventListener('click', () => this.showNewRecipeModal());

        // Editor actions
        document.getElementById('saveBtn')?.addEventListener('click', () => this.editor.save());
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.fileTree.refresh());

        // Modal handling  
        this.setupModal();
        
        // Setup autocomplete for folder input
        this.setupFolderAutocomplete();

        // Context menu handling
        this.setupContextMenu();

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
                        this.fileTree.refresh();
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

        // Close mobile menu when file is selected
        this.onFileSelectMobile = (path) => {
            if (window.innerWidth <= 768) {
                toggleMobileMenu();
            }
        };
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
                this.onFileSelect(this.currentContextPath);
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

    // Event handlers
    async onFileSelect(path) {
        if (path) {
            await this.editor.loadFile(path);
            this.onFileSelectMobile?.(path);
        } else {
            this.editor.clear();
        }
    }

    onEditorChange() {
        // Update UI based on editor state
        // This could trigger status updates, etc.
    }

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

            // Refresh file tree and open the new file
            await this.fileTree.refresh();
            await this.onFileSelect(fullPath);
            
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
        const loadDirectories = async () => {
            try {
                const files = await window.api.listFiles();
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
    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showError(message) {
        this.showMessage(message, 'error');
    }


    showMessage(message, type = 'info') {
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
}

// Initialize the app
const app = new RecipeApp();

// Make app globally accessible for editor integration
window.app = app;