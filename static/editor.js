// Standalone Recipe Editor with Shared Sidebar
class StandaloneRecipeEditor {
    constructor() {
        this.recipePath = null;
        this.editor = null;
        this.isLoading = false;
        this.sidebar = null;
        
        this.init();
    }

    init() {
        // Extract recipe path from URL
        this.recipePath = this.extractPathFromUrl();
        
        if (!this.recipePath) {
            this.showError('Invalid recipe URL');
            return;
        }

        // Update page title and file info
        this.updatePageInfo();
        
        // Setup responsive button positioning
        this.setupResponsiveButtons();
        
        // Setup components
        this.setupComponents();
        this.setupEventListeners();
        
        // Initialize editor once CodeMirror is ready, then load content
        if (window.CodeMirrorReady) {
            this.setupEditor().then(() => this.loadRecipeContent());
        } else {
            window.addEventListener('codemirror-ready', () => {
                this.setupEditor().then(() => this.loadRecipeContent());
            });
        }
    }

    setupComponents() {
        // Initialize shared sidebar manager with editor-specific file selection
        this.sidebar = new SidebarManager(
            (path) => this.onFileSelect(path),
            () => {} // No files loaded callback needed for editor page
        );
        
        // Set callbacks for file operations that affect current URL
        this.sidebar.setCallbacks({
            onFileRenamed: (oldPath, newPath) => this.handleFileRenamed(oldPath, newPath),
            onFileDeleted: (deletedPath) => this.handleFileDeleted(deletedPath)
        });
    }

    setupResponsiveButtons() {
        const moveButtons = () => {
            const saveBtn = document.getElementById('saveBtn');
            const shareBtn = document.getElementById('shareBtn');
            const headerActions = document.querySelector('.header-actions');
            const actionButtons = document.querySelector('.action-buttons');
            
            if (window.innerWidth <= 768) {
                // Mobile: keep buttons in header
                if (saveBtn && !headerActions.contains(saveBtn)) {
                    headerActions.insertBefore(saveBtn, document.getElementById('mobileNewBtn'));
                }
                if (shareBtn && !headerActions.contains(shareBtn)) {
                    headerActions.insertBefore(shareBtn, document.getElementById('mobileNewBtn'));
                }
            } else {
                // Desktop: move buttons to editor header
                if (saveBtn && !actionButtons.contains(saveBtn)) {
                    actionButtons.appendChild(saveBtn);
                }
                if (shareBtn && !actionButtons.contains(shareBtn)) {
                    actionButtons.appendChild(shareBtn);
                }
            }
        };
        
        // Initial positioning
        moveButtons();
        
        // Listen for window resize
        window.addEventListener('resize', moveButtons);
    }

    setupEventListeners() {
        // Mobile new recipe button
        document.getElementById('mobileNewBtn')?.addEventListener('click', () => this.sidebar.showNewRecipeModal());
        
        // Save and share buttons (single buttons that move between mobile/desktop)
        document.getElementById('saveBtn')?.addEventListener('click', () => this.editor?.save());
        document.getElementById('shareBtn')?.addEventListener('click', () => this.shareUrl());

        // Additional keyboard shortcut for save
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (this.editor) {
                    this.editor.save();
                }
            }
        });
    }

    extractPathFromUrl() {
        // Extract path from /edit/{path} URL
        const pathname = window.location.pathname;
        const editPrefix = '/edit/';
        
        if (!pathname.startsWith(editPrefix)) {
            return null;
        }
        
        return pathname.substring(editPrefix.length);
    }

    updatePageInfo() {
        // Update page title
        const fileName = this.recipePath.split('/').pop();
        document.title = `${fileName} - Recipe Editor`;
        
        // Update file name displays (both mobile and desktop)
        const fileNameMobile = document.getElementById('fileName');
        const fileNameDesktop = document.getElementById('fileNameDesktop');
        
        if (fileNameMobile) {
            fileNameMobile.textContent = fileName;
        }
        if (fileNameDesktop) {
            fileNameDesktop.textContent = fileName;
        }
    }

    async setupEditor() {
        try {
            // Initialize CodeMirror editor using existing class
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
        // Wait for editor to be ready
        if (!this.editor) {
            return;
        }
        
        if (this.isLoading) {
            return;
        }
        
        this.isLoading = true;
        this.showStatus('Loading recipe...');

        try {
            const response = await window.api.getFile(this.recipePath);
            
            // Load content into editor
            this.editor.currentFile = this.recipePath;
            this.editor.setContent(response.content || '');
            this.editor.lastSavedContent = response.content || '';
            this.editor.isDirty = false;
            this.editor.updateUI();
            
            this.showStatus('Recipe loaded');
            
        } catch (error) {
            console.error('Failed to load recipe:', error);
            this.showError('Failed to load recipe: ' + Utils.extractErrorMessage(error));
        } finally {
            this.isLoading = false;
        }
    }

    // Event handlers
    async onFileSelect(path) {
        if (path) {
            // Navigate to the selected file's edit URL
            window.location.href = `/edit/${path}`;
        }
    }

    onContentChange() {
        // This is called when editor content changes
        // The CodeMirrorEditor class handles auto-save and UI updates
    }

    // Handle file operations that affect current URL
    handleFileRenamed(oldPath, newPath) {
        // If we renamed the current file, navigate to new URL
        if (oldPath === this.recipePath) {
            window.location.href = `/edit/${newPath}`;
        }
    }

    handleFileDeleted(deletedPath) {
        // If we deleted the current file, navigate to main page
        if (deletedPath === this.recipePath) {
            window.location.href = '/';
        }
    }

    shareUrl() {
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
        // Fallback for older browsers
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
        // Simple toast notification (reuse sidebar's method if available)
        if (this.sidebar) {
            this.sidebar.showToast(message, type);
        } else {
            // Fallback implementation
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
}

// Initialize the standalone editor when page loads
document.addEventListener('DOMContentLoaded', () => {
    new StandaloneRecipeEditor();
});