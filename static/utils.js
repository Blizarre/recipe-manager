// Shared utilities for Recipe Manager
class Utils {
    /**
     * Safely extract error message from various error types
     * @param {any} error - The error object, string, or other type
     * @param {string} defaultMessage - Fallback message if extraction fails
     * @returns {string} - A readable error message
     */
    static extractErrorMessage(error, defaultMessage = 'Unknown error') {
        if (error && typeof error.message === 'string') {
            return error.message;
        } else if (typeof error === 'string') {
            return error;
        } else if (error && error.toString && typeof error.toString === 'function') {
            return error.toString();
        }
        return defaultMessage;
    }

    /**
     * Escape HTML characters to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} - HTML-escaped text
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Escape regex special characters
     * @param {string} string - String to escape
     * @returns {string} - Regex-escaped string
     */
    static escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Debounce function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Delay in milliseconds
     * @returns {Function} - Debounced function
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Format file size in human readable format
     * @param {number} bytes - Size in bytes
     * @returns {string} - Formatted size string
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Generate a simple hash from a string (for cache keys, etc.)
     * @param {string} str - String to hash
     * @returns {string} - Simple hash
     */
    static simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }
}

// Make Utils globally available
window.Utils = Utils;