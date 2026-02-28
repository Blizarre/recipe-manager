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
}

// Make Utils globally available
window.Utils = Utils;
