// API client for Recipe Manager
class RecipeAPI {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
    }

    async request(method, endpoint, data = null) {
        const url = `${this.baseURL}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
                throw new Error(errorData.detail || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error [${method} ${endpoint}]:`, error);
            throw error;
        }
    }

    // File operations
    async listFiles(path = '') {
        return this.request('GET', `/files?path=${encodeURIComponent(path)}`);
    }

    async getFile(path) {
        return this.request('GET', `/files/${encodeURIComponent(path)}`);
    }

    async saveFile(path, content) {
        return this.request('PUT', `/files/${encodeURIComponent(path)}`, { content });
    }

    async createFile(path, content) {
        return this.request('POST', `/files/${encodeURIComponent(path)}`, { content });
    }

    async deleteFile(path) {
        return this.request('DELETE', `/files/${encodeURIComponent(path)}`);
    }

    async moveFile(path, destination) {
        return this.request('POST', `/files/${encodeURIComponent(path)}/move`, { destination });
    }

    // Directory operations
    async getDirectoryTree(path = '') {
        return this.request('GET', `/directories?path=${encodeURIComponent(path)}`);
    }

    async createDirectory(path) {
        return this.request('POST', `/directories/${encodeURIComponent(path)}`);
    }

    async deleteDirectory(path) {
        return this.request('DELETE', `/directories/${encodeURIComponent(path)}`);
    }

    // Recipe-specific operations
    async getRecipeTemplate(title = 'New Recipe') {
        return this.request('GET', `/recipes/template?title=${encodeURIComponent(title)}`);
    }

    async validateRecipe(content) {
        return this.request('POST', '/recipes/validate', { 
            content, 
            validate_recipe: true 
        });
    }

    async saveRecipe(path, content, validate = true) {
        return this.request('PUT', `/recipes/${encodeURIComponent(path)}`, { 
            content, 
            validate_recipe: validate 
        });
    }

    async createRecipe(path, useTemplate = true) {
        return this.request('POST', `/recipes/${encodeURIComponent(path)}?use_template=${useTemplate}`);
    }

    async getRecipeInfo(path) {
        return this.request('GET', `/recipes/${encodeURIComponent(path)}/info`);
    }

    // Search operations
    async searchContent(query, limit = 50) {
        return this.request('GET', `/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    }

    async searchFiles(query, limit = 50) {
        return this.request('GET', `/search/files?q=${encodeURIComponent(query)}&limit=${limit}`);
    }

    // Upload
    async uploadFile(file, path) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', path);

        const response = await fetch(`${this.baseURL}/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }));
            throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        return await response.json();
    }
}

// Create global API instance
window.api = new RecipeAPI();