/**
 * UIController - Управление пользовательским интерфейсом
 * Рефакторинг: использует отдельные модули для разных ответственностей
 */

import { STATUS_CONFIG } from './constants.js';
import { logger } from './utils/logger.js';
import { cacheElements } from './ui/ui-elements.js';
import { UIUtils } from './ui/ui-utils.js';
import { UIHints } from './ui/ui-hints.js';
import { UITranscript } from './ui/ui-transcript.js';
import { UIModals } from './ui/ui-modals.js';

export class UIController {
  constructor(app) {
    this.app = app;
    this.elements = {};
    this.compactMode = false;
    this.focusMode = false;
    this.hideTranscripts = false;
  }

  setup() {
    this.elements = cacheElements();

    // Инициализация подмодулей
    this.utils = new UIUtils(this.elements);
    this.hintsUI = new UIHints(this.elements, this.utils);
    this.transcriptUI = new UITranscript(this.elements, this.utils, this.app);
    this.modals = new UIModals(this.elements, this.utils, this.app);

    this.bindUIEvents();
    this.transcriptUI.restoreState();
  }

  bindUIEvents() {
    // Settings panel toggle
    this.elements.btnSettings?.addEventListener('click', () => this.toggleSettingsPanel());
    this.elements.btnCloseSettings?.addEventListener('click', () => this.toggleSettingsPanel());

    // Settings mode toggle (basic/advanced)
    this.elements.btnBasicMode?.addEventListener('click', () => this.setSettingsMode('basic'));
    this.elements.btnAdvancedMode?.addEventListener('click', () =>
      this.setSettingsMode('advanced')
    );

    // Transcript sidebar toggle
    this.elements.btnToggleSidebar?.addEventListener('click', () => this.transcriptUI.toggle());
    this.elements.btnExpandSidebar?.addEventListener('click', () => this.transcriptUI.toggle());

    // Clear transcript
    this.elements.btnClearTranscript?.addEventListener('click', () => this.transcriptUI.clear());

    // Hints pagination
    this.elements.btnPrevHint?.addEventListener('click', () => this.hintsUI.showPrevHint());
    this.elements.btnNextHint?.addEventListener('click', () => this.hintsUI.showNextHint());

    // Copy hint
    this.elements.btnCopyHint?.addEventListener('click', () => this.hintsUI.copyCurrentHint());

    // Clear hints
    this.elements.btnClearHints?.addEventListener('click', () => this.hintsUI.clear());

    // Help modal
    this.elements.btnHelp?.addEventListener('click', () => this.modals.showHelp());
    this.elements.btnCloseHelp?.addEventListener('click', () => this.modals.hideHelp());

    // History modal
    this.elements.btnCloseHistory?.addEventListener('click', () => this.modals.hideHistory());

    // Error dismiss
    this.elements.btnDismissError?.addEventListener('click', () => this.utils.hideError());

    // Modal backdrop clicks
    this.elements.historyModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.historyModal) this.modals.hideHistory();
    });

    this.elements.helpModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.helpModal) this.modals.hideHelp();
    });

    this.elements.sessionViewModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.sessionViewModal) this.modals.hideSessionView();
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

  // Status
  updateStatus(status) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.paused;
    if (this.elements.statusIndicator) {
      this.elements.statusIndicator.className = `status-indicator ${config.class}`;
    }
  }

  updateToggleButton(isRunning) {
    const btn = this.elements.btnToggle;
    const btnPause = this.elements.btnPause;
    const btnAsk = this.elements.btnAsk;
    if (!btn) return;

    const icon = btn.querySelector('.btn-icon');
    const label = btn.querySelector('.btn-label');

    if (isRunning) {
      btn.classList.remove('btn-start');
      btn.classList.add('btn-stop');
      if (icon) icon.textContent = '■';
      if (label) label.textContent = 'Стоп';
      if (btnPause) btnPause.disabled = false;
      if (btnAsk) btnAsk.disabled = false;
    } else {
      btn.classList.remove('btn-stop');
      btn.classList.add('btn-start');
      if (icon) icon.textContent = '▶';
      if (label) label.textContent = 'Старт';
      if (btnPause) btnPause.disabled = true;
      if (btnAsk) btnAsk.disabled = true;
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

  // Proxy methods to submodules for backwards compatibility
  showToast(message, type) {
    this.utils.showToast(message, type);
  }
  showError(message) {
    this.utils.showError(message);
  }
  hideError() {
    this.utils.hideError();
  }

  addTranscriptItem(text, timestamp, source) {
    this.transcriptUI.addItem(text, timestamp, source);
  }
  addHintItem(text, timestamp, latencyMs) {
    this.hintsUI.addHintItem(text, timestamp, latencyMs);
  }

  showHintLoading() {
    this.hintsUI.showLoading();
  }
  hideHintLoading() {
    this.hintsUI.hideLoading();
  }
  showHintsEmptyState() {
    this.hintsUI.showEmptyState();
  }
  hideHintsEmptyState() {
    this.hintsUI.hideEmptyState();
  }

  createStreamingHintElement() {
    return this.hintsUI.createStreamingElement();
  }
  updateStreamingHint(el, text) {
    this.hintsUI.updateStreamingHint(el, text);
  }
  finalizeStreamingHint(el, text, opts) {
    this.hintsUI.finalizeStreamingHint(el, text, opts);
  }

  showPrevHint() {
    this.hintsUI.showPrevHint();
  }
  showNextHint() {
    this.hintsUI.showNextHint();
  }
  goToLastHint() {
    this.hintsUI.goToLastHint();
  }
  updatePaginationButtons() {
    this.hintsUI.updatePaginationButtons();
  }

  showHistoryModal() {
    this.modals.showHistory();
  }
  hideHistoryModal() {
    this.modals.hideHistory();
  }
  showSessionView(id) {
    this.modals.showSessionView(id);
  }
  hideSessionView() {
    this.modals.hideSessionView();
  }
  showHelpModal() {
    this.modals.showHelp();
  }
  hideHelpModal() {
    this.modals.hideHelp();
  }
  renderSessionsList() {
    this.modals.renderSessionsList();
  }

  toggleTranscriptSidebar() {
    this.transcriptUI.toggle();
  }
  toggleTranscriptsVisibility() {
    this.transcriptUI.toggle();
  }
  restoreTranscriptState() {
    this.transcriptUI.restoreState();
  }

  clearFeeds() {
    this.transcriptUI.clear();
    this.hintsUI.clear();
  }

  clearHints() {
    this.hintsUI.clear();
  }
  clearTranscript() {
    this.transcriptUI.clear();
  }

  getTranscriptText() {
    return this.transcriptUI.getText();
  }
  getHintsText() {
    return this.hintsUI.getHintsText();
  }

  // Backwards compatibility getters
  get hints() {
    return this.hintsUI.hints;
  }
  set hints(value) {
    this.hintsUI.hints = value;
  }
  get currentHintIndex() {
    return this.hintsUI.currentHintIndex;
  }
  set currentHintIndex(value) {
    this.hintsUI.currentHintIndex = value;
  }
  get lastTranscriptText() {
    return this.transcriptUI.lastTranscriptText;
  }
  get lastHintText() {
    return this.hintsUI.lastHintText;
  }

  // UI Modes
  toggleCompactMode() {
    this.compactMode = !this.compactMode;
    document.body.classList.toggle('compact-mode', this.compactMode);
    this.elements.btnCompactToggle?.classList.toggle('active', this.compactMode);
    this.app.saveSettings({ compactMode: this.compactMode });
  }

  toggleFocusMode() {
    this.focusMode = !this.focusMode;
    document.body.classList.toggle('focus-mode', this.focusMode);
    this.elements.btnFocusToggle?.classList.toggle('active', this.focusMode);
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
      btn.innerHTML = this.hideTranscripts
        ? '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      btn.title = this.hideTranscripts ? 'Показать транскрипты' : 'Скрыть транскрипты';
    }
    this.showToast(this.hideTranscripts ? 'Транскрипты скрыты' : 'Транскрипты показаны', 'success');
    this.app.saveSettings();
  }

  async copyLastHint() {
    const textToCopy = this.hintsUI.lastHintText;
    if (!textToCopy) {
      this.showToast('Нет подсказки для копирования', 'info');
      return;
    }
    try {
      await navigator.clipboard.writeText(textToCopy);
      this.showToast('Скопировано в буфер', 'success');
    } catch (error) {
      logger.error('UIController', 'Ошибка копирования:', error);
      this.showToast('Ошибка копирования', 'error');
    }
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

  // Utilities - delegated
  formatTime(timestamp) {
    return this.utils.formatTime(timestamp);
  }
  formatLatency(latencyMs) {
    return this.utils.formatLatency(latencyMs);
  }
  escapeHtml(text) {
    return this.utils.escapeHtml(text);
  }
  renderMarkdown(text) {
    return this.utils.renderMarkdown(text);
  }
}
