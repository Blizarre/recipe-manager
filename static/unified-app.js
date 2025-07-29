// Unified Recipe Manager Application
class UnifiedRecipeApp {
    constructor() {
        this.currentFile = null;
        this.editor = null;
        this.isLoading = false;
        this.sidebar = null;
        this.mobileFileTree = null;
        
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
            (files) => this.onFilesLoaded(files)
        );

        // Initialize mobile file tree (for the welcome screen)
        const mobileFileTreeContainer = document.getElementById('mobileFileTree');
        if (mobileFileTreeContainer) {
            this.mobileFileTree = new FileTree(
                mobileFileTreeContainer,
                (path) => this.onFileSelect(path),
                (event, path, type) => this.sidebar.onContextMenu(event, path, type)
            );
        }

        // Set callbacks for file operations that affect current URL
        this.sidebar.setCallbacks({
            onFileRenamed: (oldPath, newPath) => this.handleFileRenamed(oldPath, newPath),
            onFileDeleted: (deletedPath) => this.handleFileDeleted(deletedPath)
        });
    }

    setupEventListeners() {
        // Mobile new recipe button
        document.getElementById('mobileNewBtn')?.addEventListener('click', () => this.sidebar.showNewRecipeModal());
        
        // Save and share buttons (only active in editor mode)
        document.getElementById('saveBtn')?.addEventListener('click', () => this.editor?.save());
        document.getElementById('shareBtn')?.addEventListener('click', () => this.shareUrl());

        // Keyboard shortcut for save
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (this.editor) {
                    this.editor.save();
                }
            }
        });
    }

    setupResponsiveButtons() {
        const moveButtons = () => {
            const saveBtn = document.getElementById('saveBtn');
            const shareBtn = document.getElementById('shareBtn');
            const headerActions = document.querySelector('.header-actions');
            const actionButtons = document.querySelector('.action-buttons');
            
            if (!saveBtn || !shareBtn || !headerActions || !actionButtons) return;
            
            if (window.innerWidth <= 768) {
                // Mobile: keep buttons in header
                if (!headerActions.contains(saveBtn)) {
                    headerActions.insertBefore(saveBtn, document.getElementById('mobileNewBtn'));
                }
                if (!headerActions.contains(shareBtn)) {
                    headerActions.insertBefore(shareBtn, document.getElementById('mobileNewBtn'));
                }
            } else {
                // Desktop: move buttons to editor header
                if (!actionButtons.contains(saveBtn)) {
                    actionButtons.appendChild(saveBtn);
                }
                if (!actionButtons.contains(shareBtn)) {
                    actionButtons.appendChild(shareBtn);
                }
            }
        };
        
        // Initial positioning and resize listener
        moveButtons();
        window.addEventListener('resize', moveButtons);
    }

    extractPathFromUrl() {
        const pathname = window.location.pathname;
        const editPrefix = '/edit/';
        
        if (pathname === '/' || !pathname.startsWith(editPrefix)) {
            return null;
        }
        
        return pathname.substring(editPrefix.length);
    }

    updateInterface() {
        const initialLoading = document.getElementById('initialLoading');
        const welcomeScreen = document.getElementById('welcomeScreen');
        const editorInterface = document.getElementById('editorInterface');
        const sidebar = document.getElementById('sidebar');
        
        // Hide initial loading
        if (initialLoading) {
            initialLoading.style.display = 'none';
        }
        
        if (this.currentFile) {
            // Editor mode - hide welcome, show editor
            welcomeScreen.style.display = 'none';
            editorInterface.style.display = 'block';
            
            // Update page info
            this.updatePageInfo();
        } else {
            // Welcome mode - show welcome, hide editor, ensure sidebar is visible
            welcomeScreen.style.display = 'block';
            editorInterface.style.display = 'none';
            
            // Ensure sidebar is visible in welcome mode
            sidebar.classList.add('sidebar-open');
            
            // Update title
            document.title = 'Recipe Manager';
            document.getElementById('fileName').textContent = 'Recipe Manager';
        }
    }

    updatePageInfo() {
        if (!this.currentFile) return;
        
        const fileName = this.currentFile.split('/').pop();
        document.title = `${fileName} - Recipe Manager`;
        
        // Update file name displays
        const fileNameMobile = document.getElementById('fileName');
        const fileNameDesktop = document.getElementById('fileNameDesktop');
        
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
            window.addEventListener('codemirror-ready', async () => {
                await this.setupEditor();
                this.loadRecipeContent();
            });
        }
    }

    async setupEditor() {
        try {
            const editorContainer = document.getElementById('editorContainer');
            this.editor = new CodeMirrorEditor(
                editorContainer,
                () => this.onContentChange()
            );
        } catch (error) {
            console.error('Failed to setup editor:', error);
            this.showError('Failed to initialize editor');
        }
    }

    async loadRecipeContent() {
        if (!this.editor || !this.currentFile || this.isLoading) {
            return;
        }
        
        this.isLoading = true;
        this.showStatus('Loading recipe...');

        try {
            const response = await window.api.getFile(this.currentFile);
            
            // Load content into editor
            this.editor.currentFile = this.currentFile;
            this.editor.setContent(response.content || '');
            this.editor.lastSavedContent = response.content || '';
            this.editor.isDirty = false;
            this.editor.updateUI();
            
            // Hide loading and show editor
            this.showEditorContent();
            
            this.showStatus('Recipe loaded');
            
        } catch (error) {
            console.error('Failed to load recipe:', error);
            this.showError('Failed to load recipe: ' + Utils.extractErrorMessage(error));
            // Still show editor on error (user can see the error)
            this.showEditorContent();
        } finally {
            this.isLoading = false;
        }
    }

    showEditorContent() {
        const editorLoading = document.getElementById('editorLoading');
        const editorPanel = document.getElementById('editorPanel');
        const editorStatus = document.querySelector('.editor-status');
        
        if (editorLoading) {
            editorLoading.style.display = 'none';
        }
        if (editorPanel) {
            editorPanel.style.display = 'block';
        }
        if (editorStatus) {
            editorStatus.style.display = 'block';
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
            // Navigate to editor mode with selected file
            window.history.pushState({}, '', `/edit/${path}`);
            this.currentFile = path;
            this.updateInterface();
            this.initializeEditorMode();
        }
    }

    onContentChange() {
        // Called when editor content changes
        // The CodeMirrorEditor class handles auto-save and UI updates
    }

    // Handle file operations that affect current URL
    handleFileRenamed(oldPath, newPath) {
        if (oldPath === this.currentFile) {
            window.history.replaceState({}, '', `/edit/${newPath}`);
            this.currentFile = newPath;
            this.updatePageInfo();
        }
    }

    handleFileDeleted(deletedPath) {
        if (deletedPath === this.currentFile) {
            // Navigate back to welcome screen
            window.history.pushState({}, '', '/');
            this.currentFile = null;
            this.updateInterface();
        }
    }

    shareUrl() {
        if (!this.currentFile) return;
        
        const currentUrl = window.location.href;
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(currentUrl).then(() => {
                this.showSuccess('Recipe URL copied to clipboard!');
            }).catch(() => {
                this.fallbackCopyUrl(currentUrl);
            });
        } else {
            this.fallbackCopyUrl(currentUrl);
        }
    }

    fallbackCopyUrl(url) {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showSuccess('Recipe URL copied to clipboard!');
        } catch (err) {
            this.showError('Could not copy URL. Please copy manually from address bar.');
        } finally {
            document.body.removeChild(textArea);
        }
    }

    showStatus(message) {
        const statusElement = document.getElementById('fileStatus');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        if (this.sidebar) {
            this.sidebar.showToast(message, type);
        }
    }
}

// Initialize the unified app
document.addEventListener('DOMContentLoaded', () => {
    new UnifiedRecipeApp();
});

// Handle browser back/forward navigation
window.addEventListener('popstate', () => {
    // Reload the page to handle navigation properly
    window.location.reload();
});