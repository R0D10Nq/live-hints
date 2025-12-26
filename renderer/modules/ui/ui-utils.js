/**
 * UI Utils - утилиты для UI (toast, markdown, escape)
 */

import { TIMEOUTS } from '../constants.js';

export class UIUtils {
  constructor(elements) {
    this.elements = elements;
  }

  showToast(message, type = 'info') {
    if (this.elements.errorMessage) {
      this.elements.errorMessage.textContent = message;
    }
    if (this.elements.errorToast) {
      this.elements.errorToast.classList.remove('hidden');
      this.elements.errorToast.style.background = type === 'success' ? 'var(--accent-success)' : '';
      setTimeout(() => {
        this.elements.errorToast.classList.add('hidden');
        this.elements.errorToast.style.background = '';
      }, TIMEOUTS.TOAST_DURATION);
    }
  }

  showError(message) {
    if (this.elements.errorMessage) {
      this.elements.errorMessage.textContent = message;
    }
    if (this.elements.errorToast) {
      this.elements.errorToast.classList.remove('hidden');
    }
    setTimeout(() => this.hideError(), TIMEOUTS.ERROR_TOAST_DURATION);
  }

  hideError() {
    this.elements.errorToast?.classList.add('hidden');
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  formatLatency(latencyMs) {
    if (latencyMs == null) return '';
    const seconds = latencyMs / 1000;
    return `${seconds.toFixed(1)}s`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  renderMarkdown(text) {
    if (!text) return '';

    let html = this.escapeHtml(text);

    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/\n/g, '<br>');
    html = html.replace(/<\/li><br>/g, '</li>');
    html = html.replace(/<br><li>/g, '<li>');

    return html;
  }
}
