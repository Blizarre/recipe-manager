// Editor Component
class RecipeEditor {
    constructor(editorElement, onContentChange) {
        this.editor = editorElement;
        this.onContentChange = onContentChange;
        this.currentFile = null;
        this.isDirty = false;
        this.autoSaveTimeout = null;
        this.lastSavedContent = '';
        
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
                    case 'Enter':
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.validate();
                        }
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
            
            this.updateUI();
            this.updateCharCount();
            this.updateFileInfo();
            
            // Auto-validate if it's a recipe
            if (path.endsWith('.md')) {
                setTimeout(() => this.validate(), 500);
            }
            
        } catch (error) {
            this.showError('Failed to load file: ' + error.message);
        }
    }

    async save() {
        if (!this.currentFile) return;

        try {
            const content = this.editor.value;
            
            if (this.currentFile.endsWith('.md')) {
                // Save as recipe with validation
                await window.api.saveRecipe(this.currentFile, content, true);
            } else {
                // Save as regular file
                await window.api.saveFile(this.currentFile, content);
            }
            
            this.lastSavedContent = content;
            this.isDirty = false;
            this.updateStatus();
            this.showSuccess('File saved successfully');
            
            // Re-validate after save
            if (this.currentFile.endsWith('.md')) {
                setTimeout(() => this.validate(), 200);
            }
            
        } catch (error) {
            this.showError('Failed to save file: ' + error.message);
        }
    }

    async validate() {
        if (!this.currentFile || !this.currentFile.endsWith('.md')) return;

        try {
            const content = this.editor.value;
            const result = await window.api.validateRecipe(content);
            
            this.updateValidationStatus(result);
            
        } catch (error) {
            this.showError('Validation failed: ' + error.message);
        }
    }

    scheduleAutoSave() {
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        this.autoSaveTimeout = setTimeout(() => {
            if (this.isDirty && this.currentFile) {
                this.save();
            }
        }, 2000); // Auto-save after 2 seconds of inactivity
    }

    updateUI() {
        const hasFile = !!this.currentFile;
        const welcomeScreen = document.getElementById('welcomeScreen');
        const editorWrapper = document.getElementById('editorWrapper');
        const saveBtn = document.getElementById('saveBtn');
        const validateBtn = document.getElementById('validateBtn');
        
        if (hasFile) {
            welcomeScreen.style.display = 'none';
            editorWrapper.style.display = 'flex';
            this.editor.focus();
        } else {
            welcomeScreen.style.display = 'flex';
            editorWrapper.style.display = 'none';
        }
        
        saveBtn.disabled = !hasFile;
        validateBtn.disabled = !hasFile || !this.currentFile?.endsWith('.md');
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
            fileStatus.textContent = this.isDirty ? 'Modified' : 'Saved';
            fileStatus.className = `file-status ${this.isDirty ? 'modified' : 'saved'}`;
        }
    }

    updateValidationStatus(result) {
        const validationStatus = document.getElementById('validationStatus');
        
        if (result.is_valid) {
            const info = result.info;
            validationStatus.innerHTML = `
                <span class="validation-success">✓ Valid recipe</span>
                <small>(${info.ingredients_count} ingredients, ${info.instructions_count} steps)</small>
            `;
        } else {
            const errorCount = result.errors.length;
            validationStatus.innerHTML = `
                <span class="validation-error">⚠ ${errorCount} validation error${errorCount > 1 ? 's' : ''}</span>
            `;
            
            // Show detailed errors in console for now
            console.log('Recipe validation errors:', result.errors);
            
            // Could show a tooltip or modal with detailed errors
            validationStatus.title = result.errors.join('\n');
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
        this.updateUI();
        this.updateCharCount();
        this.updateFileInfo();
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
`;
document.head.appendChild(style);