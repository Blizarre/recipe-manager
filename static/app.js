// Main Application
class RecipeApp {
    constructor() {
        this.fileTree = null;
        this.editor = null;
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

        // Initialize markdown editor
        const editorContainer = document.getElementById('codemirrorContainer');
        this.editor = new MarkdownEditor(
            editorContainer,
            () => this.onEditorChange()
        );

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
        document.getElementById('validateBtn')?.addEventListener('click', () => this.editor.validate());
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.fileTree.refresh());

        // Modal handling
        this.setupModal();

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
                }
            }
            
            if (e.key === 'Escape') {
                this.hideContextMenu();
                this.hideModal();
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
            this.showNewRecipeModal();
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
        // This could trigger auto-validation, status updates, etc.
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
    showNewRecipeModal() {
        const modal = document.getElementById('newRecipeModal');
        const titleInput = document.getElementById('recipeTitle');
        
        modal.classList.add('active');
        titleInput.focus();
        
        // Clear previous values
        document.getElementById('newRecipeForm').reset();
        document.getElementById('useTemplate').checked = true;
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
            const useTemplate = document.getElementById('useTemplate').checked;

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
            if (useTemplate) {
                await window.api.createRecipe(fullPath, true);
            } else {
                await window.api.createFile(fullPath, '');
            }

            // Refresh file tree and open the new file
            await this.fileTree.refresh();
            await this.onFileSelect(fullPath);
            
            this.hideModal();
            this.showSuccess('Recipe created successfully');

        } catch (error) {
            this.showError('Failed to create recipe: ' + error.message);
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
                this.showError(error.message);
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
                this.showError(error.message);
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
                this.showError(error.message);
            }
        }
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