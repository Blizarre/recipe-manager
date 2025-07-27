// Enhanced Markdown Editor with CodeMirror and Preview
class MarkdownEditor {
    constructor(container, onContentChange) {
        this.container = container;
        this.onContentChange = onContentChange;
        this.codeMirror = null;
        this.currentFile = null;
        this.isDirty = false;
        this.autoSaveTimeout = null;
        this.lastSavedContent = '';
        this.currentView = 'edit'; // 'edit', 'preview', 'split'
        this.previewUpdateTimeout = null;
        
        this.init();
    }

    init() {
        this.setupCodeMirror();
        this.setupEventListeners();
        this.setupAutoComplete();
        this.updateUI();
    }

    setupCodeMirror() {
        const textarea = document.getElementById('editor');
        
        this.codeMirror = CodeMirror.fromTextArea(textarea, {
            mode: 'markdown',
            theme: 'github',
            lineNumbers: true,
            lineWrapping: true,
            indentUnit: 2,
            tabSize: 2,
            autoCloseBrackets: true,
            matchBrackets: true,
            extraKeys: {
                'Ctrl-S': () => this.save(),
                'Cmd-S': () => this.save(),
                'Ctrl-Enter': () => this.togglePreview(),
                'Cmd-Enter': () => this.togglePreview(),
                'Tab': (cm) => this.handleTab(cm),
                'Shift-Tab': (cm) => this.handleShiftTab(cm),
                'Enter': (cm) => this.handleEnter(cm),
                'Ctrl-Space': (cm) => this.showAutoComplete(cm)
            },
            placeholder: 'Start typing your recipe here...'
        });

        // Content change handling
        this.codeMirror.on('change', () => {
            this.isDirty = true;
            this.updateCharCount();
            this.updateStatus();
            this.scheduleAutoSave();
            this.schedulePreviewUpdate();
            this.onContentChange?.();
        });

        // Focus and blur handling
        this.codeMirror.on('focus', () => {
            document.querySelector('.codemirror-container').classList.add('focused');
        });

        this.codeMirror.on('blur', () => {
            document.querySelector('.codemirror-container').classList.remove('focused');
        });
    }

    setupEventListeners() {
        // View toggle buttons
        document.getElementById('editBtn')?.addEventListener('click', () => this.setView('edit'));
        document.getElementById('previewBtn')?.addEventListener('click', () => this.setView('preview'));
        document.getElementById('splitBtn')?.addEventListener('click', () => this.setView('split'));
    }

    setupAutoComplete() {
        // Recipe-specific autocomplete hints
        this.recipeHints = [
            // Ingredients patterns
            '- cups',
            '- teaspoons',
            '- tablespoons',
            '- pounds',
            '- ounces',
            '- grams',
            '- kilograms',
            '- liters',
            '- milliliters',
            '- cloves',
            '- pinch of',
            '- dash of',
            
            // Instructions patterns
            '1. Preheat oven to',
            '2. In a large bowl, mix',
            '3. Add the',
            '4. Stir until',
            '5. Bake for',
            '6. Remove from oven and',
            '7. Let cool for',
            '8. Serve',
            
            // Common ingredients
            'all-purpose flour',
            'baking powder',
            'baking soda',
            'vanilla extract',
            'olive oil',
            'vegetable oil',
            'unsalted butter',
            'granulated sugar',
            'brown sugar',
            'salt and pepper',
            'garlic cloves',
            'yellow onion',
            'large eggs',
            
            // Temperature and time
            '350°F (175°C)',
            '375°F (190°C)',
            '400°F (200°C)',
            '425°F (220°C)',
            '30 minutes',
            '45 minutes',
            '1 hour',
            'until golden brown',
            'until tender'
        ];
    }

    showAutoComplete(cm) {
        const cursor = cm.getCursor();
        const line = cm.getLine(cursor.line);
        const beforeCursor = line.slice(0, cursor.ch);
        
        // Check if we're in an ingredients or instructions section
        const allText = cm.getValue();
        const cursorIndex = cm.indexFromPos(cursor);
        const textBeforeCursor = allText.slice(0, cursorIndex);
        
        let sectionType = null;
        const ingredientsMatch = textBeforeCursor.lastIndexOf('## Ingredients');
        const instructionsMatch = textBeforeCursor.lastIndexOf('## Instructions');
        const notesMatch = textBeforeCursor.lastIndexOf('## Notes');
        
        const lastSection = Math.max(ingredientsMatch, instructionsMatch, notesMatch);
        
        if (lastSection === ingredientsMatch) sectionType = 'ingredients';
        else if (lastSection === instructionsMatch) sectionType = 'instructions';
        else if (lastSection === notesMatch) sectionType = 'notes';
        
        // Filter hints based on context
        let hints = this.recipeHints;
        if (sectionType === 'ingredients') {
            hints = this.recipeHints.filter(hint => 
                hint.startsWith('- ') || 
                ['cups', 'teaspoons', 'tablespoons', 'pounds', 'ounces', 'grams'].some(unit => hint.includes(unit)) ||
                ['flour', 'sugar', 'butter', 'oil', 'salt', 'pepper', 'garlic', 'onion', 'eggs'].some(ing => hint.includes(ing))
            );
        } else if (sectionType === 'instructions') {
            hints = this.recipeHints.filter(hint => 
                /^\d+\./.test(hint) || 
                hint.includes('Preheat') || 
                hint.includes('Bake') || 
                hint.includes('Mix') || 
                hint.includes('°F')
            );
        }
        
        // Filter by what's already typed
        const word = beforeCursor.match(/\S*$/)?.[0] || '';
        if (word) {
            hints = hints.filter(hint => 
                hint.toLowerCase().includes(word.toLowerCase())
            );
        }
        
        if (hints.length > 0) {
            CodeMirror.showHint(cm, () => ({
                list: hints.slice(0, 10), // Limit to 10 suggestions
                from: CodeMirror.Pos(cursor.line, cursor.ch - word.length),
                to: cursor
            }), {
                completeSingle: false,
                hint: CodeMirror.hint.auto
            });
        }
    }

    handleTab(cm) {
        const cursor = cm.getCursor();
        const line = cm.getLine(cursor.line);
        
        // Smart indentation for lists
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            cm.replaceSelection('  ');
        } else if (/^\s*\d+\.\s/.test(line.trim())) {
            cm.replaceSelection('  ');
        } else {
            cm.replaceSelection('  ');
        }
    }

    handleShiftTab(cm) {
        const cursor = cm.getCursor();
        const line = cm.getLine(cursor.line);
        
        // Remove indentation
        if (line.startsWith('  ')) {
            cm.replaceRange('', 
                CodeMirror.Pos(cursor.line, 0), 
                CodeMirror.Pos(cursor.line, 2)
            );
        }
    }

    handleEnter(cm) {
        const cursor = cm.getCursor();
        const line = cm.getLine(cursor.line);
        
        // Auto-continue lists
        const bulletMatch = line.match(/^(\s*)([-*])\s/);
        const numberMatch = line.match(/^(\s*)(\d+)\.\s/);
        
        if (bulletMatch) {
            const [, indent, bullet] = bulletMatch;
            if (line.trim() === `${bullet}`) {
                // Empty list item, remove it and un-indent
                cm.replaceRange('', 
                    CodeMirror.Pos(cursor.line, 0), 
                    CodeMirror.Pos(cursor.line, line.length)
                );
                cm.replaceSelection('\n');
            } else {
                cm.replaceSelection(`\n${indent}${bullet} `);
            }
            return;
        }
        
        if (numberMatch) {
            const [, indent, number] = numberMatch;
            if (line.trim() === `${number}.`) {
                // Empty numbered item, remove it and un-indent
                cm.replaceRange('', 
                    CodeMirror.Pos(cursor.line, 0), 
                    CodeMirror.Pos(cursor.line, line.length)
                );
                cm.replaceSelection('\n');
            } else {
                const nextNumber = parseInt(number) + 1;
                cm.replaceSelection(`\n${indent}${nextNumber}. `);
            }
            return;
        }
        
        // Default behavior
        cm.replaceSelection('\n');
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
            this.codeMirror.setValue(fileData.content);
            this.lastSavedContent = fileData.content;
            this.isDirty = false;
            
            this.updateUI();
            this.updateCharCount();
            this.updateFileInfo();
            this.updatePreview();
            
            // Auto-validate if it's a recipe
            if (path.endsWith('.md')) {
                setTimeout(() => this.validate(), 500);
            }
            
        } catch (error) {
            this.showError('Failed to load file: ' + error.message);
        }
    }

    setView(view) {
        this.currentView = view;
        
        const editBtn = document.getElementById('editBtn');
        const previewBtn = document.getElementById('previewBtn');
        const splitBtn = document.getElementById('splitBtn');
        const editorPanels = document.querySelector('.editor-panels');
        const editorPanel = document.getElementById('editorPanel');
        const previewPanel = document.getElementById('previewPanel');
        
        // Update button states
        [editBtn, previewBtn, splitBtn].forEach(btn => btn?.classList.remove('active'));
        
        switch (view) {
            case 'edit':
                editBtn?.classList.add('active');
                editorPanels.className = 'editor-panels';
                editorPanel.style.display = 'flex';
                previewPanel.style.display = 'none';
                this.codeMirror.refresh();
                break;
                
            case 'preview':
                previewBtn?.classList.add('active');
                editorPanels.className = 'editor-panels preview-only';
                editorPanel.style.display = 'none';
                previewPanel.style.display = 'flex';
                this.updatePreview();
                break;
                
            case 'split':
                splitBtn?.classList.add('active');
                editorPanels.className = 'editor-panels split-view';
                editorPanel.style.display = 'flex';
                previewPanel.style.display = 'flex';
                this.codeMirror.refresh();
                this.updatePreview();
                break;
        }
    }

    updatePreview() {
        if (this.currentView === 'edit') return;
        
        const content = this.codeMirror.getValue();
        const previewContent = document.getElementById('previewContent');
        
        try {
            // Configure marked for better rendering
            marked.setOptions({
                breaks: true,
                gfm: true,
                headerIds: false,
                sanitize: false
            });
            
            const html = marked.parse(content);
            previewContent.innerHTML = html;
        } catch (error) {
            previewContent.innerHTML = `<div class="preview-error">Preview error: ${error.message}</div>`;
        }
    }

    schedulePreviewUpdate() {
        if (this.previewUpdateTimeout) {
            clearTimeout(this.previewUpdateTimeout);
        }
        
        this.previewUpdateTimeout = setTimeout(() => {
            this.updatePreview();
        }, 300); // Update preview 300ms after typing stops
    }

    togglePreview() {
        const nextView = this.currentView === 'edit' ? 'preview' : 
                        this.currentView === 'preview' ? 'split' : 'edit';
        this.setView(nextView);
    }

    async save() {
        if (!this.currentFile) return;

        try {
            const content = this.codeMirror.getValue();
            
            if (this.currentFile.endsWith('.md')) {
                await window.api.saveRecipe(this.currentFile, content, true);
            } else {
                await window.api.saveFile(this.currentFile, content);
            }
            
            this.lastSavedContent = content;
            this.isDirty = false;
            this.updateStatus();
            this.showSuccess('File saved successfully');
            
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
            const content = this.codeMirror.getValue();
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
        }, 2000);
    }

    updateUI() {
        const hasFile = !!this.currentFile;
        const welcomeScreen = document.getElementById('welcomeScreen');
        const editorWrapper = document.getElementById('editorWrapper');
        const saveBtn = document.getElementById('saveBtn');
        const validateBtn = document.getElementById('validateBtn');
        const previewBtn = document.getElementById('previewBtn');
        const splitBtn = document.getElementById('splitBtn');
        
        if (hasFile) {
            welcomeScreen.style.display = 'none';
            editorWrapper.style.display = 'flex';
            this.codeMirror.focus();
        } else {
            welcomeScreen.style.display = 'flex';
            editorWrapper.style.display = 'none';
        }
        
        saveBtn.disabled = !hasFile;
        validateBtn.disabled = !hasFile || !this.currentFile?.endsWith('.md');
        previewBtn.disabled = !hasFile;
        splitBtn.disabled = !hasFile;
    }

    updateCharCount() {
        const charCount = document.getElementById('charCount');
        const content = this.codeMirror.getValue();
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
        return this.codeMirror.getValue();
    }

    setContent(content) {
        this.codeMirror.setValue(content);
        this.updateCharCount();
        this.updatePreview();
    }

    isDirtyFile() {
        return this.isDirty;
    }

    clear() {
        this.currentFile = null;
        this.codeMirror.setValue('');
        this.isDirty = false;
        this.lastSavedContent = '';
        this.updateUI();
        this.updateCharCount();
        this.updateFileInfo();
    }
}