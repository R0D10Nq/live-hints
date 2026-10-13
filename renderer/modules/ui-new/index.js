/**
 * New UI Controller
 * Integrates all new UI modules
 */

import { animations } from './animation-engine.js';
import { state } from './state-manager.js';
import { HintComponent, TranscriptComponent, ToastComponent } from './components.js';
import { ModalManager, SettingsPanel, SidebarManager } from './modal-manager.js';

export class NewUIController {
  constructor(app = null) {
    this.app = app;
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
      onNavigate: (dir) => this.navigateHint(dir),
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
      void window.electron?.minimizeWindow?.();
    });

    document.getElementById('btn-close')?.addEventListener('click', () => {
      void window.electron?.closeWindow?.();
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
        await window.electron?.settingsReset?.();
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

    document.getElementById('auto-hints')?.addEventListener('change', (e) => {
      state.updateSetting('autoHints', e.target.checked);
    });

    document.getElementById('always-on-top')?.addEventListener('change', (e) => {
      state.updateSetting('alwaysOnTop', e.target.checked);
      void window.electron?.setAlwaysOnTop?.(e.target.checked);
    });

    const stealthToggle = document.getElementById('stealth-mode');
    const stealthBtn = document.getElementById('btn-stealth');

    const updateStealthUI = (active) => {
      const isAct = Boolean(active);
      if (stealthToggle) stealthToggle.checked = isAct;
      if (stealthBtn) {
        stealthBtn.classList.toggle('stealth-active', isAct);
        stealthBtn.title = isAct
          ? 'Скрытие активно: окно скрыто в OBS, Zoom, Teams (Ctrl+H)'
          : 'Скрытие выключено: окно видно при демонстрации экрана (Ctrl+H)';
      }
    };

    void window.electron?.stealthStatus?.().then((active) => {
      updateStealthUI(active);
    });

    window.electron?.onStealthActivated?.(() => {
      updateStealthUI(true);
      this.showToast('Скрытие включено: окно защищено от записи экрана', 'success');
    });

    window.electron?.onStealthDeactivated?.(() => {
      updateStealthUI(false);
      this.showToast('Скрытие выключено: окно видно на записи', 'info');
    });

    stealthToggle?.addEventListener('change', async () => {
      const active = await window.electron?.stealthToggle?.();
      updateStealthUI(active);
    });

    stealthBtn?.addEventListener('click', async () => {
      const active = await window.electron?.stealthToggle?.();
      updateStealthUI(active);
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
      const value = Number(e.target.value);
      state.updateSetting('opacity', value);
      document.getElementById('opacity-value').textContent = `${value}%`;
      document.body.style.opacity = value / 100;
    });

    // Click-through mode
    let clickThroughActive = false;
    const btnClickThrough = document.getElementById('btn-click-through');
    const updateClickThrough = (active) => {
      clickThroughActive = Boolean(active);
      if (btnClickThrough) {
        btnClickThrough.classList.toggle('click-through-active', clickThroughActive);
        btnClickThrough.title = clickThroughActive
          ? 'Сквозной клик активен (наведите на шапку для управления)'
          : 'Сквозной клик (мышь проходит сквозь окно)';
      }
      void window.electron?.setIgnoreMouse?.(clickThroughActive);
    };

    btnClickThrough?.addEventListener('click', () => {
      updateClickThrough(!clickThroughActive);
      this.showToast(
        clickThroughActive ? 'Сквозной клик включен' : 'Сквозной клик выключен',
        'info'
      );
    });

    const appHeader = document.querySelector('.app-header');
    appHeader?.addEventListener('mouseenter', () => {
      if (clickThroughActive) {
        void window.electron?.setIgnoreMouse?.(false);
      }
    });
    appHeader?.addEventListener('mouseleave', () => {
      if (clickThroughActive) {
        void window.electron?.setIgnoreMouse?.(true);
      }
    });

    // Move to secondary monitor
    document.getElementById('btn-move-display')?.addEventListener('click', async () => {
      const hasSecond = await window.electron?.stealthHasSecondMonitor?.();
      if (!hasSecond) {
        this.showToast('Второй монитор не обнаружен', 'info');
        return;
      }
      await window.electron?.moveToSecondary?.();
      this.showToast('Окно перемещено на второй монитор', 'success');
    });

    // Quick compact mode HUD
    document.getElementById('btn-quick-compact')?.addEventListener('click', () => {
      const compactCheckbox = document.getElementById('compact-mode');
      const nextVal = !document.body.classList.contains('compact-mode');
      document.body.classList.toggle('compact-mode', nextVal);
      if (compactCheckbox) compactCheckbox.checked = nextVal;
      state.updateSetting('compactMode', nextVal);
      this.showToast(nextVal ? 'Компактный режим включен' : 'Обычный режим', 'info');
    });

    // Toggle transcript sidebar button in control bar
    document.getElementById('btn-toggle-transcript')?.addEventListener('click', () => {
      this.sidebar.toggle();
    });

    // Font scaling controls
    const hintsFeed = document.getElementById('hints-feed');
    const fontSizeSelect = document.getElementById('hint-font-size-select');
    const fontSizes = ['font-normal', 'font-large', 'font-xlarge'];
    let currentFontIndex = 0;

    const setFontSizeByIndex = (index) => {
      currentFontIndex = Math.max(0, Math.min(fontSizes.length - 1, index));
      fontSizes.forEach((cls) => hintsFeed?.classList.remove(cls));
      hintsFeed?.classList.add(fontSizes[currentFontIndex]);
      const sizeVal =
        currentFontIndex === 0 ? 'normal' : currentFontIndex === 1 ? 'large' : 'xlarge';
      if (fontSizeSelect) fontSizeSelect.value = sizeVal;
      try {
        localStorage.setItem('live-hints-font-size', sizeVal);
      } catch {}
    };

    try {
      const savedFontSize = localStorage.getItem('live-hints-font-size') || 'normal';
      const idx = savedFontSize === 'xlarge' ? 2 : savedFontSize === 'large' ? 1 : 0;
      setFontSizeByIndex(idx);
    } catch {}

    document.getElementById('btn-font-decrease')?.addEventListener('click', () => {
      setFontSizeByIndex(currentFontIndex - 1);
    });

    document.getElementById('btn-font-increase')?.addEventListener('click', () => {
      setFontSizeByIndex(currentFontIndex + 1);
    });

    fontSizeSelect?.addEventListener('change', (e) => {
      const idx = e.target.value === 'xlarge' ? 2 : e.target.value === 'large' ? 1 : 0;
      setFontSizeByIndex(idx);
    });

    // Export session as Markdown
    document.getElementById('btn-export-session')?.addEventListener('click', () => {
      this.exportSessionAsMarkdown();
    });

    // Session context upload in settings
    const resumeInput = document.getElementById('file-resume-input');
    const vacancyInput = document.getElementById('file-vacancy-input');
    const btnUploadResume = document.getElementById('btn-upload-resume');
    const btnUploadVacancy = document.getElementById('btn-upload-vacancy');
    const resumeStatus = document.getElementById('resume-status');
    const vacancyStatus = document.getElementById('vacancy-status');

    btnUploadResume?.addEventListener('click', () => resumeInput?.click());
    btnUploadVacancy?.addEventListener('click', () => vacancyInput?.click());

    resumeInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const buffer = await file.arrayBuffer();
        const ext = file.name.split('.').pop().toLowerCase();
        const text = await window.electron?.parseFileBuffer?.(buffer, ext);
        if (text) {
          await window.electron?.saveContextFile?.('resume', text);
          if (resumeStatus) {
            resumeStatus.textContent = `${file.name}`;
            resumeStatus.classList.add('badge-success');
          }
          this.showToast(`Резюме загружено (${text.length} симв.)`, 'success');
        }
      } catch (err) {
        this.showToast('Ошибка при загрузке резюме: ' + err.message, 'error');
      }
    });

    vacancyInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const buffer = await file.arrayBuffer();
        const ext = file.name.split('.').pop().toLowerCase();
        const text = await window.electron?.parseFileBuffer?.(buffer, ext);
        if (text) {
          await window.electron?.saveContextFile?.('vacancy', text);
          if (vacancyStatus) {
            vacancyStatus.textContent = `${file.name}`;
            vacancyStatus.classList.add('badge-success');
          }
          this.showToast(`Вакансия загружена (${text.length} симв.)`, 'success');
        }
      } catch (err) {
        this.showToast('Ошибка при загрузке вакансии: ' + err.message, 'error');
      }
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
  async toggleSession() {
    const isActive = state.get('session.isActive');

    if (isActive) {
      await this.app?.stopSession?.();
    } else {
      await this.app?.startSession?.();
    }
  }

  async togglePause() {
    const isPaused = state.get('session.isPaused');

    if (isPaused) {
      await this.app?.resumeSession?.();
    } else {
      await this.app?.pauseSession?.();
    }
  }

  updateToggleButton(isActive) {
    const btn = document.getElementById('btn-toggle');
    const text = document.getElementById('text-toggle');
    const icon = document.getElementById('icon-toggle');

    if (isActive) {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-danger');
      text.textContent = 'Стоп';
      document.getElementById('btn-pause')?.removeAttribute('disabled');
      icon.innerHTML = '<rect x="6" y="6" width="12" height="12"/>';
    } else {
      btn.classList.remove('btn-danger');
      btn.classList.add('btn-primary');
      text.textContent = 'Старт';
      document.getElementById('btn-pause')?.setAttribute('disabled', 'disabled');
      icon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    }
  }

  updatePauseButton(isPaused) {
    const btn = document.getElementById('btn-pause');
    const text = document.getElementById('text-pause');
    if (text) text.textContent = isPaused ? 'Продолжить' : 'Пауза';
    btn?.classList.toggle('paused', isPaused);
  }

  // Status updates
  updateStatus(status) {
    const indicator = document.getElementById('status-indicator');
    const text = indicator?.querySelector('.status-text');

    const statusMap = {
      idle: { text: 'Готов', class: 'idle' },
      recording: { text: 'Запись', class: 'recording' },
      paused: { text: 'Пауза', class: 'paused' },
      processing: { text: 'Обработка', class: 'processing' },
      error: { text: 'Ошибка', class: 'error' },
    };

    const config = statusMap[status];
    if (config && indicator) {
      indicator.className = `status-indicator ${config.class}`;
      if (text) text.textContent = config.text;
    }
  }

  // Hint actions
  askHint() {
    void this.app?.requestHint?.();
  }

  addHint(hintData) {
    state.addHint({
      text: hintData.text,
      timestamp: Date.now(),
      type: hintData.type || 'general',
      confidence: hintData.confidence || 'medium',
      context: hintData.context,
    });

    state.set(
      'ui.status',
      state.get('session.isPaused')
        ? 'paused'
        : state.get('session.isActive')
          ? 'recording'
          : 'idle'
    );
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
    void this.app?.captureAndAnalyze?.();
  }

  // Direct message
  async sendDirectMessage() {
    const input = document.getElementById('direct-message-input');
    const text = input?.value.trim();

    if (text) {
      const success = await this.app?.sendDirectMessage?.(text);
      if (success) {
        input.value = '';
        this.showToast('Ответ получен', 'success');
      }
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
      sections.forEach((s) => s.classList.remove('hidden'));
    }
  }

  // Toast
  showToast(message, type = 'info') {
    this.toasts?.show(message, type);
  }

  // Export session as Markdown
  exportSessionAsMarkdown() {
    const transcripts = state.get('ui.transcripts') || [];
    const hints = state.get('ui.hints') || [];
    const profile = state.get('settings.profile') || 'job_interview_ru';
    const dateStr = new Date().toLocaleString('ru-RU');

    if (transcripts.length === 0 && hints.length === 0) {
      this.showToast('Нет данных для экспорта', 'info');
      return;
    }

    let md = `# Сессия Live Hints\n\n`;
    md += `- Дата: ${dateStr}\n`;
    md += `- Профиль: ${profile}\n`;
    md += `- Всего реплик: ${transcripts.length}\n`;
    md += `- Всего подсказок: ${hints.length}\n\n`;

    md += `## Стенограмма разговора\n\n`;
    if (transcripts.length === 0) {
      md += `*Стенограмма пуста*\n\n`;
    } else {
      transcripts.forEach((item, i) => {
        const time = item.timestamp
          ? new Date(item.timestamp).toLocaleTimeString('ru-RU')
          : `#${i + 1}`;
        const sender = item.source === 'candidate' ? 'Кандидат' : 'Собеседник';
        md += `**[${time}] ${sender}:** ${item.text}\n\n`;
      });
    }

    md += `## Подсказки ассистента\n\n`;
    if (hints.length === 0) {
      md += `*Подсказок нет*\n\n`;
    } else {
      hints.forEach((hint, i) => {
        const time = hint.timestamp
          ? new Date(hint.timestamp).toLocaleTimeString('ru-RU')
          : `#${i + 1}`;
        const type = hint.type ? ` (${hint.type})` : '';
        md += `### Подсказка ${i + 1}${type} [${time}]\n\n${hint.text}\n\n`;
      });
    }

    // Копирование в буфер обмена
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(md).catch(() => {});
    }

    // Сохранение в файл blob
    try {
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `live-hints-session-${Date.now()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showToast('Сессия сохранена в Markdown и скопирована в буфер', 'success');
    } catch {
      this.showToast('Сессия скопирована в буфер обмена', 'success');
    }
  }
}

export default NewUIController;
