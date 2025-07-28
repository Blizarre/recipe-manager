// Standalone Recipe Editor for shareable URLs
class StandaloneRecipeEditor {
    constructor() {
        this.recipePath = null;
        this.editor = null;
        this.isLoading = false;
        
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
        
        // Initialize editor once CodeMirror is ready
        if (window.CodeMirrorReady) {
            this.setupEditor();
        } else {
            window.addEventListener('codemirror-ready', () => {
                this.setupEditor();
            });
        }

        // Setup event handlers
        this.setupEventHandlers();
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
        
        // Update file name display
        const fileNameElement = document.getElementById('fileName');
        if (fileNameElement) {
            fileNameElement.textContent = this.recipePath;
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

            // Load recipe content
            await this.loadRecipeContent();
            
        } catch (error) {
            console.error('Failed to setup editor:', error);
            this.showError('Failed to initialize editor');
        }
    }

    async loadRecipeContent() {
        if (this.isLoading) return;
        
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

    setupEventHandlers() {
        // Save button
        const saveBtn = document.getElementById('saveBtn');
        saveBtn?.addEventListener('click', () => {
            if (this.editor) {
                this.editor.save();
            }
        });

        // Share button
        const shareBtn = document.getElementById('shareBtn');
        shareBtn?.addEventListener('click', () => {
            this.shareUrl();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (this.editor) {
                    this.editor.save();
                }
            }
        });
    }

    onContentChange() {
        // This is called when editor content changes
        // The CodeMirrorEditor class handles auto-save and UI updates
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
        // Simple toast notification (similar to app.js)
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

// Initialize the standalone editor when page loads
document.addEventListener('DOMContentLoaded', () => {
    new StandaloneRecipeEditor();
});