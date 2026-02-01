/**
 * Modal Manager
 * Handles modal windows and overlays
 */

import { animations } from './animation-engine.js';

export class ModalManager {
  constructor() {
    this.activeModal = null;
    this.backdrop = null;
  }

  /**
   * Open modal
   */
  async open(modalId, options = {}) {
    const backdrop = document.getElementById(`${modalId}`);
    if (!backdrop) return;

    const modal = backdrop.querySelector('.modal');
    if (!modal) return;

    // Close any active modal
    if (this.activeModal) {
      await this.close(this.activeModal);
    }

    this.activeModal = modalId;
    this.backdrop = backdrop;

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Animate open
    await animations.modalOpen(backdrop, modal);

    // Setup close handlers
    this.setupCloseHandlers(backdrop, modal, options);

    // Call onOpen callback
    if (options.onOpen) {
      options.onOpen(modal);
    }
  }

  /**
   * Close modal
   */
  async close(modalId) {
    const backdrop = document.getElementById(`${modalId}`);
    if (!backdrop) return;

    const modal = backdrop.querySelector('.modal');

    // Animate close
    await animations.modalClose(backdrop, modal);

    // Restore body scroll
    document.body.style.overflow = '';

    if (this.activeModal === modalId) {
      this.activeModal = null;
      this.backdrop = null;
    }
  }

  /**
   * Close active modal
   */
  async closeActive() {
    if (this.activeModal) {
      await this.close(this.activeModal);
    }
  }

  /**
   * Setup close handlers
   */
  setupCloseHandlers(backdrop, modal, options) {
    // Click outside to close
    if (options.clickOutside !== false) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.close(options.id || this.activeModal);
          if (options.onClose) options.onClose();
        }
      });
    }

    // ESC key to close
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.close(options.id || this.activeModal);
        if (options.onClose) options.onClose();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Close button
    const closeBtn = modal.querySelector('[data-close-modal]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.close(options.id || this.activeModal);
        if (options.onClose) options.onClose();
      });
    }
  }
}

/**
 * Settings Panel Manager
 */
export class SettingsPanel {
  constructor() {
    this.panel = document.getElementById('settings-panel');
    this.isOpen = false;
  }

  open() {
    if (!this.panel) return;
    
    this.panel.classList.add('open');
    this.isOpen = true;

    // Animate content
    const sections = this.panel.querySelectorAll('.settings-section');
    animations.stagger(sections, 'slide-left', 50);
  }

  close() {
    if (!this.panel) return;
    
    this.panel.classList.remove('open');
    this.isOpen = false;
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}

/**
 * Sidebar Manager
 */
export class SidebarManager {
  constructor() {
    this.sidebar = document.getElementById('transcript-sidebar');
    this.isOpen = true;
  }

  async toggle() {
    if (!this.sidebar) return;

    this.isOpen = !this.isOpen;
    
    if (this.isOpen) {
      this.sidebar.classList.remove('collapsed');
      await animations.sidebarToggle(this.sidebar, true);
    } else {
      await animations.sidebarToggle(this.sidebar, false);
      this.sidebar.classList.add('collapsed');
    }
  }

  collapse() {
    this.isOpen = false;
    if (this.sidebar) {
      this.sidebar.classList.add('collapsed');
    }
  }

  expand() {
    this.isOpen = true;
    if (this.sidebar) {
      this.sidebar.classList.remove('collapsed');
    }
  }
}
