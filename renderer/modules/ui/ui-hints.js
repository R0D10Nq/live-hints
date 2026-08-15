/**
 * UI Hints - управление подсказками и пагинацией
 */

import { logger } from '../utils/logger.js';

export class UIHints {
  constructor(elements, utils) {
    this.elements = elements;
    this.utils = utils;
    this.hints = [];
    this.currentHintIndex = 0;
    this.lastHintText = '';
  }

  showPrevHint() {
    if (this.currentHintIndex > 0) {
      this.currentHintIndex--;
      this.displayCurrentHint('slide-right');
    }
  }

  showNextHint() {
    if (this.currentHintIndex < this.hints.length - 1) {
      this.currentHintIndex++;
      this.displayCurrentHint('slide-left');
    }
  }

  goToLastHint() {
    if (this.hints.length > 0) {
      this.currentHintIndex = this.hints.length - 1;
      this.displayCurrentHint('slide-left');
    }
  }

  displayCurrentHint(animation = null) {
    const feed = this.elements.hintsFeed;
    if (!feed || this.hints.length === 0) {
      this.showEmptyState();
      return;
    }

    this.hideEmptyState();
    const hint = this.hints[this.currentHintIndex];

    const typeIcons = {
      technical:
        '<svg class="type-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
      experience:
        '<svg class="type-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
      general:
        '<svg class="type-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    };
    const typeLabels = { technical: 'Технический', experience: 'Опыт', general: 'Общий' };
    const typeIcon =
      typeIcons[hint.questionType] ||
      '<svg class="type-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>';
    const typeLabel = typeLabels[hint.questionType] || '';

    const card = document.createElement('div');
    card.className = `hint-card hint-page${animation ? ` ${animation}` : ''}`;
    card.innerHTML = `
      <div class="hint-card-header">
        <div class="hint-number">
          <span class="hint-number-current">${this.currentHintIndex + 1}</span>
          <span class="hint-number-separator">/</span>
          <span class="hint-number-total">${this.hints.length}</span>
        </div>
        ${
          hint.questionType
            ? `
          <div class="hint-type-badge type-${hint.questionType}">
            <span>${typeIcon}</span>
            <span>${typeLabel}</span>
          </div>
        `
            : ''
        }
        <div class="hint-meta-badges">
          ${hint.cached ? '<span class="hint-badge hint-badge-cache">Кэш</span>' : ''}
          ${hint.latencyMs && !hint.cached ? `<span class="hint-badge hint-badge-latency">${this.utils.formatLatency(hint.latencyMs)}</span>` : ''}
        </div>
      </div>
      <div class="hint-content-wrapper">
        <div class="hint-content">${this.utils.renderMarkdown(hint.text)}</div>
      </div>
      <div class="hint-card-footer">
        <span class="hint-timestamp">${this.utils.formatTime(hint.timestamp)}</span>
        <button class="hint-copy-btn" title="Копировать"><svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
      </div>
    `;

    feed.innerHTML = '';
    feed.appendChild(card);

    card.querySelector('.hint-copy-btn')?.addEventListener('click', () => this.copyCurrentHint());

    if (animation) {
      requestAnimationFrame(() => {
        card.classList.remove(animation);
        card.classList.add('hint-page-active');
      });
    } else {
      card.classList.add('hint-page-active');
    }

    this.updatePaginationControls();
  }

  updatePaginationControls() {
    const counter = this.elements.hintsCounter;
    const prevBtn = this.elements.btnPrevHint;
    const nextBtn = this.elements.btnNextHint;

    if (counter) {
      counter.textContent =
        this.hints.length > 0 ? `${this.currentHintIndex + 1} / ${this.hints.length}` : '0 / 0';
    }

    if (prevBtn) prevBtn.disabled = this.currentHintIndex <= 0;
    if (nextBtn) nextBtn.disabled = this.currentHintIndex >= this.hints.length - 1;
  }

  updatePaginationButtons() {
    this.updatePaginationControls();
  }

  copyCurrentHint() {
    if (this.hints.length === 0) return;

    const hint = this.hints[this.currentHintIndex];
    navigator.clipboard
      .writeText(hint.text)
      .then(() => this.utils.showToast('Скопировано в буфер', 'success'))
      .catch(() => this.utils.showToast('Ошибка копирования', 'error'));
  }

  addHintItem(text, timestamp, latencyMs = null) {
    if (text === this.lastHintText) {
      logger.debug('LLM', 'Дубликат подсказки, пропускаем');
      return;
    }
    this.lastHintText = text;
    this.addFeedItem(this.elements.hintsFeed, text, timestamp, latencyMs);
  }

  addFeedItem(feed, text, timestamp, latencyMs = null) {
    if (!feed) return;

    const placeholder = feed.querySelector('.placeholder');
    if (placeholder) placeholder.remove();

    const item = document.createElement('div');
    item.className = 'feed-item';

    const latencyBadge = latencyMs
      ? `<span class="latency-badge">${this.utils.formatLatency(latencyMs)}</span>`
      : '';
    const renderedText = this.utils.renderMarkdown(text);

    item.innerHTML = `
      <div class="feed-item-time">${this.utils.formatTime(timestamp)}${latencyBadge}</div>
      <div class="feed-item-text">${renderedText}</div>
    `;

    feed.appendChild(item);
    feed.scrollTop = feed.scrollHeight;
  }

  showLoading() {
    const emptyState = document.getElementById('hints-empty-state');
    if (emptyState) emptyState.classList.add('hidden');

    const loadingState = document.getElementById('hints-loading-state');
    if (loadingState) loadingState.classList.remove('hidden');

    const feed = this.elements.hintsFeed;
    if (feed) {
      const existingLoader = feed.querySelector('.hint-loading');
      if (existingLoader) existingLoader.remove();
    }
  }

  hideLoading() {
    const loadingState = document.getElementById('hints-loading-state');
    if (loadingState) loadingState.classList.add('hidden');

    const feed = this.elements.hintsFeed;
    if (feed) {
      const loader = feed.querySelector('.hint-loading');
      if (loader) loader.remove();
    }
  }

  showEmptyState() {
    const emptyState = document.getElementById('hints-empty-state');
    const loadingState = document.getElementById('hints-loading-state');
    if (emptyState) emptyState.classList.remove('hidden');
    if (loadingState) loadingState.classList.add('hidden');
  }

  hideEmptyState() {
    const emptyState = document.getElementById('hints-empty-state');
    if (emptyState) emptyState.classList.add('hidden');
  }

  createStreamingElement() {
    const feed = this.elements.hintsFeed;
    if (!feed) return null;

    const item = document.createElement('div');
    item.className = 'feed-item streaming-hint';
    item.innerHTML = `
      <div class="feed-item-time">${this.utils.formatTime(new Date().toISOString())}</div>
      <div class="feed-item-text"></div>
    `;
    feed.appendChild(item);
    feed.scrollTop = feed.scrollHeight;
    return item;
  }

  updateStreamingHint(element, text) {
    if (!element) return;
    const textEl = element.querySelector('.feed-item-text');
    if (textEl) {
      textEl.innerHTML = this.utils.renderMarkdown(text);
    }
    const feed = this.elements.hintsFeed;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }

  finalizeStreamingHint(element, text, options = {}) {
    if (!element) return;

    const { latencyMs, cached, questionType } = options;

    this.hints.push({
      text: text,
      timestamp: new Date().toISOString(),
      latencyMs: latencyMs,
      cached: cached,
      questionType: questionType,
    });

    element.remove();
    this.currentHintIndex = this.hints.length - 1;
    this.displayCurrentHint('slide-left');
  }

  clear() {
    if (this.elements.hintsFeed) {
      this.elements.hintsFeed.innerHTML = '<p class="placeholder">Подсказки появятся здесь...</p>';
    }
    this.lastHintText = '';
    this.hints = [];
    this.currentHintIndex = 0;
    this.updatePaginationControls();
  }

  getHintsText() {
    if (this.hints && this.hints.length > 0) {
      return this.hints.map((hint, index) => `[${index + 1}] ${hint.text}`).join('\n\n');
    }
    const items = this.elements.hintsFeed?.querySelectorAll('.feed-item-text, .hint-content');
    return items
      ? Array.from(items)
          .map((el) => el.textContent)
          .join('\n')
      : '';
  }
}
