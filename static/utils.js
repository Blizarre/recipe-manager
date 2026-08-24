// Shared utilities for Recipe Manager
class Utils {
  /**
   * Safely extract error message from various error types
   * @param {any} error - The error object, string, or other type
   * @param {string} defaultMessage - Fallback message if extraction fails
   * @returns {string} - A readable error message
   */
  static extractErrorMessage(error, defaultMessage = "Unknown error") {
    if (error && typeof error.message === "string") {
      return error.message;
    } else if (typeof error === "string") {
      return error;
    } else if (
      error &&
      error.toString &&
      typeof error.toString === "function"
    ) {
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
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Escape regex special characters
   * @param {string} string - String to escape
   * @returns {string} - Regex-escaped string
   */
  static escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Show a transient toast notification.
   * @param {string} message - Text to display
   * @param {string} type - "info", "success", or "error"
   */
  static showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icon =
      type === "error"
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    toast.innerHTML = `${icon}<span>${Utils.escapeHtml(message)}</span>`;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "slideOut 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Make Utils globally available
window.Utils = Utils;
