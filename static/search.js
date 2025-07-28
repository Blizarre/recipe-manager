// Search Component
class SearchComponent {
    constructor(onFileSelect) {
        this.onFileSelect = onFileSelect;
        this.isSearching = false;
        this.currentQuery = '';
        this.currentSearchType = 'content';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        const searchClear = document.getElementById('searchClear');
        const searchFilters = document.querySelectorAll('input[name="searchType"]');
        
        // Search input handling - immediate search
        searchInput?.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            this.currentQuery = query;
            
            // Show/hide clear button
            searchClear.style.display = query ? 'block' : 'none';
            
            // Immediate search
            if (query.length >= 2) {
                this.performSearch(query, this.currentSearchType);
            } else if (query.length === 0) {
                this.clearSearch();
            }
        });

        // Clear search
        searchClear?.addEventListener('click', () => {
            searchInput.value = '';
            this.currentQuery = '';
            searchClear.style.display = 'none';
            this.clearSearch();
            searchInput.focus();
        });

        // Search type filters
        searchFilters.forEach(filter => {
            filter.addEventListener('change', (e) => {
                this.currentSearchType = e.target.value;
                if (this.currentQuery && this.currentQuery.length >= 2) {
                    this.performSearch(this.currentQuery, this.currentSearchType);
                }
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + F to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                searchInput?.focus();
            }
            
            // Escape to clear search
            if (e.key === 'Escape' && document.activeElement === searchInput) {
                this.clearSearch();
                searchInput.blur();
            }
        });
    }

    async performSearch(query, searchType) {
        if (this.isSearching) return;
        
        this.isSearching = true;
        this.showLoading();
        
        try {
            let results;
            
            if (searchType === 'content') {
                results = await window.api.searchContent(query);
            } else {
                results = await window.api.searchFiles(query);
            }
            
            this.displayResults(results, searchType);
            
        } catch (error) {
            console.error('Search failed:', error);
            this.showError('Search failed: ' + Utils.extractErrorMessage(error));
        } finally {
            this.isSearching = false;
        }
    }

    showLoading() {
        const searchResults = document.getElementById('searchResults');
        const searchResultsList = document.getElementById('searchResultsList');
        
        searchResults.style.display = 'block';
        searchResultsList.innerHTML = '<div class="search-loading">Searching</div>';
    }

    displayResults(results, searchType) {
        const searchResults = document.getElementById('searchResults');
        const searchResultsCount = document.getElementById('searchResultsCount');
        const searchDuration = document.getElementById('searchDuration');
        const searchResultsList = document.getElementById('searchResultsList');
        
        searchResults.style.display = 'block';
        
        // Update header
        const count = results.total || 0;
        searchResultsCount.textContent = `${count} result${count !== 1 ? 's' : ''}`;
        searchDuration.textContent = `(${results.duration_ms}ms)`;
        
        // Clear previous results
        searchResultsList.innerHTML = '';
        
        if (count === 0) {
            searchResultsList.innerHTML = '<div class="search-empty">No results found</div>';
            return;
        }
        
        // Render results
        results.results.forEach(result => {
            const resultElement = this.createResultElement(result, searchType);
            searchResultsList.appendChild(resultElement);
        });
    }

    createResultElement(result, searchType) {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        
        let typeLabel = '';
        let preview = '';
        let matches = '';
        
        if (searchType === 'content') {
            typeLabel = '<span class="search-result-type content">Content</span>';
            
            // Highlight search terms in preview
            preview = this.highlightSearchTerms(result.content_preview, this.currentQuery);
            
            // Show match information
            if (result.matches && result.matches.length > 0) {
                const matchTypes = result.matches.map(m => m.type).join(', ');
                matches = `<div class="search-result-matches">Matches: ${matchTypes}</div>`;
            }
        } else {
            typeLabel = '<span class="search-result-type filename">File</span>';
            preview = result.path;
        }
        
        div.innerHTML = `
            <div class="search-result-title">
                ${this.escapeHtml(result.title || result.name)}
                ${typeLabel}
            </div>
            <div class="search-result-preview">${preview}</div>
            <div class="search-result-path">${this.escapeHtml(result.path)}</div>
            ${matches}
        `;
        
        // Add click handler
        div.addEventListener('click', () => {
            this.onFileSelect(result.path);
            this.clearSearch(); // Optional: clear search after selection
        });
        
        return div;
    }

    highlightSearchTerms(text, query) {
        if (!text || !query) return this.escapeHtml(text);
        
        const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
        let highlightedText = this.escapeHtml(text);
        
        words.forEach(word => {
            const regex = new RegExp(`(${this.escapeRegex(word)})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<span class="search-match-highlight">$1</span>');
        });
        
        return highlightedText;
    }

    escapeHtml(text) {
        return Utils.escapeHtml(text);
    }

    escapeRegex(string) {
        return Utils.escapeRegex(string);
    }

    showError(message) {
        const searchResults = document.getElementById('searchResults');
        const searchResultsList = document.getElementById('searchResultsList');
        
        searchResults.style.display = 'block';
        searchResultsList.innerHTML = `<div class="search-empty" style="color: var(--error-color);">${this.escapeHtml(message)}</div>`;
    }


    clearSearch() {
        const searchResults = document.getElementById('searchResults');
        const searchInput = document.getElementById('searchInput');
        const searchClear = document.getElementById('searchClear');
        
        searchResults.style.display = 'none';
        this.currentQuery = '';
    }

    // Public method to focus search input
    focus() {
        const searchInput = document.getElementById('searchInput');
        searchInput?.focus();
    }

    // Public method to get current search state
    getSearchState() {
        return {
            query: this.currentQuery,
            type: this.currentSearchType,
            isSearching: this.isSearching
        };
    }
}