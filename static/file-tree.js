// File Tree Component
class FileTree {
    constructor(container, onFileSelect, onContextMenu) {
        this.container = container;
        this.onFileSelect = onFileSelect;
        this.onContextMenu = onContextMenu;
        this.files = [];
        this.selectedPath = null;
        this.expandedFolders = new Set();
        
        this.init();
    }

    init() {
        // Don't auto-refresh - let the app manage file loading
        this.showLoading();
    }

    async refresh() {
        try {
            this.showLoading();
            this.files = await window.api.listFiles();
            this.render();
        } catch (error) {
            this.showError('Failed to load files: ' + Utils.extractErrorMessage(error));
        }
    }

    setFiles(files) {
        // Set files without making API call
        this.files = files;
        this.render();
    }

    showLoading() {
        this.container.innerHTML = '<div class="loading">Loading recipes...</div>';
    }

    showError(message) {
        this.container.innerHTML = `<div class="loading" style="color: var(--error-color);">${message}</div>`;
    }


    render() {
        if (this.files.length === 0) {
            this.container.innerHTML = '<div class="loading">No recipes found. Create your first recipe!</div>';
            return;
        }

        // For main content area (no context menu), show flat file list
        if (!this.onContextMenu) {
            this.renderFlatFileList();
            return;
        }

        // Build tree structure for sidebar
        const tree = this.buildTree(this.files);
        this.container.innerHTML = '';
        this.renderTree(tree, this.container);
    }

    renderFlatFileList() {
        this.container.innerHTML = '';
        
        // Filter to only show files (not directories) and sort them
        const files = this.files
            .filter(item => item.type === 'file')
            .sort((a, b) => a.name.localeCompare(b.name));

        files.forEach(file => {
            this.renderFile(file, this.container, 0);
        });
    }

    buildTree(files) {
        const tree = {
            directories: {},
            files: []
        };

        files.forEach(file => {
            if (file.type === 'directory') {
                tree.directories[file.name] = {
                    name: file.name,
                    path: file.path,
                    files: [],
                    directories: {}
                };
            } else {
                tree.files.push(file);
            }
        });

        return tree;
    }

    renderTree(tree, container, level = 0) {
        // Render directories first
        Object.values(tree.directories).forEach(directory => {
            this.renderDirectory(directory, container, level);
        });

        // Render files
        tree.files.forEach(file => {
            this.renderFile(file, container, level);
        });
    }

    renderDirectory(directory, container, level) {
        const isExpanded = this.expandedFolders.has(directory.path);
        
        const dirElement = document.createElement('div');
        dirElement.className = `file-tree-item directory ${isExpanded ? 'expanded' : ''}`;
        dirElement.style.paddingLeft = `${16 + level * 20}px`;
        
        dirElement.innerHTML = `
            <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
            <span class="icon">📁</span>
            <span class="name">${directory.name}</span>
        `;

        dirElement.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.toggleDirectory(directory.path, dirElement);
        });

        dirElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.onContextMenu?.(e, directory.path, 'directory');
        });

        // Add drag and drop functionality
        this.setupDragAndDrop(dirElement, directory.path, 'directory');

        container.appendChild(dirElement);

        // Render children if expanded
        if (isExpanded) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'file-tree-children';
            
            // Load directory contents
            this.loadDirectoryContents(directory.path)
                .then(children => {
                    const childTree = this.buildTree(children);
                    this.renderTree(childTree, childrenContainer, level + 1);
                })
                .catch(error => {
                    childrenContainer.innerHTML = `<div class="loading" style="color: var(--error-color); padding-left: ${36 + level * 20}px;">Error loading folder</div>`;
                });

            container.appendChild(childrenContainer);
        }
    }

    renderFile(file, container, level) {
        const fileElement = document.createElement('a');
        fileElement.className = `file-tree-item file ${this.selectedPath === file.path ? 'active' : ''}`;
        
        // For main content area, don't add left padding (flat list)
        if (this.onContextMenu) {
            fileElement.style.paddingLeft = `${16 + level * 20}px`;
        }
        
        fileElement.href = `/edit/${file.path}`;
        fileElement.style.textDecoration = 'none';
        fileElement.style.color = 'inherit';
        
        const icon = this.getFileIcon(file.name);
        fileElement.innerHTML = `
            <span class="icon">${icon}</span>
            <span class="name">${file.name}</span>
        `;

        // Only add context menu if callback is provided (sidebar only)
        if (this.onContextMenu) {
            fileElement.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.onContextMenu(e, file.path, 'file');
            });

            // Add drag and drop functionality only in sidebar
            this.setupDragAndDrop(fileElement, file.path, 'file');
        }

        container.appendChild(fileElement);
    }

    getFileIcon(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        
        switch (extension) {
            case 'md':
            case 'markdown':
                return '📄';
            case 'txt':
                return '📝';
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
                return '🖼️';
            default:
                return '📄';
        }
    }

    async toggleDirectory(path, element) {
        const isExpanded = this.expandedFolders.has(path);
        
        if (isExpanded) {
            this.expandedFolders.delete(path);
            element.classList.remove('expanded');
            
            // Remove children
            const nextSibling = element.nextElementSibling;
            if (nextSibling && nextSibling.classList.contains('file-tree-children')) {
                nextSibling.remove();
            }
            
            // Update icon
            const expandIcon = element.querySelector('.expand-icon');
            expandIcon.textContent = '▶';
        } else {
            this.expandedFolders.add(path);
            element.classList.add('expanded');
            
            // Update icon
            const expandIcon = element.querySelector('.expand-icon');
            expandIcon.textContent = '▼';
            
            // Add children container
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'file-tree-children';
            element.parentNode.insertBefore(childrenContainer, element.nextSibling);
            
            // Load and render children
            try {
                const children = await this.loadDirectoryContents(path);
                const childTree = this.buildTree(children);
                const level = (element.style.paddingLeft.match(/\d+/) || ['16'])[0];
                const currentLevel = Math.floor((parseInt(level) - 16) / 20);
                this.renderTree(childTree, childrenContainer, currentLevel + 1);
            } catch (error) {
                childrenContainer.innerHTML = `<div class="loading" style="color: var(--error-color);">Error loading folder</div>`;
            }
        }
    }

    async loadDirectoryContents(path) {
        return await window.api.listFiles(path);
    }

    selectFile(path, element) {
        // Remove previous selection
        this.container.querySelectorAll('.file-tree-item.active').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add selection to clicked item
        element.classList.add('active');
        this.selectedPath = path;
        
        // Notify parent
        this.onFileSelect?.(path);
    }

    // Public methods
    getSelectedPath() {
        return this.selectedPath;
    }

    clearSelection() {
        this.container.querySelectorAll('.file-tree-item.active').forEach(item => {
            item.classList.remove('active');
        });
        this.selectedPath = null;
    }

    async createFile(path, isDirectory = false) {
        try {
            if (isDirectory) {
                await window.api.createDirectory(path);
            } else {
                // Check if it's a recipe file
                if (path.endsWith('.md')) {
                    await window.api.createRecipe(path, true);
                } else {
                    await window.api.createFile(path, '');
                }
            }
            await this.refresh();
        } catch (error) {
            throw new Error(`Failed to create ${isDirectory ? 'folder' : 'file'}: ${error.message}`);
        }
    }

    async deleteFile(path, isDirectory = false) {
        try {
            if (isDirectory) {
                await window.api.deleteDirectory(path);
            } else {
                await window.api.deleteFile(path);
            }
            
            // Clear selection if deleted file was selected
            if (this.selectedPath === path) {
                this.clearSelection();
                this.onFileSelect?.(null);
            }
            
            await this.refresh();
        } catch (error) {
            throw new Error(`Failed to delete ${isDirectory ? 'folder' : 'file'}: ${error.message}`);
        }
    }

    async renameFile(oldPath, newPath) {
        try {
            await window.api.moveFile(oldPath, newPath);
            
            // Update selection if renamed file was selected
            if (this.selectedPath === oldPath) {
                this.selectedPath = newPath;
            }
            
            await this.refresh();
        } catch (error) {
            throw new Error(`Failed to rename file: ${error.message}`);
        }
    }

    // Real-time update methods
    notifyFileChanged(path) {
        // Update the visual indicator for the changed file
        const fileElements = this.container.querySelectorAll('.file-tree-item.file');
        fileElements.forEach(element => {
            const nameElement = element.querySelector('.name');
            if (nameElement && this.getFullPathFromElement(element) === path) {
                // Add a subtle visual indicator that the file was updated
                element.classList.add('recently-updated');
                setTimeout(() => {
                    element.classList.remove('recently-updated');
                }, 2000);
            }
        });
    }

    getFullPathFromElement(element) {
        const nameElement = element.querySelector('.name');
        return nameElement ? nameElement.textContent : '';
    }

    // Debounced refresh for performance
    scheduleRefresh() {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }
        this.refreshTimeout = setTimeout(() => {
            this.refresh();
        }, 1000);
    }

    // Drag and Drop functionality
    setupDragAndDrop(element, path, type) {
        // Make element draggable
        element.draggable = true;
        element.dataset.path = path;
        element.dataset.type = type;

        // Drag start
        element.addEventListener('dragstart', (e) => {
            element.classList.add('dragging');
            e.dataTransfer.setData('text/plain', JSON.stringify({
                path: path,
                type: type,
                name: this.getFileName(path)
            }));
            e.dataTransfer.effectAllowed = 'move';

            // Create custom drag image
            this.createDragGhost(e, this.getFileName(path), type);
        });

        // Drag end
        element.addEventListener('dragend', (e) => {
            element.classList.remove('dragging');
            this.removeDragGhost();
            // Clean up any drag-over states
            this.clearDragStates();
        });

        // Only directories can be drop targets
        if (type === 'directory') {
            this.setupDropTarget(element, path);
        }

        // Also setup root drop target (files can be moved to root)
        this.setupRootDropTarget();
    }

    setupDropTarget(element, targetPath) {
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const dragData = this.getDragData(e);
            if (dragData && dragData.path !== targetPath) {
                element.classList.add('drag-over');
                e.dataTransfer.dropEffect = 'move';
            }
        });

        element.addEventListener('dragleave', (e) => {
            // Only remove if we're actually leaving this element
            if (!element.contains(e.relatedTarget)) {
                element.classList.remove('drag-over');
            }
        });

        element.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            element.classList.remove('drag-over');
            
            const dragData = this.getDragData(e);
            if (dragData && dragData.path !== targetPath) {
                this.handleDrop(dragData, targetPath);
            }
        });
    }

    setupRootDropTarget() {
        if (this.rootDropSetup) return; // Avoid duplicate setup

        const fileTreeContainer = this.container;
        
        fileTreeContainer.addEventListener('dragover', (e) => {
            // Only allow drop on empty space (not on file/folder elements)
            if (!e.target.closest('.file-tree-item')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }
        });

        fileTreeContainer.addEventListener('drop', (e) => {
            // Only handle drop on empty space
            if (!e.target.closest('.file-tree-item')) {
                e.preventDefault();
                
                const dragData = this.getDragData(e);
                if (dragData) {
                    this.handleDrop(dragData, ''); // Empty string means root
                }
            }
        });

        this.rootDropSetup = true;
    }

    getDragData(e) {
        try {
            return JSON.parse(e.dataTransfer.getData('text/plain'));
        } catch {
            return null;
        }
    }

    async handleDrop(dragData, targetPath) {
        const sourcePath = dragData.path;
        const fileName = this.getFileName(sourcePath);
        
        // Calculate destination path
        let destinationPath;
        if (targetPath === '') {
            // Dropped on root
            destinationPath = fileName;
        } else {
            // Dropped on a directory
            destinationPath = `${targetPath}/${fileName}`;
        }

        // Don't move if it's the same location
        if (sourcePath === destinationPath) {
            return;
        }

        // Prevent moving a directory into itself
        if (dragData.type === 'directory' && targetPath.startsWith(sourcePath + '/')) {
            window.app?.showError('Cannot move a folder into itself');
            return;
        }

        try {
            await window.api.moveFile(sourcePath, destinationPath);
            
            // Update current file selection if needed
            if (this.selectedPath === sourcePath) {
                this.selectedPath = destinationPath;
                // Update editor if this file is currently open
                if (window.app?.editor?.getCurrentFile() === sourcePath) {
                    window.app.editor.currentFile = destinationPath;
                }
            }
            
            await this.refresh();
            window.app?.showSuccess(`Moved ${fileName} successfully`);
            
        } catch (error) {
            console.error('Failed to move file:', error);
            window.app?.showError('Failed to move file: ' + Utils.extractErrorMessage(error));
        }
    }

    createDragGhost(e, fileName, type) {
        const ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        ghost.textContent = `${type === 'directory' ? '📁' : '📄'} ${fileName}`;
        
        document.body.appendChild(ghost);
        this.dragGhost = ghost;
        
        // Position the ghost element
        this.updateDragGhost(e);
        
        // Hide the default drag image
        const emptyImg = new Image();
        emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';
        e.dataTransfer.setDragImage(emptyImg, 0, 0);
        
        // Track mouse movement to update ghost position
        document.addEventListener('dragover', this.updateDragGhost.bind(this));
    }

    updateDragGhost(e) {
        if (this.dragGhost) {
            this.dragGhost.style.left = (e.clientX + 10) + 'px';
            this.dragGhost.style.top = (e.clientY - 10) + 'px';
        }
    }

    removeDragGhost() {
        if (this.dragGhost) {
            document.removeEventListener('dragover', this.updateDragGhost.bind(this));
            this.dragGhost.remove();
            this.dragGhost = null;
        }
    }

    clearDragStates() {
        // Remove all drag-over classes
        this.container.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    }

    getFileName(path) {
        return path.split('/').pop() || path;
    }
}