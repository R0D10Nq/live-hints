/**
 * Hint Component
 * Manages hint display and interactions
 */

import { animations } from './animation-engine.js';

export class HintComponent {
  constructor(container, options = {}) {
    this.container = container;
    this.onCopy = options.onCopy || (() => {});
    this.onNavigate = options.onNavigate || (() => {});
  }

  /**
   * Create hint card element
   */
  createHintCard(hint, index, total) {
    const card = document.createElement('div');
    card.className = 'hint-card';
    card.dataset.index = index;

    card.innerHTML = `
      <div class="hint-header">
        <div class="hint-meta">
          <span class="hint-number">${index + 1} / ${total}</span>
          <span class="hint-timestamp">${this.formatTime(hint.timestamp)}</span>
        </div>
        <div class="hint-badges">
          ${hint.type ? `<span class="badge badge-secondary">${hint.type}</span>` : ''}
          ${hint.confidence ? `<span class="badge badge-${this.getConfidenceClass(hint.confidence)}">${hint.confidence}</span>` : ''}
        </div>
      </div>
      <div class="hint-content">
        ${this.formatContent(hint.text)}
      </div>
      <div class="hint-context" style="display: ${hint.context ? 'block' : 'none'}">
        <div class="hint-context-label">Контекст</div>
        <div class="hint-context-text">${hint.context || ''}</div>
      </div>
    `;

    // Add hover effect
    animations.addHoverEffect(card, { scale: 1.01, lift: -2 });

    return card;
  }

  /**
   * Format hint content with markdown-like styling
   */
  formatContent(text) {
    if (!text) return '';

    // Escape HTML
    let formatted = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold text (**text**)
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic (*text*)
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Code (`code`)
    formatted = formatted.replace(/`(.+?)`/g, '<code class="inline-code">$1</code>');

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    // Lists
    formatted = formatted.replace(/^- (.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.+<\/li>\n?)+/g, '<ul>$&</ul>');

    return formatted;
  }

  /**
   * Format timestamp
   */
  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * Get confidence badge class
   */
  getConfidenceClass(confidence) {
    const map = {
      'high': 'success',
      'medium': 'warning',
      'low': 'error'
    };
    return map[confidence.toLowerCase()] || 'secondary';
  }

  /**
   * Display hint with animation
   */
  displayHint(hint, index, total) {
    this.container.innerHTML = '';
    
    const card = this.createHintCard(hint, index, total);
    this.container.appendChild(card);

    // Animate entrance
    animations.entrance(card, 'slide-up');
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    this.container.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
        </svg>
        <div class="empty-state-title">Подсказки появятся здесь</div>
        <div class="empty-state-text">Запустите сессию и начните говорить. AI проанализирует разговор и предложит ответы.</div>
      </div>
    `;
  }

  /**
   * Show loading state
   */
  showLoadingState() {
    this.container.innerHTML = `
      <div class="empty-state">
        <div class="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div class="empty-state-title">Анализирую контекст</div>
      </div>
    `;
  }

  /**
   * Update counter display
   */
  updateCounter(current, total) {
    const counter = document.getElementById('hints-counter');
    if (counter) {
      counter.textContent = `${current + 1} / ${total}`;
    }
  }

  /**
   * Update navigation buttons state
   */
  updateNavigation(current, total) {
    const prevBtn = document.getElementById('btn-prev-hint');
    const nextBtn = document.getElementById('btn-next-hint');

    if (prevBtn) prevBtn.disabled = current <= 0;
    if (nextBtn) nextBtn.disabled = current >= total - 1;
  }
}

export class TranscriptComponent {
  constructor(container) {
    this.container = container;
    this.items = [];
  }

  /**
   * Add transcript entry
   */
  addEntry(text, options = {}) {
    const entry = document.createElement('div');
    entry.className = 'transcript-entry';

    const time = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    entry.innerHTML = `
      <div class="transcript-time">${time}</div>
      <div class="transcript-text">${this.escapeHtml(text)}</div>
    `;

    this.container.appendChild(entry);
    this.items.push(entry);

    // Animate entrance
    animations.entrance(entry, 'slide-left', 0);

    // Auto-scroll to bottom
    this.container.scrollTop = this.container.scrollHeight;

    // Limit items
    if (this.items.length > 100) {
      const removed = this.items.shift();
      removed.remove();
    }
  }

  /**
   * Clear all entries
   */
  clear() {
    this.container.innerHTML = '';
    this.items = [];

    // Show empty state
    this.container.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
        <div class="empty-state-title">Ожидание речи</div>
        <div class="empty-state-text">Начните сессию для записи транскрипта</div>
      </div>
    `;
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

export class ToastComponent {
  constructor(container) {
    this.container = container;
    this.toasts = [];
  }

  /**
   * Show toast notification
   */
  show(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span class="toast-message">${message}</span>
    `;

    this.container.appendChild(toast);
    this.toasts.push(toast);

    // Animate in
    animations.entrance(toast, 'slide-right');

    // Auto remove
    setTimeout(() => {
      this.remove(toast);
    }, duration);

    return toast;
  }

  /**
   * Remove toast
   */
  async remove(toast) {
    await animations.fadeOut(toast, { duration: 200 });
    toast.remove();
    
    const index = this.toasts.indexOf(toast);
    if (index > -1) {
      this.toasts.splice(index, 1);
    }
  }

  /**
   * Convenience methods
   */
  success(message, duration) {
    return this.show(message, 'success', duration);
  }

  error(message, duration) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration) {
    return this.show(message, 'info', duration);
  }
}
