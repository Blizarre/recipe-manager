// Editor Component
class RecipeEditor {
    constructor(editorElement, onContentChange) {
        this.editor = editorElement;
        this.onContentChange = onContentChange;
        this.currentFile = null;
        this.isDirty = false;
        this.autoSaveTimeout = null;
        this.lastSavedContent = '';
        this.saveStatus = 'saved'; // 'saved', 'saving', 'error', 'modified'
        this.saveRetryAttempts = 0;
        this.maxRetryAttempts = 3;
        this.autoSaveDelay = 4000; // 4 seconds
        this.lastModified = null; // Track server-side last modified time
        this.conflictCheckInterval = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateUI();
    }

    setupEventListeners() {
        // Content change handling
        this.editor.addEventListener('input', () => {
            this.isDirty = true;
            this.saveStatus = 'modified';
            this.saveRetryAttempts = 0; // Reset retry attempts on new changes
            this.updateCharCount();
            this.updateStatus();
            this.scheduleAutoSave();
            this.onContentChange?.();
        });

        // Keyboard shortcuts
        this.editor.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        this.save();
                        break;
                }
            }
        });

        // Handle tab key for indentation
        this.editor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.editor.selectionStart;
                const end = this.editor.selectionEnd;
                const content = this.editor.value;
                
                if (e.shiftKey) {
                    // Shift+Tab: Remove indent
                    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
                    const line = content.substring(lineStart, content.indexOf('\n', start));
                    
                    if (line.startsWith('  ')) {
                        this.editor.value = content.substring(0, lineStart) + 
                                          line.substring(2) + 
                                          content.substring(lineStart + line.length);
                        this.editor.selectionStart = Math.max(lineStart, start - 2);
                        this.editor.selectionEnd = Math.max(lineStart, end - 2);
                    }
                } else {
                    // Tab: Add indent
                    this.editor.value = content.substring(0, start) + '  ' + content.substring(end);
                    this.editor.selectionStart = this.editor.selectionEnd = start + 2;
                }
                
                this.editor.dispatchEvent(new Event('input'));
            }
        });
    }

    async loadFile(path) {
        try {
            if (this.isDirty && this.currentFile) {
                const shouldSave = confirm('You have unsaved changes. Save before switching files?');
                if (shouldSave) {
                    await this.save();
                }
            }

            const fileData = await window.api.getFile(path);
            this.currentFile = path;
            this.editor.value = fileData.content;
            this.lastSavedContent = fileData.content;
            this.isDirty = false;
            this.saveStatus = 'saved';
            this.saveRetryAttempts = 0;
            this.lastModified = fileData.last_modified || Date.now();
            
            this.updateUI();
            this.startConflictDetection();
            this.updateCharCount();
            this.updateFileInfo();
            
            
        } catch (error) {
            this.showError('Failed to load file: ' + error.message);
        }
    }

    async save(isAutoSave = false) {
        if (!this.currentFile) return;

        try {
            this.saveStatus = 'saving';
            this.updateStatus();
            
            const content = this.editor.value;
            
            if (this.currentFile.endsWith('.md')) {
                // Save as recipe
                await window.api.saveRecipe(this.currentFile, content);
            } else {
                // Save as regular file
                await window.api.saveFile(this.currentFile, content);
            }
            
            this.lastSavedContent = content;
            this.isDirty = false;
            this.saveStatus = 'saved';
            this.saveRetryAttempts = 0;
            this.lastModified = Date.now(); // Update last modified time
            this.updateStatus();
            
            if (!isAutoSave) {
                this.showSuccess('File saved successfully');
            }
            
            
            // Trigger file tree refresh for real-time updates
            if (window.app && window.app.fileTree) {
                window.app.fileTree.notifyFileChanged(this.currentFile);
            }
            
        } catch (error) {
            this.saveStatus = 'error';
            this.updateStatus();
            
            if (isAutoSave && this.saveRetryAttempts < this.maxRetryAttempts) {
                this.saveRetryAttempts++;
                setTimeout(() => this.save(true), 2000 * this.saveRetryAttempts); // Exponential backoff
            } else {
                this.showError(`Failed to save file: ${error.message}`);
            }
        }
    }


    scheduleAutoSave() {
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        this.autoSaveTimeout = setTimeout(() => {
            if (this.isDirty && this.currentFile && this.saveStatus !== 'saving') {
                this.save(true); // Pass true to indicate auto-save
            }
        }, this.autoSaveDelay);
    }

    updateUI() {
        const hasFile = !!this.currentFile;
        const welcomeScreen = document.getElementById('welcomeScreen');
        const editorWrapper = document.getElementById('editorWrapper');
        const saveBtn = document.getElementById('saveBtn');
        
        if (hasFile) {
            welcomeScreen.style.display = 'none';
            editorWrapper.style.display = 'flex';
            this.editor.focus();
        } else {
            welcomeScreen.style.display = 'flex';
            editorWrapper.style.display = 'none';
        }
        
        saveBtn.disabled = !hasFile;
    }

    updateCharCount() {
        const charCount = document.getElementById('charCount');
        const content = this.editor.value;
        const chars = content.length;
        const lines = content.split('\n').length;
        charCount.textContent = `${chars} characters, ${lines} lines`;
    }

    updateFileInfo() {
        const fileName = document.getElementById('fileName');
        const fileStatus = document.getElementById('fileStatus');
        
        if (this.currentFile) {
            fileName.textContent = this.currentFile.split('/').pop();
            fileStatus.textContent = this.isDirty ? 'Modified' : 'Saved';
        } else {
            fileName.textContent = 'Select a recipe to edit';
            fileStatus.textContent = '';
        }
    }

    updateStatus() {
        const fileStatus = document.getElementById('fileStatus');
        if (this.currentFile) {
            let statusText = '';
            let statusClass = '';
            
            switch (this.saveStatus) {
                case 'saving':
                    statusText = 'Saving...';
                    statusClass = 'saving';
                    break;
                case 'saved':
                    statusText = 'Saved';
                    statusClass = 'saved';
                    break;
                case 'modified':
                    statusText = 'Modified';
                    statusClass = 'modified';
                    break;
                case 'error':
                    statusText = `Error (${this.saveRetryAttempts}/${this.maxRetryAttempts})`;
                    statusClass = 'error';
                    break;
                default:
                    statusText = this.isDirty ? 'Modified' : 'Saved';
                    statusClass = this.isDirty ? 'modified' : 'saved';
            }
            
            fileStatus.textContent = statusText;
            fileStatus.className = `file-status ${statusClass}`;
        }
    }


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
            top: 80px;
            right: 20px;
            background: ${type === 'error' ? 'var(--error-color)' : 'var(--success-color)'};
            color: white;
            padding: 12px 16px;
            border-radius: var(--radius);
            box-shadow: var(--shadow-lg);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Public methods
    getCurrentFile() {
        return this.currentFile;
    }

    getContent() {
        return this.editor.value;
    }

    setContent(content) {
        this.editor.value = content;
        this.updateCharCount();
    }

    isDirtyFile() {
        return this.isDirty;
    }

    clear() {
        this.currentFile = null;
        this.editor.value = '';
        this.isDirty = false;
        this.lastSavedContent = '';
        this.saveStatus = 'saved';
        this.saveRetryAttempts = 0;
        this.lastModified = null;
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
            this.autoSaveTimeout = null;
        }
        this.stopConflictDetection();
        this.updateUI();
        this.updateCharCount();
        this.updateFileInfo();
    }

    // Conflict detection methods
    startConflictDetection() {
        if (this.conflictCheckInterval) {
            clearInterval(this.conflictCheckInterval);
        }
        
        // Check for conflicts every 30 seconds
        this.conflictCheckInterval = setInterval(() => {
            this.checkForConflicts();
        }, 30000);
    }

    stopConflictDetection() {
        if (this.conflictCheckInterval) {
            clearInterval(this.conflictCheckInterval);
            this.conflictCheckInterval = null;
        }
    }

    async checkForConflicts() {
        if (!this.currentFile || this.saveStatus === 'saving') return;

        try {
            const fileData = await window.api.getFile(this.currentFile);
            const serverLastModified = fileData.last_modified || 0;
            
            // Check if file was modified externally
            if (serverLastModified > this.lastModified) {
                this.handleConflict(fileData.content);
            }
        } catch (error) {
            // File might have been deleted - handle gracefully
            console.warn('Conflict check failed:', error.message);
        }
    }

    handleConflict(serverContent) {
        if (this.isDirty) {
            // User has unsaved changes - show conflict resolution dialog
            this.showConflictDialog(serverContent);
        } else {
            // No local changes - just reload the file
            this.editor.value = serverContent;
            this.lastSavedContent = serverContent;
            this.lastModified = Date.now();
            this.showMessage('File updated from server', 'info');
        }
    }

    showConflictDialog(serverContent) {
        const currentContent = this.editor.value;
        
        const choice = confirm(
            'This file has been modified by another user. ' +
            'Click OK to keep your changes and overwrite the server version, ' +
            'or Cancel to discard your changes and use the server version.'
        );
        
        if (choice) {
            // User wants to keep their changes - force save
            this.save(false);
        } else {
            // User wants to use server version
            this.editor.value = serverContent;
            this.lastSavedContent = serverContent;
            this.lastModified = Date.now();
            this.isDirty = false;
            this.saveStatus = 'saved';
            this.updateStatus();
            this.showMessage('File reverted to server version', 'info');
        }
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .file-status.modified {
        color: var(--warning-color);
    }
    
    .file-status.saved {
        color: var(--success-color);
    }
    
    .file-status.saving {
        color: var(--primary-color);
        animation: pulse 1.5s infinite;
    }
    
    .file-status.error {
        color: var(--error-color);
        animation: shake 0.5s ease-in-out;
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-2px); }
        75% { transform: translateX(2px); }
    }
`;
document.head.appendChild(style);