/**
 * New UI Controller
 * Integrates all new UI modules
 */

import { animations } from './animation-engine.js';
import { state } from './state-manager.js';
import { HintComponent, TranscriptComponent, ToastComponent } from './components.js';
import { ModalManager, SettingsPanel, SidebarManager } from './modal-manager.js';

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
    this.setSettingsMode('basic');
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
      window.electron?.invoke('window:minimize');
    });

    document.getElementById('btn-close')?.addEventListener('click', () => {
      window.electron?.invoke('window:close');
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

    // Help
    document.getElementById('btn-help')?.addEventListener('click', () => {
      this.modals.open('help-modal');
    });

    document.getElementById('btn-close-help')?.addEventListener('click', () => {
      this.modals.close('help-modal');
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
    document.getElementById('btn-settings-basic')?.addEventListener('click', () => {
      this.setSettingsMode('basic');
    });

    document.getElementById('btn-settings-advanced')?.addEventListener('click', () => {
      this.setSettingsMode('advanced');
    });

    document.getElementById('btn-onboarding-reset')?.addEventListener('click', async () => {
      if (confirm('Вы уверены, что хотите сбросить онбординг? Приложение будет перезапущено.')) {
        await window.electron?.invoke('settings:reset');
        window.electron?.invoke('window:close'); // This will trigger quit in main if mainWin is closed and it was the only one? No, electron-store reset then restart is better.
      }
    });

    document.getElementById('llm-provider')?.addEventListener('change', (e) => {
      state.updateSetting('provider', e.target.value);
    });

    document.getElementById('ai-profile')?.addEventListener('change', (e) => {
      state.updateSetting('profile', e.target.value);
    });

    document.getElementById('dual-audio')?.addEventListener('change', (e) => {
      state.updateSetting('dualAudio', e.target.checked);
    });

    document.getElementById('always-on-top')?.addEventListener('change', (e) => {
      state.updateSetting('alwaysOnTop', e.target.checked);
      window.electron?.send('window:set-always-on-top', e.target.checked);
    });

    document.getElementById('compact-mode')?.addEventListener('change', (e) => {
      state.updateSetting('compactMode', e.target.checked);
      document.body.classList.toggle('compact-mode', e.target.checked);
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

    // Settings changes
    state.subscribe('settings.profile', (profile) => {
      const customGroup = document.getElementById('custom-prompt-group');
      if (customGroup) {
        if (profile === 'custom') {
          customGroup.classList.remove('hidden');
          // Animate opening
          this.animations.slideUp(customGroup);
        } else {
          customGroup.classList.add('hidden');
        }
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

  // Settings modes
  setSettingsMode(mode) {
    const basicBtn = document.getElementById('btn-settings-basic');
    const advancedBtn = document.getElementById('btn-settings-advanced');
    const sections = document.querySelectorAll('.settings-section');

    if (mode === 'basic') {
      basicBtn?.classList.add('active');
      advancedBtn?.classList.remove('active');
      // Hide advanced sections
      sections.forEach((s, i) => {
        if (i > 2) s.classList.add('hidden');
        else s.classList.remove('hidden');
      });
    } else {
      basicBtn?.classList.remove('active');
      advancedBtn?.classList.add('active');
      // Show all sections
      sections.forEach(s => s.classList.remove('hidden'));
    }
  }

  // Toast
  showToast(message, type = 'info') {
    this.toasts?.show(message, type);
  }
}

export default NewUIController;
