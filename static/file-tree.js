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
        this.refresh();
    }

    async refresh() {
        try {
            this.showLoading();
            this.files = await window.api.listFiles();
            this.render();
        } catch (error) {
            this.showError('Failed to load files: ' + error.message);
        }
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

        // Build tree structure
        const tree = this.buildTree(this.files);
        this.container.innerHTML = '';
        this.renderTree(tree, this.container);
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
        const fileElement = document.createElement('div');
        fileElement.className = `file-tree-item file ${this.selectedPath === file.path ? 'active' : ''}`;
        fileElement.style.paddingLeft = `${16 + level * 20}px`;
        
        const icon = this.getFileIcon(file.name);
        fileElement.innerHTML = `
            <span class="icon">${icon}</span>
            <span class="name">${file.name}</span>
        `;

        fileElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectFile(file.path, fileElement);
        });

        fileElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.onContextMenu?.(e, file.path, 'file');
        });

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
}