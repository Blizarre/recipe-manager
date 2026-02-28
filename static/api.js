// API client for Recipe Manager
class RecipeAPI {
  constructor(baseURL = "/api") {
    this.baseURL = baseURL;
  }

  async request(method, endpoint, data = null) {
    const url = `${this.baseURL}${endpoint}`;
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: "Unknown error" }));

        // For version conflicts, preserve the full error structure
        if (
          response.status === 409 &&
          errorData.detail &&
          typeof errorData.detail === "object" &&
          errorData.detail.type === "version_conflict"
        ) {
          const error = new Error(errorData.detail.message);
          error.isVersionConflict = true;
          error.conflictData = errorData.detail;
          throw error;
        }

        // Handle other error response formats
        let errorMessage = "Unknown error";
        if (errorData.detail) {
          if (typeof errorData.detail === "string") {
            errorMessage = errorData.detail;
          } else if (typeof errorData.detail === "object") {
            // Handle FastAPI validation errors or complex error objects
            if (errorData.detail.message) {
              errorMessage = errorData.detail.message;
            } else if (Array.isArray(errorData.detail)) {
              // Handle validation error arrays
              errorMessage = errorData.detail
                .map((err) => err.msg || err.message || "Validation error")
                .join(", ");
            } else {
              errorMessage = JSON.stringify(errorData.detail);
            }
          }
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else {
          errorMessage = `HTTP ${response.status}`;
        }

        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error [${method} ${endpoint}]:`, error);
      throw error;
    }
  }

  // File operations
  async listFiles(path = "") {
    return this.request("GET", `/files?path=${encodeURIComponent(path)}`);
  }

  async getFile(path) {
    return this.request("GET", `/files/${encodeURIComponent(path)}`);
  }

  async saveFile(path, content, version = null) {
    return this.request("PUT", `/files/${encodeURIComponent(path)}`, {
      content,
      version,
    });
  }

  async createFile(path, content) {
    return this.request("POST", `/files/${encodeURIComponent(path)}`, {
      content,
    });
  }

  async deleteFile(path) {
    return this.request("DELETE", `/files/${encodeURIComponent(path)}`);
  }

  async moveFile(path, destination) {
    return this.request("POST", `/files/${encodeURIComponent(path)}/move`, {
      destination,
    });
  }

  // Directory operations
  async createDirectory(path) {
    return this.request("POST", `/directories/${encodeURIComponent(path)}`);
  }

  async deleteDirectory(path) {
    return this.request("DELETE", `/directories/${encodeURIComponent(path)}`);
  }

  // Recipe-specific operations
  async createRecipe(path) {
    return this.request("POST", `/recipes/${encodeURIComponent(path)}`);
  }

  // Search operations
  async searchContent(query, limit = 50) {
    return this.request(
      "GET",
      `/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    );
  }

  async searchFiles(query, limit = 50) {
    return this.request(
      "GET",
      `/search/files?q=${encodeURIComponent(query)}&limit=${limit}`,
    );
  }
}

// Create global API instance
window.api = new RecipeAPI();
