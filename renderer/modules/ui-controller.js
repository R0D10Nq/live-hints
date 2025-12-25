/**
 * UIController - Управление пользовательским интерфейсом
 */

import { STATUS_CONFIG, TIMEOUTS, QUESTION_TYPE_LABELS } from './constants.js';

export class UIController {
  constructor(app) {
    this.app = app;
    this.elements = {};
    this.compactMode = false;
    this.hideTranscripts = false;
    this.transcriptsCollapsed = false;
    this.lastTranscriptText = '';
    this.lastHintText = '';
  }

  cacheElements() {
    this.elements = {
      // Header controls
      btnToggle: document.getElementById('btn-toggle'),
      btnMinimize: document.getElementById('btn-minimize'),
      btnClose: document.getElementById('btn-close'),
      btnAsk: document.getElementById('btn-ask'),
      btnScreenshot: document.getElementById('btn-screenshot'),
      btnSettings: document.getElementById('btn-settings'),
      btnHistory: document.getElementById('btn-history'),
      btnHelp: document.getElementById('btn-help'),
      statusIndicator: document.getElementById('status-indicator'),

      // Transcript sidebar
      transcriptSidebar: document.getElementById('transcript-sidebar'),
      transcriptFeed: document.getElementById('transcript-feed'),
      btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
      btnExpandSidebar: document.getElementById('btn-expand-sidebar'),
      btnClearTranscript: document.getElementById('btn-clear-transcript'),

      // Hints area
      hintsFeed: document.getElementById('hints-feed'),
      hintsCounter: document.getElementById('hints-counter'),
      btnPrevHint: document.getElementById('btn-prev-hint'),
      btnNextHint: document.getElementById('btn-next-hint'),
      btnCopyHint: document.getElementById('btn-copy-hint'),
      btnClearHints: document.getElementById('btn-clear-hints'),
      streamingHint: document.getElementById('streaming-hint'),
      streamingText: document.getElementById('streaming-text'),

      // Settings panel
      settingsPanel: document.getElementById('settings-panel'),
      btnCloseSettings: document.getElementById('btn-close-settings'),
      btnBasicMode: document.getElementById('btn-basic-mode'),
      btnAdvancedMode: document.getElementById('btn-advanced-mode'),
      basicSettings: document.getElementById('basic-settings'),
      advancedSettings: document.getElementById('advanced-settings'),
      llmProvider: document.getElementById('llm-provider'),
      aiProfile: document.getElementById('ai-profile'),

      // History modal
      historyModal: document.getElementById('history-modal'),
      sessionsList: document.getElementById('sessions-list'),
      btnCloseHistory: document.getElementById('btn-close-history'),
      sessionViewModal: document.getElementById('session-view-modal'),
      sessionViewTitle: document.getElementById('session-view-title'),
      sessionTranscript: document.getElementById('session-transcript'),
      sessionHints: document.getElementById('session-hints'),
      btnCloseSessionView: document.getElementById('btn-close-session-view'),

      // Help modal
      helpModal: document.getElementById('help-modal'),
      btnCloseHelp: document.getElementById('btn-close-help'),

      // Vision modal
      visionModal: document.getElementById('vision-modal'),
      btnCloseVision: document.getElementById('btn-close-vision'),
      visionOptions: document.getElementById('vision-options'),
      visionPreview: document.getElementById('vision-preview'),
      visionResult: document.getElementById('vision-result'),

      // Toast
      errorToast: document.getElementById('error-toast'),
      errorMessage: document.getElementById('error-message'),
      btnDismissError: document.getElementById('btn-dismiss-error'),
      successToast: document.getElementById('success-toast'),
      successMessage: document.getElementById('success-message'),

      // Debug
      debugPanel: document.getElementById('debug-panel'),
      metricsSttLatency: document.getElementById('metrics-stt-latency'),
      metricsLlmLatency: document.getElementById('metrics-llm-latency'),

      // Legacy compatibility
      btnGetHint: document.getElementById('btn-ask'),
      btnPause: document.getElementById('btn-pause'),
      metricsPanel: document.getElementById('debug-panel'),
    };

    // Hints pagination state
    this.hints = [];
    this.currentHintIndex = 0;
  }

  setup() {
    this.cacheElements();
    this.bindUIEvents();
    this.restoreTranscriptState();
  }

  bindUIEvents() {
    // Settings panel toggle
    if (this.elements.btnSettings) {
      this.elements.btnSettings.addEventListener('click', () => this.toggleSettingsPanel());
    }

    if (this.elements.btnCloseSettings) {
      this.elements.btnCloseSettings.addEventListener('click', () => this.toggleSettingsPanel());
    }

    // Settings mode toggle (basic/advanced)
    if (this.elements.btnBasicMode) {
      this.elements.btnBasicMode.addEventListener('click', () => this.setSettingsMode('basic'));
    }

    if (this.elements.btnAdvancedMode) {
      this.elements.btnAdvancedMode.addEventListener('click', () =>
        this.setSettingsMode('advanced')
      );
    }

    // Transcript sidebar toggle
    if (this.elements.btnToggleSidebar) {
      this.elements.btnToggleSidebar.addEventListener('click', () =>
        this.toggleTranscriptSidebar()
      );
    }

    // Expand sidebar button
    if (this.elements.btnExpandSidebar) {
      this.elements.btnExpandSidebar.addEventListener('click', () =>
        this.toggleTranscriptSidebar()
      );
    }

    // Clear transcript
    if (this.elements.btnClearTranscript) {
      this.elements.btnClearTranscript.addEventListener('click', () => this.clearTranscript());
    }

    // Hints pagination
    if (this.elements.btnPrevHint) {
      this.elements.btnPrevHint.addEventListener('click', () => this.showPrevHint());
    }

    if (this.elements.btnNextHint) {
      this.elements.btnNextHint.addEventListener('click', () => this.showNextHint());
    }

    // Copy hint
    if (this.elements.btnCopyHint) {
      this.elements.btnCopyHint.addEventListener('click', () => this.copyCurrentHint());
    }

    // Clear hints
    if (this.elements.btnClearHints) {
      this.elements.btnClearHints.addEventListener('click', () => this.clearHints());
    }

    // Help modal
    if (this.elements.btnHelp) {
      this.elements.btnHelp.addEventListener('click', () => this.showHelpModal());
    }

    if (this.elements.btnCloseHelp) {
      this.elements.btnCloseHelp.addEventListener('click', () => this.hideHelpModal());
    }

    // History modal
    if (this.elements.btnCloseHistory) {
      this.elements.btnCloseHistory.addEventListener('click', () => this.hideHistoryModal());
    }

    // Error dismiss
    if (this.elements.btnDismissError) {
      this.elements.btnDismissError.addEventListener('click', () => this.hideError());
    }

    // Modal backdrop clicks
    this.elements.historyModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.historyModal) this.hideHistoryModal();
    });

    this.elements.helpModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.helpModal) this.hideHelpModal();
    });

    this.elements.sessionViewModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.sessionViewModal) this.hideSessionView();
    });
  }

  // Settings panel
  toggleSettingsPanel() {
    this.elements.settingsPanel?.classList.toggle('hidden');
  }

  setSettingsMode(mode) {
    if (mode === 'basic') {
      this.elements.btnBasicMode?.classList.add('active');
      this.elements.btnAdvancedMode?.classList.remove('active');
      this.elements.basicSettings?.classList.remove('hidden');
      this.elements.advancedSettings?.classList.add('hidden');
    } else {
      this.elements.btnBasicMode?.classList.remove('active');
      this.elements.btnAdvancedMode?.classList.add('active');
      this.elements.basicSettings?.classList.add('hidden');
      this.elements.advancedSettings?.classList.remove('hidden');
    }
  }

  // Transcript sidebar - 3 состояния: expanded -> compact -> collapsed -> expanded
  toggleTranscriptSidebar() {
    const sidebar = this.elements.transcriptSidebar;
    const btnCollapse = this.elements.btnToggleSidebar;
    const btnExpand = this.elements.btnExpandSidebar;

    if (!sidebar) {
      console.warn('[UI] Sidebar элемент не найден');
      return;
    }

    // Определяем текущее состояние и переключаем на следующее
    const isExpanded =
      sidebar.classList.contains('expanded') ||
      (!sidebar.classList.contains('compact') && !sidebar.classList.contains('collapsed'));
    const isCompact = sidebar.classList.contains('compact');

    // Убираем все состояния
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

    console.log('[UI] Транскрипт:', newState);

    // Показываем/скрываем кнопку разворачивания
    if (btnExpand) {
      btnExpand.classList.toggle('hidden', newState !== 'collapsed');
    }

    // Обновляем иконку кнопки
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

    // Сохраняем состояние
    try {
      localStorage.setItem('transcriptState', newState);
    } catch {
      console.warn('Не удалось сохранить состояние транскрипта');
    }
  }

  // Восстановление состояния транскрипта (поддержка 3 состояний)
  restoreTranscriptState() {
    try {
      // Поддержка legacy формата
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
      console.warn('Не удалось восстановить состояние транскрипта');
    }
  }

  // Альтернативный метод для горячих клавиш
  toggleTranscriptsVisibility() {
    this.toggleTranscriptSidebar();
  }

  // Help modal
  showHelpModal() {
    this.elements.helpModal?.classList.remove('hidden');
  }

  hideHelpModal() {
    this.elements.helpModal?.classList.add('hidden');
  }

  // Hints pagination с книжным эффектом
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

  // Перейти к последней подсказке
  goToLastHint() {
    if (this.hints.length > 0) {
      this.currentHintIndex = this.hints.length - 1;
      this.displayCurrentHint('slide-left');
    }
  }

  displayCurrentHint(animation = null) {
    const feed = this.elements.hintsFeed;
    if (!feed || this.hints.length === 0) {
      this.showHintsEmptyState();
      return;
    }

    this.hideHintsEmptyState();
    const hint = this.hints[this.currentHintIndex];

    // Типы вопросов с иконками
    const typeIcons = {
      technical: '💻',
      experience: '📋',
      general: '💬'
    };
    const typeLabels = {
      technical: 'Технический',
      experience: 'Опыт',
      general: 'Общий'
    };

    const typeIcon = typeIcons[hint.questionType] || '💡';
    const typeLabel = typeLabels[hint.questionType] || '';

    // Создаём карточку подсказки
    const card = document.createElement('div');
    card.className = `hint-card hint-page${animation ? ` ${animation}` : ''}`;
    card.innerHTML = `
      <div class="hint-card-header">
        <div class="hint-number">
          <span class="hint-number-current">${this.currentHintIndex + 1}</span>
          <span class="hint-number-separator">/</span>
          <span class="hint-number-total">${this.hints.length}</span>
        </div>
        ${hint.questionType ? `
          <div class="hint-type-badge type-${hint.questionType}">
            <span>${typeIcon}</span>
            <span>${typeLabel}</span>
          </div>
        ` : ''}
        <div class="hint-meta-badges">
          ${hint.cached ? '<span class="hint-badge hint-badge-cache">Кэш</span>' : ''}
          ${hint.latencyMs && !hint.cached ? `<span class="hint-badge hint-badge-latency">${this.formatLatency(hint.latencyMs)}</span>` : ''}
        </div>
      </div>
      <div class="hint-content-wrapper">
        <div class="hint-content">${this.renderMarkdown(hint.text)}</div>
      </div>
      <div class="hint-card-footer">
        <span class="hint-timestamp">${this.formatTime(hint.timestamp)}</span>
        <button class="hint-copy-btn" title="Копировать">
          <span>📋</span>
        </button>
      </div>
    `;

    // Очищаем feed и добавляем карточку
    feed.innerHTML = '';
    feed.appendChild(card);

    // Кнопка копирования
    card.querySelector('.hint-copy-btn')?.addEventListener('click', () => this.copyCurrentHint());

    // Анимация появления
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

  copyCurrentHint() {
    if (this.hints.length === 0) return;

    const hint = this.hints[this.currentHintIndex];
    navigator.clipboard
      .writeText(hint.text)
      .then(() => {
        this.showToast('Скопировано в буфер', 'success');
      })
      .catch(() => {
        this.showToast('Ошибка копирования', 'error');
      });
  }

  updateStatus(status) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.paused;

    if (this.elements.statusIndicator) {
      this.elements.statusIndicator.className = `status-indicator ${config.class}`;
    }
    if (this.elements.statusText) {
      this.elements.statusText.textContent = config.text;
    }
  }

  updateToggleButton(isRunning) {
    const btn = this.elements.btnToggle;
    const btnPause = this.elements.btnPause;
    if (!btn) return;

    const icon = btn.querySelector('.btn-icon');
    const label = btn.querySelector('.btn-label');

    if (isRunning) {
      // Сессия запущена: кнопка Стоп (красная), Пауза активна
      btn.classList.remove('btn-start');
      btn.classList.add('btn-stop');
      if (icon) icon.textContent = '■';
      if (label) label.textContent = 'Стоп';

      if (btnPause) {
        btnPause.disabled = false;
        const pauseIcon = btnPause.querySelector('.btn-icon');
        const pauseLabel = btnPause.querySelector('.btn-label');
        if (pauseIcon) pauseIcon.textContent = '⏸';
        if (pauseLabel) pauseLabel.textContent = 'Пауза';
      }
    } else {
      // Сессия остановлена: кнопка Старт (зелёная), Пауза неактивна
      btn.classList.remove('btn-stop');
      btn.classList.add('btn-start');
      if (icon) icon.textContent = '▶';
      if (label) label.textContent = 'Старт';

      if (btnPause) {
        btnPause.disabled = true;
        const pauseIcon = btnPause.querySelector('.btn-icon');
        const pauseLabel = btnPause.querySelector('.btn-label');
        if (pauseIcon) pauseIcon.textContent = '⏸';
        if (pauseLabel) pauseLabel.textContent = 'Пауза';
      }
    }
  }

  updatePauseButton(isPaused) {
    const btnPause = this.elements.btnPause;
    if (!btnPause) return;

    const icon = btnPause.querySelector('.btn-icon');
    const label = btnPause.querySelector('.btn-label');

    if (isPaused) {
      btnPause.classList.add('paused');
      if (icon) icon.textContent = '▶';
      if (label) label.textContent = 'Продолжить';
    } else {
      btnPause.classList.remove('paused');
      if (icon) icon.textContent = '⏸';
      if (label) label.textContent = 'Пауза';
    }
  }

  clearFeeds() {
    if (this.elements.transcriptFeed) {
      this.elements.transcriptFeed.innerHTML = '';
    }
    if (this.elements.hintsFeed) {
      this.elements.hintsFeed.innerHTML = '';
    }
    this.lastTranscriptText = '';
    this.lastHintText = '';

    // Очищаем массив подсказок (книжный режим)
    this.hints = [];
    this.currentHintIndex = 0;
    this.updatePaginationButtons();
  }

  addTranscriptItem(text, timestamp, source = 'interviewer') {
    if (text === this.lastTranscriptText) {
      console.log('[STT] Дубликат транскрипта, пропускаем');
      return;
    }
    this.lastTranscriptText = text;

    const icon = source === 'candidate' ? '🗣️' : '🎙️';
    const label = source === 'candidate' ? 'Ты' : 'Интервьюер';
    const formattedText = this.app.audio?.dualAudioEnabled ? `${icon} ${label}: ${text}` : text;

    this.addFeedItem(this.elements.transcriptFeed, formattedText, timestamp, null, source);
  }

  addHintItem(text, timestamp, latencyMs = null) {
    if (text === this.lastHintText) {
      console.log('[LLM] Дубликат подсказки, пропускаем');
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
      ? `<span class="latency-badge">${this.formatLatency(latencyMs)}</span>`
      : '';
    const isHintsFeed = feed === this.elements.hintsFeed;
    const renderedText = isHintsFeed ? this.renderMarkdown(text) : this.escapeHtml(text);

    item.innerHTML = `
            <div class="feed-item-time">${this.formatTime(timestamp)}${latencyBadge}</div>
            <div class="feed-item-text">${renderedText}</div>
        `;

    feed.appendChild(item);
    feed.scrollTop = feed.scrollHeight;
  }

  showHintLoading() {
    const feed = this.elements.hintsFeed;
    if (!feed) return;

    // Скрываем empty state
    const emptyState = document.getElementById('hints-empty-state');
    if (emptyState) emptyState.classList.add('hidden');

    // Показываем loading state
    const loadingState = document.getElementById('hints-loading-state');
    if (loadingState) loadingState.classList.remove('hidden');

    // Убираем старый loader если есть
    const existingLoader = feed.querySelector('.hint-loading');
    if (existingLoader) existingLoader.remove();
  }

  hideHintLoading() {
    const loadingState = document.getElementById('hints-loading-state');
    if (loadingState) loadingState.classList.add('hidden');

    const feed = this.elements.hintsFeed;
    if (!feed) return;
    const loader = feed.querySelector('.hint-loading');
    if (loader) loader.remove();
  }

  showHintsEmptyState() {
    const emptyState = document.getElementById('hints-empty-state');
    const loadingState = document.getElementById('hints-loading-state');
    if (emptyState) emptyState.classList.remove('hidden');
    if (loadingState) loadingState.classList.add('hidden');
  }

  hideHintsEmptyState() {
    const emptyState = document.getElementById('hints-empty-state');
    if (emptyState) emptyState.classList.add('hidden');
  }

  createStreamingHintElement() {
    const feed = this.elements.hintsFeed;
    if (!feed) return null;

    const item = document.createElement('div');
    item.className = 'feed-item streaming-hint';
    item.innerHTML = `
            <div class="feed-item-time">${this.formatTime(new Date().toISOString())}</div>
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
      textEl.innerHTML = this.renderMarkdown(text);
    }
    const feed = this.elements.hintsFeed;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }

  finalizeStreamingHint(element, text, options = {}) {
    if (!element) return;

    const { latencyMs, cached, questionType } = options;

    // Добавляем подсказку в массив для пагинации
    this.hints.push({
      text: text,
      timestamp: new Date().toISOString(),
      latencyMs: latencyMs,
      cached: cached,
      questionType: questionType
    });

    // Удаляем streaming элемент
    element.remove();

    // Переключаемся на последнюю подсказку с анимацией
    this.currentHintIndex = this.hints.length - 1;
    this.displayCurrentHint('slide-left');
  }

  // History Modal
  showHistoryModal() {
    this.renderSessionsList();
    this.elements.historyModal?.classList.remove('hidden');
  }

  hideHistoryModal() {
    this.elements.historyModal?.classList.add('hidden');
  }

  renderSessionsList() {
    const sessions = this.app.sessions.getAll();

    if (sessions.length === 0) {
      this.elements.sessionsList.innerHTML = '<p class="placeholder">Нет сохранённых сессий</p>';
      return;
    }

    this.elements.sessionsList.innerHTML = sessions
      .map((session) => {
        const transcriptLines = (session.transcript || '').split('\n').filter((l) => l.trim());
        const hintLines = (session.hints || '').split('\n').filter((l) => l.trim());
        const duration = this.app.sessions.calculateDuration(session);
        const tags = session.tags || [];

        return `
                <div class="session-card" data-session-id="${session.id}">
                    <div class="session-card-header">
                        <span class="session-card-title">${session.name || 'Сессия'}</span>
                        <span class="session-card-date">${this.app.sessions.formatDateFull(session.date)}</span>
                    </div>
                    <div class="session-card-stats">
                        <span class="session-stat">
                            <span class="stat-icon">🎙️</span>
                            <span class="stat-value">${transcriptLines.length} реплик</span>
                        </span>
                        <span class="session-stat">
                            <span class="stat-icon">💡</span>
                            <span class="stat-value">${hintLines.length} подсказок</span>
                        </span>
                        <span class="session-stat">
                            <span class="stat-icon">⏱️</span>
                            <span class="stat-value">${duration}</span>
                        </span>
                    </div>
                    ${tags.length > 0
            ? `
                        <div class="session-card-tags">
                            ${tags.map((tag) => `<span class="session-tag">${this.escapeHtml(tag)}</span>`).join('')}
                        </div>
                    `
            : ''
          }
                    <div class="session-card-preview">${this.escapeHtml((session.transcript || '').substring(0, 120))}...</div>
                    <div class="session-card-actions">
                        <button class="btn-session-view" data-action="view">Открыть</button>
                        <button class="btn-session-export" data-action="export">Экспорт</button>
                        <button class="btn-session-delete" data-action="delete">Удалить</button>
                    </div>
                </div>
            `;
      })
      .join('');

    this.elements.sessionsList.querySelectorAll('.session-card').forEach((card) => {
      const sessionId = card.dataset.sessionId;

      card.querySelector('.btn-session-view')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showSessionView(sessionId);
      });

      card.querySelector('.btn-session-export')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.sessions.exportSession(sessionId);
      });

      card.querySelector('.btn-session-delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.app.sessions.delete(sessionId)) {
          this.renderSessionsList();
          this.showToast('Сессия удалена', 'success');
        }
      });

      card.addEventListener('click', () => this.showSessionView(sessionId));
    });
  }

  showSessionView(sessionId) {
    const session = this.app.sessions.getById(sessionId);
    if (!session) return;

    const transcriptLines = (session.transcript || '').split('\n').filter((l) => l.trim());
    const hintLines = (session.hints || '').split('\n').filter((l) => l.trim());

    this.elements.sessionViewTitle.textContent =
      session.name || `Сессия от ${this.app.sessions.formatDate(session.date)}`;

    this.elements.sessionTranscript.innerHTML =
      transcriptLines.length > 0
        ? transcriptLines
          .map(
            (line) => `
                <div class="session-dialog-item">
                    <span class="dialog-icon">🎙️</span>
                    <span class="dialog-text">${this.escapeHtml(line)}</span>
                </div>
            `
          )
          .join('')
        : '<p class="placeholder">Нет транскрипта</p>';

    this.elements.sessionHints.innerHTML =
      hintLines.length > 0
        ? hintLines
          .map(
            (line) => `
                <div class="session-dialog-item hint-item">
                    <span class="dialog-icon">💡</span>
                    <span class="dialog-text">${this.renderMarkdown(line)}</span>
                </div>
            `
          )
          .join('')
        : '<p class="placeholder">Нет подсказок</p>';

    this.hideHistoryModal();
    this.elements.sessionViewModal?.classList.remove('hidden');
  }

  hideSessionView() {
    this.elements.sessionViewModal?.classList.add('hidden');
  }

  // UI Modes
  toggleSettingsDrawer() {
    if (!this.elements.settingsDrawer) return;

    const isOpen = this.elements.settingsDrawer.classList.toggle('open');
    if (this.elements.btnSettingsToggle) {
      this.elements.btnSettingsToggle.classList.toggle('active', isOpen);
    }
  }

  toggleCompactMode() {
    this.compactMode = !this.compactMode;
    document.body.classList.toggle('compact-mode', this.compactMode);

    if (this.elements.btnCompactToggle) {
      this.elements.btnCompactToggle.classList.toggle('active', this.compactMode);
    }

    this.app.saveSettings({ compactMode: this.compactMode });
  }

  toggleFocusMode() {
    this.focusMode = !this.focusMode;
    document.body.classList.toggle('focus-mode', this.focusMode);

    if (this.elements.btnFocusToggle) {
      this.elements.btnFocusToggle.classList.toggle('active', this.focusMode);
    }

    this.app.saveSettings({ focusMode: this.focusMode });
  }

  toggleTranscripts() {
    this.hideTranscripts = !this.hideTranscripts;
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.setAttribute('data-hide-transcripts', this.hideTranscripts);
    }
    const btn = document.getElementById('btn-toggle-transcripts');
    if (btn) {
      btn.textContent = this.hideTranscripts ? '👁' : '👁‍🗨';
      btn.title = this.hideTranscripts ? 'Показать транскрипты' : 'Скрыть транскрипты';
    }
    this.showToast(this.hideTranscripts ? 'Транскрипты скрыты' : 'Транскрипты показаны', 'success');
    this.app.saveSettings();
  }

  collapseTranscripts() {
    this.transcriptsCollapsed = !this.transcriptsCollapsed;
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.setAttribute('data-transcripts-collapsed', this.transcriptsCollapsed);
    }
    this.showToast(
      this.transcriptsCollapsed ? 'Транскрипты свёрнуты' : 'Транскрипты развёрнуты',
      'success'
    );
  }

  async copyLastHint() {
    const textToCopy = this.lastHintText;

    if (!textToCopy) {
      this.showToast('Нет подсказки для копирования', 'info');
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      this.showToast('Скопировано в буфер', 'success');
    } catch (error) {
      console.error('Ошибка копирования:', error);
      this.showToast('Ошибка копирования', 'error');
    }
  }

  clearHints() {
    if (this.elements.hintsFeed) {
      this.elements.hintsFeed.innerHTML = '<p class="placeholder">Подсказки появятся здесь...</p>';
    }
    this.lastHintText = '';
    this.hints = [];
    this.currentHintIndex = 0;
    this.updatePaginationControls();
  }

  clearTranscript() {
    if (this.elements.transcriptFeed) {
      this.elements.transcriptFeed.innerHTML = '<p class="placeholder">Ожидание речи...</p>';
    }
    this.app.transcriptContext = [];
    this.lastTranscriptText = '';
    this.app.lastContextHash = '';
  }

  getTranscriptText() {
    const items = this.elements.transcriptFeed?.querySelectorAll('.feed-item-text');
    return items
      ? Array.from(items)
        .map((el) => el.textContent)
        .join('\n')
      : '';
  }

  getHintsText() {
    // Возвращаем текст из массива hints (книжный режим)
    if (this.hints && this.hints.length > 0) {
      return this.hints.map((hint, index) => `[${index + 1}] ${hint.text}`).join('\n\n');
    }
    // Fallback на DOM элементы
    const items = this.elements.hintsFeed?.querySelectorAll('.feed-item-text, .hint-content');
    return items
      ? Array.from(items)
        .map((el) => el.textContent)
        .join('\n')
      : '';
  }

  // Toast/Error
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
    this.updateStatus('error');

    setTimeout(() => this.hideError(), TIMEOUTS.ERROR_TOAST_DURATION);
  }

  hideError() {
    this.elements.errorToast?.classList.add('hidden');
  }

  // Metrics panel
  toggleMetricsPanel(debugMode) {
    if (!this.elements.metricsPanel) return;

    if (debugMode) {
      this.elements.metricsPanel.classList.remove('hidden');
      document.body.classList.add('debug-mode');
    } else {
      this.elements.metricsPanel.classList.add('hidden');
      document.body.classList.remove('debug-mode');
    }
  }

  updateMetricsPanel(metrics) {
    if (this.elements.metricsSttLatency) {
      this.elements.metricsSttLatency.textContent = metrics.stt_latency_ms ?? '-';
    }
    if (this.elements.metricsLlmLatency) {
      this.elements.metricsLlmLatency.textContent = metrics.llm_server_latency_ms ?? '-';
    }
  }

  updatePaginationButtons() {
    if (!this.elements.hintsCounter) return;

    const total = this.hints?.length || 0;
    const current = total > 0 ? this.currentHintIndex + 1 : 0;
    this.elements.hintsCounter.textContent = `${current}/${total}`;

    if (this.elements.btnPrevHint) {
      this.elements.btnPrevHint.disabled = this.currentHintIndex <= 0;
    }
    if (this.elements.btnNextHint) {
      this.elements.btnNextHint.disabled = this.currentHintIndex >= total - 1;
    }
  }

  // Utilities
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
