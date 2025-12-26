/**
 * Live Hints - Главный модуль приложения
 * Оркестрация всех модулей
 */

import { SERVERS, TIMEOUTS, PROFILES } from './modules/constants.js';
import { AudioManager } from './modules/audio-manager.js';
import { SessionManager } from './modules/session-manager.js';
import { UIController } from './modules/ui-controller.js';
import { HintManager } from './modules/hint-manager.js';

class LiveHintsApp {
  constructor() {
    // Состояние приложения
    this.isRunning = false;
    this.isPaused = false;
    this.autoHintsEnabled = false;
    this.debugMode = false;
    this.stealthMode = false;
    this.theme = 'dark';
    this.lastContextHash = '';
    this.transcriptContext = [];

    // Инициализация модулей
    this.ui = new UIController(this);
    this.audio = new AudioManager(this);
    this.sessions = new SessionManager(this);
    this.hints = new HintManager(this);

    this.init();
  }

  init() {
    this.ui.setup();
    this.audio.setup();
    this.sessions.setup();
    this.bindEvents();
    this.loadSettings();
    this.setupIPCListeners();
    this.setupModelSelection();
    this.setupVisionAI();
    this.setupStealthMode();
  }

  bindEvents() {
    const { elements } = this.ui;

    // Window controls
    elements.btnMinimize?.addEventListener('click', () => {
      window.electronAPI.minimizeWindow();
    });

    elements.btnClose?.addEventListener('click', () => {
      this.stop();
      window.electronAPI.closeWindow();
    });

    // Start/Stop
    elements.btnToggle?.addEventListener('click', () => {
      if (this.isRunning) {
        this.stop();
      } else {
        this.start();
      }
    });

    // Provider change
    elements.llmProvider?.addEventListener('change', (e) => {
      this.saveSettings({ llmProvider: e.target.value });
    });

    // Profile change
    elements.aiProfile?.addEventListener('change', (e) => {
      this.hints.setProfile(e.target.value);
      this.toggleCustomInstructions();
      this.saveSettings({ aiProfile: e.target.value });
    });

    // Custom instructions
    const customInstructions = document.getElementById('custom-instructions');
    if (customInstructions) {
      customInstructions.addEventListener('input', (e) => {
        this.hints.customInstructions = e.target.value;
        this.saveSettings({ customInstructions: e.target.value });
      });
    }

    // Auto hints
    const autoHints = document.getElementById('auto-hints');
    if (autoHints) {
      autoHints.addEventListener('change', (e) => {
        this.autoHintsEnabled = e.target.checked;
        this.saveSettings({ autoHints: e.target.checked });
      });
    }

    // Get hint button
    elements.btnGetHint?.addEventListener('click', () => {
      this.hints.manualRequestHint();
    });

    // Pause button
    elements.btnPause?.addEventListener('click', () => {
      this.togglePause();
    });

    // Opacity slider
    const opacitySlider = document.getElementById('opacity-slider');
    const opacityValue = document.getElementById('opacity-value');
    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        if (opacityValue) opacityValue.textContent = `${value}%`;
        window.electronAPI.setOpacity(value);
        this.saveSettings({ opacity: value });
      });
    }

    // Font sizes
    this.setupFontSliders();
    this.setupAdvancedSettings();

    // History
    elements.btnHistory?.addEventListener('click', () => {
      this.ui.showHistoryModal();
    });

    elements.btnCloseModal?.addEventListener('click', () => {
      this.ui.hideHistoryModal();
    });

    elements.btnCloseSessionView?.addEventListener('click', () => {
      this.ui.hideSessionView();
    });

    // Modal backdrop clicks
    elements.historyModal?.addEventListener('click', (e) => {
      if (e.target === elements.historyModal) {
        this.ui.hideHistoryModal();
      }
    });

    elements.sessionViewModal?.addEventListener('click', (e) => {
      if (e.target === elements.sessionViewModal) {
        this.ui.hideSessionView();
      }
    });

    // Hotkeys
    document.addEventListener('keydown', (e) => this.handleHotkeys(e));
  }

  setupFontSliders() {
    const fontTranscript = document.getElementById('font-transcript');
    const fontTranscriptValue = document.getElementById('font-transcript-value');
    const fontHints = document.getElementById('font-hints');
    const fontHintsValue = document.getElementById('font-hints-value');

    if (fontTranscript) {
      fontTranscript.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        if (fontTranscriptValue) fontTranscriptValue.textContent = `${value}px`;
        document.documentElement.style.setProperty('--font-transcript', `${value}px`);
        this.saveSettings({ fontTranscript: value });
      });
    }

    if (fontHints) {
      fontHints.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        if (fontHintsValue) fontHintsValue.textContent = `${value}px`;
        document.documentElement.style.setProperty('--font-hints', `${value}px`);
        this.saveSettings({ fontHints: value });
      });
    }
  }

  setupAdvancedSettings() {
    const contextWindowSize = document.getElementById('context-window-size');
    const maxContextChars = document.getElementById('max-context-chars');
    const maxTokens = document.getElementById('max-tokens');
    const temperature = document.getElementById('temperature');
    const debugMode = document.getElementById('debug-mode');
    const btnHealthCheck = document.getElementById('btn-health-check');

    if (contextWindowSize) {
      contextWindowSize.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        this.hints.setParams({ contextWindowSize: value });
        const valueEl = document.getElementById('context-window-size-value');
        if (valueEl) valueEl.textContent = value;
        this.saveSettings({ contextWindowSize: value });
      });
    }

    if (maxContextChars) {
      maxContextChars.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        this.hints.setParams({ maxContextChars: value });
        const valueEl = document.getElementById('max-context-chars-value');
        if (valueEl) valueEl.textContent = value;
        this.saveSettings({ maxContextChars: value });
      });
    }

    if (maxTokens) {
      maxTokens.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        this.hints.setParams({ maxTokens: value });
        const valueEl = document.getElementById('max-tokens-value');
        if (valueEl) valueEl.textContent = value;
        this.saveSettings({ maxTokens: value });
      });
    }

    if (temperature) {
      temperature.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) / 10;
        this.hints.setParams({ temperature: value });
        const valueEl = document.getElementById('temperature-value');
        if (valueEl) valueEl.textContent = value.toFixed(1);
        this.saveSettings({ temperature: value });
      });
    }

    if (debugMode) {
      debugMode.addEventListener('change', (e) => {
        this.debugMode = e.target.checked;
        this.ui.toggleMetricsPanel(this.debugMode);
        this.saveSettings({ debugMode: e.target.checked });
      });
    }

    if (btnHealthCheck) {
      btnHealthCheck.addEventListener('click', () => {
        this.hints.checkHealth();
      });
    }

    // Remote mode
    const remoteMode = document.getElementById('remote-mode');
    const remoteConfig = document.getElementById('remote-servers-config');
    const btnTestRemote = document.getElementById('btn-test-remote');

    if (remoteMode) {
      remoteMode.addEventListener('change', (e) => {
        if (remoteConfig) {
          remoteConfig.classList.toggle('hidden', !e.target.checked);
        }
        this.saveSettings({ remoteMode: e.target.checked });
      });
    }

    if (btnTestRemote) {
      btnTestRemote.addEventListener('click', async () => {
        const sttUrl = document.getElementById('remote-stt-url')?.value || SERVERS.STT;
        const llmUrl = document.getElementById('remote-llm-url')?.value || SERVERS.LLM;
        const result = await this.audio.testRemoteConnection(sttUrl, llmUrl);

        if (result.sttOk && result.llmOk) {
          this.ui.showToast('Оба сервера доступны', 'success');
        } else if (result.llmOk) {
          this.ui.showToast('LLM доступен, STT недоступен', 'warning');
        } else if (result.sttOk) {
          this.ui.showToast('STT доступен, LLM недоступен', 'warning');
        } else {
          this.ui.showToast('Оба сервера недоступны', 'error');
        }
      });
    }
  }

  setupIPCListeners() {
    // PCM данные от audio_capture.py
    // source: 'loopback' (системный звук) или 'microphone' (кандидат)
    window.electronAPI.onPCMData((data, source) => {
      if (!this._pcmLogCount) this._pcmLogCount = 0;
      this._pcmLogCount++;

      if (this._pcmLogCount === 1) {
        console.log('[IPC] Первый PCM чанк получен, source:', source, 'размер:', data?.length || data?.byteLength);
      } else if (this._pcmLogCount % 100 === 0) {
        console.log('[IPC] PCM чанков получено:', this._pcmLogCount, 'source:', source);
      }

      // Преобразуем Buffer в ArrayBuffer для WebSocket
      if (data && data.length > 0) {
        const arrayBuffer = data.buffer ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data;
        this.audio.sendAudio(arrayBuffer, source || 'loopback');
      }
    });

    window.electronAPI.onTranscript((data) => {
      this.ui.addTranscriptItem(data.text, data.timestamp);
    });

    window.electronAPI.onHint((data) => {
      this.ui.addHintItem(data.text, data.timestamp);
    });

    window.electronAPI.onStatusChange((status) => {
      this.ui.updateStatus(status);
    });

    window.electronAPI.onError((error) => {
      this.ui.showError(error.message);
    });

    // Горячие клавиши
    window.electronAPI.onShortcutAsk(() => {
      this.getHint();
    });

    window.electronAPI.onShortcutScreenshot(() => {
      this.captureAndAnalyze();
    });

    window.electronAPI.onShortcutToggleTranscript(() => {
      this.ui.toggleTranscriptsVisibility();
    });

    window.electronAPI.onShortcutPrevHint(() => {
      this.ui.showPrevHint();
    });

    window.electronAPI.onShortcutNextHint(() => {
      this.ui.showNextHint();
    });

    window.electronAPI.onShortcutSettings(() => {
      this.ui.toggleSettingsPanel();
    });

    window.electronAPI.onShortcutToggleMute(() => {
      this.audio.toggleMute();
    });

    window.electronAPI.onShortcutHelp(() => {
      this.ui.showHelpModal();
    });

    window.electronAPI.onShortcutToggleSession(() => {
      if (this.isRunning) {
        this.stop();
      } else {
        this.start();
      }
    });
  }

  setupModelSelection() {
    const modelSelect = document.getElementById('ollama-model');
    const refreshBtn = document.getElementById('btn-refresh-models');
    const profileBtns = document.querySelectorAll('.profile-btn');

    this.loadOllamaModels();

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadOllamaModels());
    }

    if (modelSelect) {
      modelSelect.addEventListener('change', (e) => {
        this.setOllamaModel(e.target.value);
      });
    }

    profileBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const profile = btn.dataset.profile;
        this.setModelProfile(profile);
        profileBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const profile = PROFILES[parseInt(e.key) - 1];
        this.setModelProfile(profile);
        profileBtns.forEach((b) => {
          b.classList.toggle('active', b.dataset.profile === profile);
        });
      }
    });
  }

  async loadOllamaModels() {
    const modelSelect = document.getElementById('ollama-model');
    if (!modelSelect) return;

    try {
      const resp = await fetch(`${SERVERS.LLM}/models`);
      const data = await resp.json();

      if (data.models && data.models.length > 0) {
        modelSelect.innerHTML = data.models
          .map((m) => {
            const name = typeof m === 'string' ? m : m.name;
            const size = typeof m === 'object' ? ` (${m.size})` : '';
            const selected = name === data.current ? 'selected' : '';
            return `<option value="${name}" ${selected}>${name}${size}</option>`;
          })
          .join('');
        // Сохраняем текущую модель для передачи в запросах
        if (data.current) {
          this.hints.currentModel = data.current;
        }
      } else {
        modelSelect.innerHTML = '<option value="">Нет моделей</option>';
      }
    } catch (e) {
      modelSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
      console.error('Ошибка загрузки моделей:', e);
    }
  }

  async setOllamaModel(modelName) {
    if (!modelName) return;
    try {
      await fetch(`${SERVERS.LLM}/model/${encodeURIComponent(modelName)}`, { method: 'POST' });
      this.hints.currentModel = modelName; // Сохраняем модель для передачи в запросах
      this.ui.showToast(`Модель: ${modelName}`, 'success');
    } catch (e) {
      this.ui.showToast('Ошибка смены модели', 'error');
    }
  }

  async setModelProfile(profileName) {
    try {
      await fetch(`${SERVERS.LLM}/model/profile/${profileName}`, { method: 'POST' });
      this.ui.showToast(`Профиль: ${profileName}`, 'success');
      this.loadOllamaModels();
    } catch (e) {
      this.ui.showToast('Ошибка смены профиля', 'error');
    }
  }

  setupVisionAI() {
    const visionEnabled = document.getElementById('vision-enabled');
    const captureBtn = document.getElementById('btn-capture-screen');
    const btnScreenshot = document.getElementById('btn-screenshot');
    const visionModal = document.getElementById('vision-modal');
    const closeVision = document.getElementById('btn-close-vision');
    const captureFullscreen = document.getElementById('btn-capture-fullscreen');
    const visionSend = document.getElementById('btn-vision-analyze');
    const visionRetake = document.getElementById('btn-vision-retake');
    const visionCancel = document.getElementById('btn-vision-cancel');

    this.capturedScreenshot = null;
    this.visionEnabled = false;

    if (visionEnabled) {
      visionEnabled.addEventListener('change', (e) => {
        this.visionEnabled = e.target.checked;
        this.saveSettings({ visionEnabled: e.target.checked });
      });
    }

    // Кнопка скриншота в header - сразу делает скриншот
    if (btnScreenshot) {
      btnScreenshot.addEventListener('click', () => {
        console.log('[Vision] Клик по btn-screenshot');
        this.captureScreen();
      });
    }

    if (captureBtn) {
      captureBtn.addEventListener('click', () => this.showVisionModal());
    }

    if (closeVision) {
      closeVision.addEventListener('click', () => this.hideVisionModal());
    }

    if (visionModal) {
      visionModal.addEventListener('click', (e) => {
        if (e.target === visionModal) this.hideVisionModal();
      });
    }

    if (captureFullscreen) {
      captureFullscreen.addEventListener('click', () => this.captureScreen());
    }

    if (visionSend) {
      visionSend.addEventListener('click', () => this.sendScreenshotToAI());
    }

    if (visionRetake) {
      visionRetake.addEventListener('click', () => {
        const previewContainer = document.getElementById('vision-preview');
        if (previewContainer) previewContainer.classList.add('hidden');
        this.capturedScreenshot = null;
      });
    }

    if (visionCancel) {
      visionCancel.addEventListener('click', () => this.hideVisionModal());
    }

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 's' && this.visionEnabled) {
        e.preventDefault();
        this.showVisionModal();
      }
    });
  }

  showVisionModal() {
    const modal = document.getElementById('vision-modal');
    const previewContainer = document.getElementById('vision-preview');
    const resultContainer = document.getElementById('vision-result');

    if (modal) modal.classList.remove('hidden');
    if (previewContainer) previewContainer.classList.add('hidden');
    if (resultContainer) resultContainer.classList.add('hidden');
  }

  hideVisionModal() {
    const modal = document.getElementById('vision-modal');
    if (modal) modal.classList.add('hidden');
    this.capturedScreenshot = null;
  }

  async captureScreen() {
    try {
      console.log('[Vision] Начинаем захват экрана');
      this.ui.showToast('Захват экрана...', 'info');

      this.hideVisionModal();
      await new Promise((r) => setTimeout(r, 300));

      if (!window.electronAPI?.captureScreen) {
        this.ui.showToast('API захвата экрана недоступен', 'error');
        return;
      }

      const imageData = await window.electronAPI.captureScreen();
      console.log('[Vision] Результат захвата:', imageData ? `${imageData.length} символов` : 'null');

      if (imageData) {
        this.capturedScreenshot = imageData;
        const previewImg = document.getElementById('vision-preview-img');
        const previewContainer = document.getElementById('vision-preview');

        if (previewImg) previewImg.src = `data:image/png;base64,${imageData}`;
        if (previewContainer) previewContainer.classList.remove('hidden');
        this.showVisionModal();
        this.ui.showToast('Скриншот готов', 'success');
      } else {
        this.ui.showToast('Ошибка захвата экрана', 'error');
      }
    } catch (e) {
      console.error('[Vision] Capture error:', e);
      this.ui.showToast(`Ошибка захвата: ${e.message}`, 'error');
    }
  }

  async sendScreenshotToAI() {
    if (!this.capturedScreenshot) {
      this.ui.showToast('Сначала сделайте скриншот', 'error');
      return;
    }

    console.log('[Vision] Отправка в Vision AI...');
    this.ui.showToast('Отправка в Vision AI...', 'info');

    const analyzeBtn = document.getElementById('btn-vision-analyze');
    if (analyzeBtn) {
      analyzeBtn.disabled = true;
      analyzeBtn.textContent = 'Анализ...';
    }

    try {
      const resp = await fetch(`${SERVERS.LLM}/vision/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: this.capturedScreenshot,
          prompt:
            'Это скриншот с собеседования или технической задачи. Опиши что видишь и дай рекомендации по ответу.',
        }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const data = await resp.json();
      console.log('[Vision] Ответ от API:', data);

      if (data.analysis) {
        const resultContainer = document.getElementById('vision-result');
        const analysisText = document.getElementById('vision-analysis-text');
        const previewContainer = document.getElementById('vision-preview');

        if (analysisText) analysisText.textContent = data.analysis;
        if (resultContainer) resultContainer.classList.remove('hidden');
        if (previewContainer) previewContainer.classList.add('hidden');

        this.ui.addHintItem(`[Vision AI] ${data.analysis}`, new Date().toLocaleTimeString());
        this.ui.showToast('Анализ завершён', 'success');
      } else if (data.error) {
        console.error('[Vision] API вернул ошибку:', data.error);
        this.ui.showToast(`Vision ошибка: ${data.error}`, 'error');
      } else {
        this.ui.showToast('Vision AI не вернул результат', 'error');
      }
    } catch (e) {
      console.error('[Vision] AI error:', e);
      this.ui.showToast(`Ошибка Vision AI: ${e.message}`, 'error');
    } finally {
      if (analyzeBtn) {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Анализировать';
      }
    }
  }

  setupStealthMode() {
    const stealthToggle = document.getElementById('stealth-toggle');
    const stealthStrategy = document.getElementById('stealth-strategy');

    this.loadStealthStatus();

    if (stealthToggle) {
      stealthToggle.addEventListener('change', async () => {
        const result = await window.electronAPI?.stealthToggle();
        this.updateStealthUI(result);
      });
    }

    if (stealthStrategy) {
      stealthStrategy.addEventListener('change', async (e) => {
        await window.electronAPI?.stealthSetStrategy(e.target.value);
        this.saveSettings({ stealthStrategy: e.target.value });
        this.ui.showToast(`Stealth стратегия: ${e.target.value}`, 'success');
      });
    }

    window.electronAPI?.onStealthActivated(() => {
      this.updateStealthUI(true);
      if (stealthToggle) stealthToggle.checked = true;
    });

    window.electronAPI?.onStealthDeactivated(() => {
      this.updateStealthUI(false);
      if (stealthToggle) stealthToggle.checked = false;
    });
  }

  async loadStealthStatus() {
    try {
      const status = await window.electronAPI?.stealthGetStrategy();
      if (status) {
        const stealthToggle = document.getElementById('stealth-toggle');
        const stealthStrategy = document.getElementById('stealth-strategy');

        if (stealthToggle) stealthToggle.checked = status.active;
        if (stealthStrategy) stealthStrategy.value = status.strategy;
        this.updateStealthUI(status.active);
      }

      const hasSecondMonitor = await window.electronAPI?.stealthHasSecondMonitor();
      const secondMonitorOption = document.querySelector(
        '#stealth-strategy option[value="second-monitor"]'
      );
      if (secondMonitorOption && !hasSecondMonitor) {
        secondMonitorOption.textContent = 'Второй монитор (недоступен)';
        secondMonitorOption.disabled = true;
      }
    } catch (e) {
      console.error('Ошибка загрузки stealth статуса:', e);
    }
  }

  updateStealthUI(isActive) {
    const indicator = document.getElementById('stealth-indicator');
    const statusText = document.getElementById('stealth-status-text');

    if (indicator) {
      indicator.classList.toggle('active', isActive);
      indicator.classList.toggle('inactive', !isActive);
    }
    if (statusText) {
      statusText.textContent = isActive ? 'АКТИВЕН' : 'Выключен';
    }

    if (isActive) {
      this.ui.showToast('Stealth режим активирован', 'warning');
    }
  }

  // Main flow
  async start() {
    try {
      console.log('[APP] Запуск сессии...');

      this.ui.updateStatus('listening');
      this.isRunning = true;
      this.isPaused = false;
      this.ui.updateToggleButton(true);
      this.ui.clearFeeds();

      // Очищаем контекст предыдущей сессии
      this.hints.clearContext();
      console.log('[APP] Контекст очищен для новой сессии');

      // Очищаем кэш на сервере
      this.clearServerCache();

      this.sessions.create();

      // Подключаемся к STT серверу
      console.log('[APP] Подключение к STT...');
      await this.audio.connectToSTT();
      console.log('[APP] STT подключен');

      // Если dual audio включён — подключаем микрофон к STT
      if (this.audio.dualAudioEnabled) {
        console.log('[APP] Dual Audio включён, подключаем микрофон...');
        this.audio.connectMicrophone();
      } else {
        console.log('[APP] Single mode (только loopback)');
      }

      // Запускаем захват аудио с настройками dual audio
      console.log('[APP] Запуск захвата аудио...');
      const audioOptions = {
        dualAudio: this.audio.dualAudioEnabled,
        micDeviceIndex: this.audio.inputDeviceIndex || null,
      };
      const result = await window.electronAPI.startAudioCapture(audioOptions);
      console.log('[APP] Результат захвата:', result, 'dualAudio:', audioOptions.dualAudio);

      if (!result.success) {
        throw new Error(result.error || 'Не удалось запустить захват аудио');
      }

      console.log('[APP] Сессия запущена успешно');
      this.ui.showToast('Сессия запущена', 'success');
    } catch (error) {
      console.error('[APP] Ошибка запуска:', error);
      this.ui.showError(`Ошибка запуска: ${error.message}`);
      this.stop();
    }
  }

  async stop() {
    try {
      console.log('[APP] Остановка сессии...');

      await window.electronAPI.stopAudioCapture();
      this.audio.disconnect();

      if (this.sessions.currentSessionId) {
        this.sessions.save();
      }

      this.isRunning = false;
      this.isPaused = false;
      this.ui.updateStatus('idle');
      this.ui.updateToggleButton(false);


      console.log('[APP] Сессия остановлена');
    } catch (error) {
      console.error('[APP] Ошибка остановки:', error);
      this.ui.showError(`Ошибка остановки: ${error.message}`);
    }
  }

  togglePause() {
    if (!this.isRunning) return;

    this.isPaused = !this.isPaused;
    this.ui.updatePauseButton(this.isPaused);

    if (this.isPaused) {
      this.ui.updateStatus('paused');
    } else {
      this.ui.updateStatus('listening');
    }
  }

  handleHotkeys(e) {
    if (e.ctrlKey && e.key === '/') {
      e.preventDefault();
      window.electronAPI.toggleVisibility?.();
    }
    if (e.ctrlKey && e.key.startsWith('Arrow')) {
      e.preventDefault();
      const direction = e.key.replace('Arrow', '').toLowerCase();
      window.electronAPI.moveWindow?.(direction);
    }
    if (e.ctrlKey && e.key === 'Enter' && this.isRunning) {
      e.preventDefault();
      this.hints.manualRequestHint();
    }
    if (e.ctrlKey && e.key === 't') {
      e.preventDefault();
      this.ui.toggleTranscripts();
    }
    if (e.ctrlKey && e.key === 'h') {
      e.preventDefault();
      this.toggleStealth();
    }
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      this.toggleTheme();
    }
  }

  async toggleStealth() {
    if (window.electronAPI?.stealthToggle) {
      this.stealthMode = await window.electronAPI.stealthToggle();
      if (this.stealthMode) {
        this.ui.showToast('Stealth режим активирован', 'success');
      }
    }
  }

  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', this.theme);
    this.ui.showToast(`Тема: ${this.theme === 'dark' ? 'тёмная' : 'светлая'}`, 'success');
    this.saveSettings();
  }

  toggleCustomInstructions() {
    const container = document.getElementById('custom-prompt-group');
    if (!container) return;

    if (this.hints.currentProfile === 'custom') {
      container.classList.remove('hidden');
    } else {
      container.classList.add('hidden');
    }
  }

  // Settings
  loadSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem('live-hints-settings')) || {};

      if (settings.llmProvider) {
        this.ui.elements.llmProvider.value = settings.llmProvider;
      }
      if (settings.aiProfile) {
        this.hints.currentProfile = settings.aiProfile;
        this.ui.elements.aiProfile.value = settings.aiProfile;
        this.toggleCustomInstructions();
      }
      if (settings.customInstructions) {
        this.hints.customInstructions = settings.customInstructions;
        const el = document.getElementById('custom-instructions');
        if (el) el.value = settings.customInstructions;
      }
      if (settings.autoHints !== undefined) {
        this.autoHintsEnabled = settings.autoHints;
        const el = document.getElementById('auto-hints');
        if (el) el.checked = settings.autoHints;
      }
      if (settings.opacity !== undefined) {
        const slider = document.getElementById('opacity-slider');
        const value = document.getElementById('opacity-value');
        if (slider) slider.value = settings.opacity;
        if (value) value.textContent = `${settings.opacity}%`;
        window.electronAPI.setOpacity(settings.opacity);
      }
      if (settings.debugMode !== undefined) {
        this.debugMode = settings.debugMode;
        const el = document.getElementById('debug-mode');
        if (el) el.checked = settings.debugMode;
        this.ui.toggleMetricsPanel(this.debugMode);
      }
      if (settings.compactMode) {
        this.ui.compactMode = true;
        document.body.classList.add('compact-mode');
        this.ui.elements.btnCompactToggle?.classList.add('active');
      }

      // Load hint params
      this.hints.setParams({
        contextWindowSize: settings.contextWindowSize,
        maxContextChars: settings.maxContextChars,
        maxTokens: settings.maxTokens,
        temperature: settings.temperature,
      });

      // Загружаем контекст пользователя из онбординга
      this.loadUserContext();
    } catch {
      // Ignore errors
    }
  }

  loadUserContext() {
    try {
      const onboarding = JSON.parse(localStorage.getItem('live-hints-onboarding')) || {};
      if (onboarding.contextFileContent) {
        this.hints.setUserContext(onboarding.contextFileContent);
        console.log(`[App] Загружен контекст пользователя: ${onboarding.contextFileContent.length} символов`);
      }
    } catch (err) {
      console.warn('[App] Ошибка загрузки контекста:', err);
    }
  }

  async clearServerCache() {
    try {
      const response = await fetch('http://localhost:8766/cache/clear', {
        method: 'POST',
      });
      if (response.ok) {
        console.log('[APP] Кэш сервера очищен');
      }
    } catch (err) {
      console.warn('[APP] Не удалось очистить кэш сервера:', err.message);
    }
  }

  saveSettings(newSettings = {}) {
    try {
      const settings = JSON.parse(localStorage.getItem('live-hints-settings')) || {};
      Object.assign(settings, newSettings);
      localStorage.setItem('live-hints-settings', JSON.stringify(settings));
    } catch {
      // Ignore errors
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.liveHintsApp = new LiveHintsApp();
});
