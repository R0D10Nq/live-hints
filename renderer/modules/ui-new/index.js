/**
 * New UI Controller
 * Integrates all new UI modules
 */

import { animations } from './ui-new/animation-engine.js';
import { state } from './ui-new/state-manager.js';
import { HintComponent, TranscriptComponent, ToastComponent } from './ui-new/components.js';
import { ModalManager, SettingsPanel, SidebarManager } from './ui-new/modal-manager.js';

export class NewUIController {
  constructor() {
    this.animations = animations;
    this.state = state;
    this.modals = new ModalManager();
    this.settings = new SettingsPanel();
    this.sidebar = new SidebarManager();

    this.hints = null;
    this.transcripts = null;
    this.toasts = null;

    this.init();
  }

  init() {
    // Initialize components
    this.hints = new HintComponent(document.getElementById('hints-feed'), {
      onCopy: () => this.showToast('Скопировано в буфер обмена', 'success'),
      onNavigate: (dir) => this.navigateHint(dir)
    });

    this.transcripts = new TranscriptComponent(document.getElementById('transcript-feed'));
    this.toasts = new ToastComponent(document.getElementById('toast-container'));

    // Setup event listeners
    this.setupEventListeners();

    // Subscribe to state changes
    this.setupStateSubscriptions();

    // Initial render
    this.hints.showEmptyState();
  }

  setupEventListeners() {
    // Header buttons
    document.getElementById('btn-settings')?.addEventListener('click', () => {
      this.settings.toggle();
    });

    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      this.settings.close();
    });

    // Window controls
    document.getElementById('btn-minimize')?.addEventListener('click', () => {
      window.electron?.send('minimize-window');
    });

    document.getElementById('btn-close')?.addEventListener('click', () => {
      window.electron?.send('close-window');
    });

    // Control bar
    document.getElementById('btn-toggle')?.addEventListener('click', () => {
      this.toggleSession();
    });

    document.getElementById('btn-pause')?.addEventListener('click', () => {
      this.togglePause();
    });

    document.getElementById('btn-ask')?.addEventListener('click', () => {
      this.askHint();
    });

    document.getElementById('btn-screenshot')?.addEventListener('click', () => {
      this.takeScreenshot();
    });

    // Navigation
    document.getElementById('btn-prev-hint')?.addEventListener('click', () => {
      state.prevHint();
    });

    document.getElementById('btn-next-hint')?.addEventListener('click', () => {
      state.nextHint();
    });

    document.getElementById('btn-copy-hint')?.addEventListener('click', () => {
      this.copyCurrentHint();
    });

    document.getElementById('btn-clear-hints')?.addEventListener('click', () => {
      state.clearHints();
      this.showToast('Подсказки очищены', 'info');
    });

    // Sidebar
    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
      this.sidebar.toggle();
    });

    document.getElementById('btn-clear-transcript')?.addEventListener('click', () => {
      state.clearTranscripts();
      this.transcripts.clear();
    });

    // Modals
    document.getElementById('btn-history')?.addEventListener('click', () => {
      this.modals.open('history-modal');
    });

    document.getElementById('btn-close-history')?.addEventListener('click', () => {
      this.modals.close('history-modal');
    });

    // Direct message
    document.getElementById('btn-send-direct')?.addEventListener('click', () => {
      this.sendDirectMessage();
    });

    document.getElementById('direct-message-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendDirectMessage();
      }
    });

    // Settings
    document.getElementById('llm-provider')?.addEventListener('change', (e) => {
      state.updateSetting('provider', e.target.value);
    });

    document.getElementById('ai-profile')?.addEventListener('change', (e) => {
      state.updateSetting('profile', e.target.value);
    });

    document.getElementById('theme-select')?.addEventListener('change', (e) => {
      state.updateSetting('theme', e.target.value);
      document.documentElement.setAttribute('data-theme', e.target.value);
    });

    document.getElementById('opacity-slider')?.addEventListener('input', (e) => {
      const value = e.target.value;
      state.updateSetting('opacity', value);
      document.getElementById('opacity-value').textContent = `${value}%`;
      document.body.style.opacity = value / 100;
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        this.settings.toggle();
      }
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        this.copyCurrentHint();
      }
    });
  }

  setupStateSubscriptions() {
    // Status changes
    state.subscribe('ui.status', (newStatus) => {
      this.updateStatus(newStatus);
    });

    // Hint changes
    state.subscribe('ui.hints', (hints) => {
      if (hints.length === 0) {
        this.hints.showEmptyState();
      }
      this.hints.updateNavigation(state.get('ui.currentHintIndex'), hints.length);
    });

    state.subscribe('ui.currentHintIndex', (index) => {
      const hints = state.get('ui.hints');
      if (hints[index]) {
        this.hints.displayHint(hints[index], index, hints.length);
        this.hints.updateCounter(index, hints.length);
        this.hints.updateNavigation(index, hints.length);
      }
    });

    // Transcript changes
    state.subscribe('ui.transcripts', (transcripts) => {
      const last = transcripts[transcripts.length - 1];
      if (last) {
        this.transcripts.addEntry(last.text);
      }
    });
  }

  // Session actions
  toggleSession() {
    const isActive = state.get('session.isActive');
    
    if (isActive) {
      state.stopSession();
      this.updateToggleButton(false);
    } else {
      state.startSession();
      this.updateToggleButton(true);
      window.electron?.send('start-recording');
    }
  }

  togglePause() {
    const isPaused = state.get('session.isPaused');
    
    if (isPaused) {
      state.resumeSession();
    } else {
      state.pauseSession();
    }
    
    this.updatePauseButton(!isPaused);
  }

  updateToggleButton(isActive) {
    const btn = document.getElementById('btn-toggle');
    const text = document.getElementById('text-toggle');
    const icon = document.getElementById('icon-toggle');

    if (isActive) {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-danger');
      text.textContent = 'Стоп';
      icon.innerHTML = '<rect x="6" y="6" width="12" height="12"/>';
    } else {
      btn.classList.remove('btn-danger');
      btn.classList.add('btn-primary');
      text.textContent = 'Старт';
      icon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    }
  }

  updatePauseButton(isPaused) {
    const btn = document.getElementById('btn-pause');
    btn.textContent = isPaused ? 'Продолжить' : 'Пауза';
  }

  // Status updates
  updateStatus(status) {
    const indicator = document.getElementById('status-indicator');
    const text = indicator?.querySelector('.status-text');

    const statusMap = {
      'idle': { text: 'Готов', class: 'idle' },
      'recording': { text: 'Запись', class: 'recording' },
      'paused': { text: 'Пауза', class: 'paused' },
      'processing': { text: 'Обработка', class: 'processing' },
      'error': { text: 'Ошибка', class: 'error' }
    };

    const config = statusMap[status];
    if (config && indicator) {
      indicator.className = `status-indicator ${config.class}`;
      if (text) text.textContent = config.text;
    }
  }

  // Hint actions
  askHint() {
    state.set('ui.status', 'processing');
    this.hints.showLoadingState();
    
    window.electron?.send('generate-hint');
  }

  addHint(hintData) {
    state.addHint({
      text: hintData.text,
      timestamp: Date.now(),
      type: hintData.type || 'general',
      confidence: hintData.confidence || 'medium',
      context: hintData.context
    });
    
    state.set('ui.status', 'recording');
  }

  copyCurrentHint() {
    const hint = state.getCurrentHint();
    if (hint) {
      navigator.clipboard.writeText(hint.text);
      this.showToast('Скопировано в буфер обмена', 'success');
    }
  }

  navigateHint(direction) {
    if (direction === 'next') {
      state.nextHint();
    } else {
      state.prevHint();
    }
  }

  // Screenshot
  takeScreenshot() {
    window.electron?.send('take-screenshot');
    this.showToast('Скриншот сделан', 'success');
  }

  // Direct message
  sendDirectMessage() {
    const input = document.getElementById('direct-message-input');
    const text = input?.value.trim();
    
    if (text) {
      window.electron?.send('direct-message', { text });
      input.value = '';
      this.showToast('Сообщение отправлено', 'success');
    }
  }

  // Transcript
  addTranscript(text) {
    state.addTranscript(text);
  }

  // Toast
  showToast(message, type = 'info') {
    this.toasts?.show(message, type);
  }
}

export default NewUIController;
