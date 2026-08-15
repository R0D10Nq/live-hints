/**
 * UI Transcript - управление сайдбаром транскриптов
 */

import { logger } from '../utils/logger.js';

export class UITranscript {
  constructor(elements, utils, app) {
    this.elements = elements;
    this.utils = utils;
    this.app = app;
    this.lastTranscriptText = '';
  }

  toggle() {
    const sidebar = this.elements.transcriptSidebar;
    const btnCollapse = this.elements.btnToggleSidebar;
    const btnExpand = this.elements.btnExpandSidebar;

    if (!sidebar) {
      logger.warn('UI', 'Sidebar элемент не найден');
      return;
    }

    const isExpanded =
      sidebar.classList.contains('expanded') ||
      (!sidebar.classList.contains('compact') && !sidebar.classList.contains('collapsed'));
    const isCompact = sidebar.classList.contains('compact');

    sidebar.classList.remove('expanded', 'compact', 'collapsed');

    let newState;
    if (isExpanded) {
      sidebar.classList.add('compact');
      newState = 'compact';
    } else if (isCompact) {
      sidebar.classList.add('collapsed');
      newState = 'collapsed';
    } else {
      sidebar.classList.add('expanded');
      newState = 'expanded';
    }

    logger.debug('UI', 'Транскрипт:', newState);

    if (btnExpand) {
      btnExpand.classList.toggle('hidden', newState !== 'collapsed');
    }

    if (btnCollapse) {
      const icons = { expanded: '◀', compact: '◁', collapsed: '▶' };
      const titles = {
        expanded: 'Компактный режим',
        compact: 'Свернуть транскрипт',
        collapsed: 'Развернуть транскрипт',
      };
      btnCollapse.textContent = icons[newState];
      btnCollapse.title = titles[newState];
    }

    try {
      localStorage.setItem('transcriptState', newState);
    } catch {
      logger.warn('UI', 'Не удалось сохранить состояние транскрипта');
    }
  }

  restoreState() {
    try {
      let state = localStorage.getItem('transcriptState');
      if (!state) {
        const legacyCollapsed = localStorage.getItem('transcriptCollapsed') === 'true';
        state = legacyCollapsed ? 'collapsed' : 'expanded';
      }

      const sidebar = this.elements.transcriptSidebar;
      const btnCollapse = this.elements.btnToggleSidebar;
      const btnExpand = this.elements.btnExpandSidebar;

      if (sidebar && state !== 'expanded') {
        sidebar.classList.remove('expanded', 'compact', 'collapsed');
        sidebar.classList.add(state);

        const icons = { expanded: '◀', compact: '◁', collapsed: '▶' };
        const titles = {
          expanded: 'Компактный режим',
          compact: 'Свернуть транскрипт',
          collapsed: 'Развернуть транскрипт',
        };

        if (btnCollapse) {
          btnCollapse.textContent = icons[state];
          btnCollapse.title = titles[state];
        }
        if (btnExpand) {
          btnExpand.classList.toggle('hidden', state !== 'collapsed');
        }
      }
    } catch {
      logger.warn('UI', 'Не удалось восстановить состояние транскрипта');
    }
  }

  addItem(text, timestamp, source = 'interviewer') {
    if (text === this.lastTranscriptText) {
      logger.debug('STT', 'Дубликат транскрипта, пропускаем');
      return;
    }
    this.lastTranscriptText = text;

    const label = source === 'candidate' ? 'Ты' : 'Интервьюер';
    const formattedText = this.app.audio?.dualAudioEnabled ? `${label}: ${text}` : text;

    this.addFeedItem(formattedText, timestamp, source);
  }

  addFeedItem(text, timestamp, source) {
    const feed = this.elements.transcriptFeed;
    if (!feed) return;

    const placeholder = feed.querySelector('.placeholder');
    if (placeholder) placeholder.remove();

    const item = document.createElement('div');
    item.className = 'feed-item';

    item.innerHTML = `
      <div class="feed-item-time">${this.utils.formatTime(timestamp)}</div>
      <div class="feed-item-text">${this.utils.escapeHtml(text)}</div>
    `;

    feed.appendChild(item);
    feed.scrollTop = feed.scrollHeight;
  }

  clear() {
    if (this.elements.transcriptFeed) {
      this.elements.transcriptFeed.innerHTML = '<p class="placeholder">Ожидание речи...</p>';
    }
    if (this.app) {
      this.app.transcriptContext = [];
      this.app.lastContextHash = '';
    }
    this.lastTranscriptText = '';
  }

  getText() {
    const items = this.elements.transcriptFeed?.querySelectorAll('.feed-item-text');
    return items
      ? Array.from(items)
          .map((el) => el.textContent)
          .join('\n')
      : '';
  }
}
