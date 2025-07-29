// Touch Gestures Handler
class TouchGesturesHandler {
    constructor(app) {
        this.app = app;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchStartTime = 0;
        this.isSwiping = false;
        this.swipeThreshold = 50; // minimum distance for swipe
        this.swipeVelocityThreshold = 0.5; // pixels per ms
        
        this.init();
    }

    init() {
        this.setupOverlayTap();
    }

    setupOverlayTap() {
        // Overlay tap to close sidebar
        const overlay = document.getElementById('overlay');
        overlay?.addEventListener('touchstart', (e) => this.handleOverlayTouch(e), { passive: false });
    }





    // Overlay touch handler
    handleOverlayTouch(e) {
        e.preventDefault();
        this.closeSidebar();
    }

    // Utility methods
    openSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        const menuToggle = document.getElementById('menuToggle');
        
        sidebar?.classList.add('active');
        overlay?.classList.add('active');
        menuToggle?.classList.add('active');
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        const menuToggle = document.getElementById('menuToggle');
        
        sidebar?.classList.remove('active');
        overlay?.classList.remove('active');
        menuToggle?.classList.remove('active');
        
        // Restore body scroll
        document.body.style.overflow = '';
    }

    getPathFromFileTreeItem(item) {
        // This is a simplified implementation - you might need to traverse up the tree
        // to get the full path for nested items
        const nameElement = item.querySelector('.name');
        return nameElement ? nameElement.textContent : null;
    }

}