// Main Application
class RecipeApp {
    constructor() {
        this.sidebar = null;
        this.mobileFileTree = null;
        
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
    }

    setupComponents() {
        // Initialize shared sidebar manager with callback for file loading
        this.sidebar = new SidebarManager(
            (path) => this.onFileSelect(path),
            (files) => this.onFilesLoaded(files)
        );

        // Initialize mobile file tree (for the welcome screen)
        const mobileFileTreeContainer = document.getElementById('mobileFileTree');
        this.mobileFileTree = new FileTree(
            mobileFileTreeContainer,
            (path) => this.onFileSelect(path),
            (event, path, type) => this.sidebar.onContextMenu(event, path, type)
        );
    }

    onFilesLoaded(files) {
        // Update mobile file tree whenever sidebar loads files
        if (this.mobileFileTree) {
            this.mobileFileTree.setFiles(files);
        }
    }

    setupEventListeners() {
        // Mobile new recipe button
        document.getElementById('mobileNewBtn')?.addEventListener('click', () => this.sidebar.showNewRecipeModal());
    }

    // Event handlers
    async onFileSelect(path) {
        if (path) {
            // Navigate to editor page for consistent experience
            window.location.href = `/edit/${path}`;
        }
    }

}

// Initialize the app
const app = new RecipeApp();

// Make app globally accessible for editor integration
window.app = app;