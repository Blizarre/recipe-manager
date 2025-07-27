// Simple Textarea-based Markdown Editor with Prism.js Syntax Highlighting
class SimpleMarkdownEditor {
    constructor(container, onContentChange) {
        this.container = container;
        this.onContentChange = onContentChange;
        this.textarea = null;
        this.overlay = null;
        this.currentFile = null;
        this.isDirty = false;
        this.autoSaveTimeout = null;
        this.lastSavedContent = '';
        this.autoSaveDelay = 4000; // 4 seconds
        
        this.init();
    }

    init() {
        this.setupTextarea();
        this.setupSyntaxOverlay();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.updateUI();
    }

    setupTextarea() {
        this.textarea = document.getElementById('editor');
        if (!this.textarea) {
            console.error('Editor textarea not found');
            return;
        }
        
        // Ensure textarea has proper styling for overlay
        this.textarea.style.position = 'relative';
        this.textarea.style.zIndex = '2';
        this.textarea.style.background = 'transparent';
        this.textarea.style.color = 'transparent';
        this.textarea.style.caretColor = '#333';
        this.textarea.style.resize = 'none';
        this.textarea.style.border = 'none';
        this.textarea.style.outline = 'none';
        this.textarea.style.fontFamily = '"Fira Code", "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace';
        this.textarea.style.fontSize = '14px';
        this.textarea.style.lineHeight = '1.5';
        this.textarea.style.padding = '16px';
        this.textarea.style.width = '100%';
        this.textarea.style.height = '100%';
        this.textarea.style.boxSizing = 'border-box';
    }

    setupSyntaxOverlay() {
        this.overlay = document.getElementById('syntaxOverlay');
        if (!this.overlay) {
            console.error('Syntax overlay not found');
            return;
        }
        
        // Style the overlay to match textarea exactly
        this.overlay.style.position = 'absolute';
        this.overlay.style.top = '0';
        this.overlay.style.left = '0';
        this.overlay.style.zIndex = '1';
        this.overlay.style.pointerEvents = 'none';
        this.overlay.style.fontFamily = this.textarea.style.fontFamily;
        this.overlay.style.fontSize = this.textarea.style.fontSize;
        this.overlay.style.lineHeight = this.textarea.style.lineHeight;
        this.overlay.style.padding = this.textarea.style.padding;
        this.overlay.style.margin = '0';
        this.overlay.style.border = 'none';
        this.overlay.style.whiteSpace = 'pre-wrap';
        this.overlay.style.wordWrap = 'break-word';
        this.overlay.style.overflow = 'hidden';
        this.overlay.style.width = '100%';
        this.overlay.style.height = '100%';
        this.overlay.style.boxSizing = 'border-box';
    }

    setupEventListeners() {
        if (!this.textarea) return;

        // Content change handling
        this.textarea.addEventListener('input', () => {
            this.isDirty = true;
            this.updateCharCount();
            this.updateStatus();
            this.scheduleAutoSave();
            this.updateSyntaxHighlighting();
            this.onContentChange?.();
        });

        // Scroll synchronization
        this.textarea.addEventListener('scroll', () => {
            this.syncScroll();
        });

        // Focus and blur handling
        this.textarea.addEventListener('focus', () => {
            document.querySelector('.simple-editor-container').classList.add('focused');
        });

        this.textarea.addEventListener('blur', () => {
            document.querySelector('.simple-editor-container').classList.remove('focused');
        });

        // Handle tab key for indentation
        this.textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                this.handleTab(e.shiftKey);
            }
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        this.save();
                        break;
                }
            }
        });
    }

    handleTab(isShiftTab) {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const content = this.textarea.value;
        
        if (isShiftTab) {
            // Shift+Tab: Remove indent
            const lineStart = content.lastIndexOf('\n', start - 1) + 1;
            const lineEnd = content.indexOf('\n', start);
            const lineEndPos = lineEnd === -1 ? content.length : lineEnd;
            const line = content.substring(lineStart, lineEndPos);
            
            if (line.startsWith('  ')) {
                this.textarea.value = content.substring(0, lineStart) + 
                                    line.substring(2) + 
                                    content.substring(lineEndPos);
                this.textarea.selectionStart = Math.max(lineStart, start - 2);
                this.textarea.selectionEnd = Math.max(lineStart, end - 2);
            }
        } else {
            // Tab: Add indent
            this.textarea.value = content.substring(0, start) + '  ' + content.substring(end);
            this.textarea.selectionStart = this.textarea.selectionEnd = start + 2;
        }
        
        // Trigger input event to update highlighting
        this.textarea.dispatchEvent(new Event('input'));
    }

    updateSyntaxHighlighting() {
        if (!this.overlay || !window.Prism || !window.Prism.languages.markdown) return;
        
        const content = this.textarea.value;
        const highlighted = Prism.highlight(content, Prism.languages.markdown, 'markdown');
        this.overlay.innerHTML = highlighted;
        this.syncScroll();
    }

    syncScroll() {
        if (!this.overlay) return;
        this.overlay.scrollTop = this.textarea.scrollTop;
        this.overlay.scrollLeft = this.textarea.scrollLeft;
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
            this.textarea.value = fileData.content;
            this.lastSavedContent = fileData.content;
            this.isDirty = false;
            
            this.updateUI();
            this.updateCharCount();
            this.updateFileInfo();
            this.updateSyntaxHighlighting();
            
        } catch (error) {
            this.showError('Failed to load file: ' + error.message);
        }
    }

    async save() {
        if (!this.currentFile) return;

        try {
            const content = this.textarea.value;
            
            if (this.currentFile.endsWith('.md')) {
                await window.api.saveRecipe(this.currentFile, content);
            } else {
                await window.api.saveFile(this.currentFile, content);
            }
            
            this.lastSavedContent = content;
            this.isDirty = false;
            this.updateStatus();
            this.showSuccess('File saved successfully');
            
        } catch (error) {
            this.showError('Failed to save file: ' + error.message);
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
            this.textarea.focus();
        } else {
            welcomeScreen.style.display = 'flex';
            editorWrapper.style.display = 'none';
        }
        
        saveBtn.disabled = !hasFile;
    }

    updateCharCount() {
        const charCount = document.getElementById('charCount');
        if (!charCount || !this.textarea) return;
        
        const content = this.textarea.value;
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
        if (this.currentFile && fileStatus) {
            fileStatus.textContent = this.isDirty ? 'Modified' : 'Saved';
            fileStatus.className = `file-status ${this.isDirty ? 'modified' : 'saved'}`;
        }
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showMessage(message, type = 'info') {
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
        return this.textarea.value;
    }

    setContent(content) {
        this.textarea.value = content;
        this.updateCharCount();
        this.updateSyntaxHighlighting();
    }

    isDirtyFile() {
        return this.isDirty;
    }

    clear() {
        this.currentFile = null;
        this.textarea.value = '';
        this.isDirty = false;
        this.lastSavedContent = '';
        this.updateUI();
        this.updateCharCount();
        this.updateFileInfo();
        this.updateSyntaxHighlighting();
    }
}