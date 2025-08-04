// Photo Management Component
class PhotoManager {
  constructor() {
    this.currentRecipe = null;
    this.isLoading = false;
    this.isPhotoViewActive = false;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Toggle button
    const togglePhotoBtn = document.getElementById('togglePhotoBtn');
    
    // Photo upload buttons
    const addPhotoBtn = document.getElementById('addPhotoBtn');
    const photoFileInput = document.getElementById('photoFileInput');
    const changePhotoBtn = document.getElementById('changePhotoBtn');
    const deletePhotoBtn = document.getElementById('deletePhotoBtn');

    if (togglePhotoBtn) {
      togglePhotoBtn.addEventListener('click', () => this.togglePhotoView());
    }

    if (addPhotoBtn) {
      addPhotoBtn.addEventListener('click', () => this.triggerFileInput());
    }

    if (changePhotoBtn) {
      changePhotoBtn.addEventListener('click', () => this.triggerFileInput());
    }

    if (deletePhotoBtn) {
      deletePhotoBtn.addEventListener('click', () => this.deletePhoto());
    }

    if (photoFileInput) {
      photoFileInput.addEventListener('change', (e) => this.handleFileSelection(e));
    }
  }

  setCurrentRecipe(recipePath) {
    this.currentRecipe = recipePath;
    this.isPhotoViewActive = false;
    this.showEditorView();
    if (recipePath) {
      this.loadPhotoForRecipe(recipePath);
    }
  }

  togglePhotoView() {
    this.isPhotoViewActive = !this.isPhotoViewActive;
    
    if (this.isPhotoViewActive) {
      this.showPhotoView();
    } else {
      this.showEditorView();
    }
  }

  showEditorView() {
    const editorPanel = document.getElementById('editorPanel');
    const photoPanel = document.getElementById('photoPanel');
    const toggleBtn = document.getElementById('togglePhotoBtn');
    
    if (editorPanel) editorPanel.style.display = 'block';
    if (photoPanel) photoPanel.style.display = 'none';
    
    if (toggleBtn) {
      toggleBtn.classList.remove('btn-primary');
      toggleBtn.classList.add('btn-secondary');
    }
    
    this.isPhotoViewActive = false;
  }

  showPhotoView() {
    const editorPanel = document.getElementById('editorPanel');
    const photoPanel = document.getElementById('photoPanel');
    const toggleBtn = document.getElementById('togglePhotoBtn');
    
    if (editorPanel) editorPanel.style.display = 'none';
    if (photoPanel) photoPanel.style.display = 'block';
    
    if (toggleBtn) {
      toggleBtn.classList.remove('btn-secondary');
      toggleBtn.classList.add('btn-primary');
    }
    
    this.isPhotoViewActive = true;
  }

  async loadPhotoForRecipe(recipePath) {
    if (!recipePath) {
      return;
    }

    try {
      const response = await fetch(`/api/photos/${recipePath}`);
      
      if (response.ok) {
        // Photo exists
        const photoBlob = await response.blob();
        const photoUrl = URL.createObjectURL(photoBlob);
        this.showPhotoExists(photoUrl);
      } else if (response.status === 404) {
        // No photo exists
        this.showPhotoPlaceholder();
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error loading photo:', error);
      this.showPhotoPlaceholder();
      this.showError('Failed to load photo');
    }
  }

  triggerFileInput() {
    const photoFileInput = document.getElementById('photoFileInput');
    if (photoFileInput) {
      photoFileInput.click();
    }
  }

  async handleFileSelection(event) {
    const file = event.target.files[0];
    if (!file || !this.currentRecipe) {
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/jpeg') || 
        !file.name.toLowerCase().match(/\.(jpg|jpeg)$/)) {
      this.showError('Please select a JPEG image file');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      this.showError('File size must be less than 10MB');
      return;
    }

    await this.uploadPhoto(file);
  }

  async uploadPhoto(file) {
    if (!this.currentRecipe) {
      this.showError('No recipe selected');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/photos/${this.currentRecipe}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      // Success - reload the photo
      await this.loadPhotoForRecipe(this.currentRecipe);
      this.showSuccess('Photo uploaded successfully');
    } catch (error) {
      console.error('Error uploading photo:', error);
      this.showError('Failed to upload photo: ' + error.message);
    } finally {
      // Clear the file input
      const photoFileInput = document.getElementById('photoFileInput');
      if (photoFileInput) {
        photoFileInput.value = '';
      }
    }
  }

  async deletePhoto() {
    if (!this.currentRecipe) {
      return;
    }

    if (!confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    try {
      const response = await fetch(`/api/photos/${this.currentRecipe}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Delete failed');
      }

      this.showPhotoPlaceholder();
      this.showSuccess('Photo deleted successfully');
    } catch (error) {
      console.error('Error deleting photo:', error);
      this.showError('Failed to delete photo: ' + error.message);
    }
  }

  showPhotoPlaceholder() {
    const photoPlaceholder = document.getElementById('photoPlaceholder');
    const photoDisplay = document.getElementById('photoDisplay');
    
    if (photoPlaceholder) {
      photoPlaceholder.style.display = 'block';
    }
    if (photoDisplay) {
      photoDisplay.style.display = 'none';
    }

    this.clearError();
  }

  showPhotoExists(photoUrl) {
    const photoPlaceholder = document.getElementById('photoPlaceholder');
    const photoDisplay = document.getElementById('photoDisplay');
    const photoImage = document.getElementById('photoImage');
    
    if (photoPlaceholder) {
      photoPlaceholder.style.display = 'none';
    }
    if (photoDisplay) {
      photoDisplay.style.display = 'block';
    }
    if (photoImage) {
      photoImage.src = photoUrl;
    }

    this.clearError();
  }

  showError(message) {
    const photoView = document.querySelector('.photo-view');
    if (!photoView) return;

    // Remove existing error
    this.clearError();

    // Add error message
    const error = document.createElement('div');
    error.className = 'photo-error';
    error.textContent = message;
    photoView.appendChild(error);

    // Auto-remove error after 5 seconds
    setTimeout(() => this.clearError(), 5000);
  }

  clearError() {
    const photoView = document.querySelector('.photo-view');
    if (!photoView) return;

    const error = photoView.querySelector('.photo-error');
    if (error) {
      error.remove();
    }
  }

  showSuccess(message) {
    // Use existing status system if available
    if (window.app && typeof window.app.showStatus === 'function') {
      window.app.showStatus(message);
    } else {
      console.log('Success:', message);
    }
  }
}