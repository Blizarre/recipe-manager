// Main Application
class RecipeApp {
    constructor() {
        this.sidebar = null;
        this.mobileFileTree = null;
        this.editor = null;
        
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
        // Initialize shared sidebar manager
        this.sidebar = new SidebarManager((path) => this.onFileSelect(path));

        // Initialize mobile file tree (for the welcome screen)
        const mobileFileTreeContainer = document.getElementById('mobileFileTree');
        this.mobileFileTree = new FileTree(
            mobileFileTreeContainer,
            (path) => this.onFileSelect(path),
            (event, path, type) => this.sidebar.onContextMenu(event, path, type)
        );

        // Initialize CodeMirror editor
        const editorContainer = document.getElementById('editorContainer');
        this.editor = new CodeMirrorEditor(
            editorContainer,
            () => this.onEditorChange()
        );

        // Share files between sidebar and mobile tree
        this.shareFileData();
    }

    async shareFileData() {
        // Override sidebar's refresh to also update mobile tree
        const originalRefresh = this.sidebar.refreshFileTree.bind(this.sidebar);
        this.sidebar.refreshFileTree = async () => {
            await originalRefresh();
            if (this.mobileFileTree) {
                this.mobileFileTree.setFiles(this.sidebar.cachedFiles);
            }
        };
    }

    setupEventListeners() {
        // Mobile new recipe button
        document.getElementById('mobileNewBtn')?.addEventListener('click', () => this.sidebar.showNewRecipeModal());

        // Editor actions
        document.getElementById('saveBtn')?.addEventListener('click', () => this.editor.save());
    }

    // Event handlers
    async onFileSelect(path) {
        if (path) {
            await this.editor.loadFile(path);
        } else {
            this.editor.clear();
        }
    }

    onEditorChange() {
        // Update UI based on editor state
        // This could trigger status updates, etc.
    }
}

// Initialize the app
const app = new RecipeApp();

// Make app globally accessible for editor integration
window.app = app;