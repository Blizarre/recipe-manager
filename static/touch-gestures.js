// Touch Gestures Handler
class TouchGesturesHandler {
    constructor(app) {
        this.app = app;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchStartTime = 0;
        this.isSwiping = false;
        this.isLongPress = false;
        this.longPressTimer = null;
        this.longPressDelay = 500; // 500ms for long press
        this.swipeThreshold = 50; // minimum distance for swipe
        this.swipeVelocityThreshold = 0.5; // pixels per ms
        
        this.init();
    }

    init() {
        this.setupLongPressGestures();
        this.setupOverlayTap();
    }

    setupOverlayTap() {
        // Overlay tap to close sidebar
        const overlay = document.getElementById('overlay');
        overlay?.addEventListener('touchstart', (e) => this.handleOverlayTouch(e), { passive: false });
    }

    setupLongPressGestures() {
        // Add long press support for file tree items
        const fileTree = document.getElementById('fileTree');
        
        fileTree?.addEventListener('touchstart', (e) => this.handleLongPressStart(e), { passive: false });
        fileTree?.addEventListener('touchmove', (e) => this.handleLongPressMove(e), { passive: false });
        fileTree?.addEventListener('touchend', (e) => this.handleLongPressEnd(e), { passive: false });
        fileTree?.addEventListener('touchcancel', (e) => this.handleLongPressCancel(e), { passive: false });
    }



    // Long press handlers
    handleLongPressStart(e) {
        const fileTreeItem = e.target.closest('.file-tree-item');
        if (!fileTreeItem) return;
        
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.isLongPress = false;
        
        // Start long press timer
        this.longPressTimer = setTimeout(() => {
            this.isLongPress = true;
            this.handleLongPress(fileTreeItem, e.touches[0]);
        }, this.longPressDelay);
    }

    handleLongPressMove(e) {
        if (!this.longPressTimer) return;
        
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - this.touchStartX);
        const deltaY = Math.abs(touch.clientY - this.touchStartY);
        
        // Cancel long press if finger moves too much
        if (deltaX > 10 || deltaY > 10) {
            this.cancelLongPress();
        }
    }

    handleLongPressEnd(e) {
        this.cancelLongPress();
        
        // If it was a long press, prevent the click event
        if (this.isLongPress) {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    handleLongPressCancel(e) {
        this.cancelLongPress();
    }

    handleLongPress(fileTreeItem, touch) {
        // Vibrate if supported
        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }
        
        // Add visual feedback
        fileTreeItem.classList.add('long-press-active');
        setTimeout(() => fileTreeItem.classList.remove('long-press-active'), 200);
        
        // Get file path and type from the item
        const nameElement = fileTreeItem.querySelector('.name');
        const isDirectory = fileTreeItem.classList.contains('directory');
        const path = this.getPathFromFileTreeItem(fileTreeItem);
        
        if (path) {
            // Trigger context menu
            const syntheticEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => {},
                stopPropagation: () => {}
            };
            
            this.app.onContextMenu(syntheticEvent, path, isDirectory ? 'directory' : 'file');
        }
    }

    cancelLongPress() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
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