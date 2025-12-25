// Live Hints - Renderer Process
// Главный модуль UI приложения

class LiveHintsApp {
  constructor() {
    this.isRunning = false;
    this.isPaused = false;
    this.currentSessionId = null;
    this.wsConnection = null;
    this.hintRequestPending = false;
    this.transcriptContext = [];
    this.autoHintsEnabled = false;
    this.currentProfile = 'job_interview_ru';
    this.customInstructions = '';
    this.lastContextHash = '';
    this.lastHintText = '';
    this.lastTranscriptText = '';
    this.pinnedHintText = '';

    // UI режимы
    this.compactMode = false;
    this.focusMode = false;
    this.hideTranscripts = false;
    this.transcriptsCollapsed = false;
    this.theme = 'dark';
    this.stealthMode = false;

    // Настройки контекста и LLM
    this.contextWindowSize = 20; // 5..20
    this.maxContextChars = 6000; // 2000..6000
    this.maxTokens = 500; // 50..500
    this.temperature = 0.8; // 0.0..1.0
    this.debugMode = false;

    // Remote servers
    this.remoteMode = false;
    this.sttServerUrl = 'ws://localhost:8765';
    this.llmServerUrl = 'http://localhost:8766';

    // Метрики runtime
    this.metrics = {
      t_audio_in: null,
      t_transcript_last: null,
      t_hint_request_start: null,
      t_hint_response: null,
      t_hint_done: null,
      stt_latency_ms: null,
      llm_client_latency_ms: null,
      llm_server_latency_ms: null,
    };

    this.elements = {
      btnToggle: document.getElementById('btn-toggle'),
      btnMinimize: document.getElementById('btn-minimize'),
      btnClose: document.getElementById('btn-close'),
      btnHistory: document.getElementById('btn-history'),
      btnCloseModal: document.getElementById('btn-close-modal'),
      btnCloseSessionView: document.getElementById('btn-close-session-view'),
      btnDismissError: document.getElementById('btn-dismiss-error'),
      statusIndicator: document.getElementById('status-indicator'),
      statusText: document.getElementById('status-text'),
      llmProvider: document.getElementById('llm-provider'),
      transcriptFeed: document.getElementById('transcript-feed'),
      hintsFeed: document.getElementById('hints-feed'),
      historyModal: document.getElementById('history-modal'),
      sessionsList: document.getElementById('sessions-list'),
      sessionViewModal: document.getElementById('session-view-modal'),
      sessionViewTitle: document.getElementById('session-view-title'),
      sessionTranscript: document.getElementById('session-transcript'),
      sessionHints: document.getElementById('session-hints'),
      errorToast: document.getElementById('error-toast'),
      errorMessage: document.getElementById('error-message'),
      btnGetHint: document.getElementById('btn-get-hint'),
      aiProfile: document.getElementById('ai-profile'),
      customInstructionsContainer: document.getElementById('custom-instructions-container'),
      customInstructions: document.getElementById('custom-instructions'),
      autoHints: document.getElementById('auto-hints'),
      btnPause: document.getElementById('btn-pause'),
      opacitySlider: document.getElementById('opacity-slider'),
      opacityValue: document.getElementById('opacity-value'),
      fontTranscript: document.getElementById('font-transcript'),
      fontTranscriptValue: document.getElementById('font-transcript-value'),
      fontHints: document.getElementById('font-hints'),
      fontHintsValue: document.getElementById('font-hints-value'),
      // Новые элементы для этапа 2/3
      contextWindowSize: document.getElementById('context-window-size'),
      contextWindowSizeValue: document.getElementById('context-window-size-value'),
      maxContextChars: document.getElementById('max-context-chars'),
      maxContextCharsValue: document.getElementById('max-context-chars-value'),
      maxTokens: document.getElementById('max-tokens'),
      maxTokensValue: document.getElementById('max-tokens-value'),
      temperature: document.getElementById('temperature'),
      temperatureValue: document.getElementById('temperature-value'),
      debugMode: document.getElementById('debug-mode'),
      btnHealthCheck: document.getElementById('btn-health-check'),
      metricsPanel: document.getElementById('metrics-panel'),
      metricsSttLatency: document.getElementById('metrics-stt-latency'),
      metricsLlmLatency: document.getElementById('metrics-llm-latency'),
      // Новые элементы UI/UX
      btnCompactToggle: document.getElementById('btn-compact-toggle'),
      btnFocusToggle: document.getElementById('btn-focus-toggle'),
      btnSettingsToggle: document.getElementById('btn-settings-toggle'),
      settingsDrawer: document.getElementById('settings-drawer'),
      btnExitFocus: document.getElementById('btn-exit-focus'),
      btnPinHint: document.getElementById('btn-pin-hint'),
      btnCopyLast: document.getElementById('btn-copy-last'),
      btnClearHints: document.getElementById('btn-clear-hints'),
      pinnedHintContainer: document.getElementById('pinned-hint-container'),
      pinnedHintText: document.getElementById('pinned-hint-text'),
    };

    this.init();
  }

  init() {
    this.bindEvents();
    this.loadSettings();
    this.setupIPCListeners();
  }

  bindEvents() {
    // Управление окном
    this.elements.btnMinimize.addEventListener('click', () => {
      window.electronAPI.minimizeWindow();
    });

    this.elements.btnClose.addEventListener('click', () => {
      this.stop();
      window.electronAPI.closeWindow();
    });

    // Старт/Стоп
    this.elements.btnToggle.addEventListener('click', () => {
      if (this.isRunning) {
        this.stop();
      } else {
        this.start();
      }
    });

    // Смена провайдера
    this.elements.llmProvider.addEventListener('change', (e) => {
      this.saveSettings({ llmProvider: e.target.value });
    });

    // Смена профиля
    if (this.elements.aiProfile) {
      this.elements.aiProfile.addEventListener('change', (e) => {
        this.currentProfile = e.target.value;
        this.toggleCustomInstructions();
        this.saveSettings({ aiProfile: e.target.value });
      });
    }

    // Пользовательские инструкции
    if (this.elements.customInstructions) {
      this.elements.customInstructions.addEventListener('input', (e) => {
        this.customInstructions = e.target.value;
        this.saveSettings({ customInstructions: e.target.value });
      });
    }

    // Авто-подсказки
    this.elements.autoHints.addEventListener('change', (e) => {
      this.autoHintsEnabled = e.target.checked;
      this.saveSettings({ autoHints: e.target.checked });
    });

    // Кнопка "Получить ответ"
    this.elements.btnGetHint.addEventListener('click', () => {
      this.manualRequestHint();
    });

    // Кнопка Пауза/Продолжить
    this.elements.btnPause.addEventListener('click', () => {
      this.togglePause();
    });

    // Прозрачность
    this.elements.opacitySlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.elements.opacityValue.textContent = `${value}%`;
      window.electronAPI.setOpacity(value);
      this.saveSettings({ opacity: value });
    });

    // Размер шрифта транскрипта
    this.elements.fontTranscript.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.elements.fontTranscriptValue.textContent = `${value}px`;
      document.documentElement.style.setProperty('--font-transcript', `${value}px`);
      this.saveSettings({ fontTranscript: value });
    });

    // Размер шрифта подсказок
    this.elements.fontHints.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.elements.fontHintsValue.textContent = `${value}px`;
      document.documentElement.style.setProperty('--font-hints', `${value}px`);
      this.saveSettings({ fontHints: value });
    });

    // Расширенные настройки: контекст и LLM
    if (this.elements.contextWindowSize) {
      this.elements.contextWindowSize.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        this.contextWindowSize = value;
        if (this.elements.contextWindowSizeValue) {
          this.elements.contextWindowSizeValue.textContent = value;
        }
        this.saveSettings({ contextWindowSize: value });
      });
    }

    if (this.elements.maxContextChars) {
      this.elements.maxContextChars.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        this.maxContextChars = value;
        if (this.elements.maxContextCharsValue) {
          this.elements.maxContextCharsValue.textContent = value;
        }
        this.saveSettings({ maxContextChars: value });
      });
    }

    if (this.elements.maxTokens) {
      this.elements.maxTokens.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        this.maxTokens = value;
        if (this.elements.maxTokensValue) {
          this.elements.maxTokensValue.textContent = value;
        }
        this.saveSettings({ maxTokens: value });
      });
    }

    if (this.elements.temperature) {
      this.elements.temperature.addEventListener('input', (e) => {
        const value = parseInt(e.target.value) / 10; // 0-10 -> 0.0-1.0
        this.temperature = value;
        if (this.elements.temperatureValue) {
          this.elements.temperatureValue.textContent = value.toFixed(1);
        }
        this.saveSettings({ temperature: value });
      });
    }

    if (this.elements.debugMode) {
      this.elements.debugMode.addEventListener('change', (e) => {
        this.debugMode = e.target.checked;
        this.toggleMetricsPanel();
        this.saveSettings({ debugMode: e.target.checked });
      });
    }

    if (this.elements.btnHealthCheck) {
      this.elements.btnHealthCheck.addEventListener('click', () => {
        this.checkHealth();
      });
    }

    // Remote mode toggle
    const remoteMode = document.getElementById('remote-mode');
    const remoteConfig = document.getElementById('remote-servers-config');
    const remoteSttUrl = document.getElementById('remote-stt-url');
    const remoteLlmUrl = document.getElementById('remote-llm-url');
    const btnTestRemote = document.getElementById('btn-test-remote');

    if (remoteMode) {
      remoteMode.addEventListener('change', (e) => {
        this.remoteMode = e.target.checked;
        if (remoteConfig) {
          remoteConfig.classList.toggle('hidden', !e.target.checked);
        }
        this.saveSettings({ remoteMode: e.target.checked });
      });
    }

    if (remoteSttUrl) {
      remoteSttUrl.addEventListener('change', (e) => {
        this.sttServerUrl = e.target.value;
        this.saveSettings({ sttServerUrl: e.target.value });
      });
    }

    if (remoteLlmUrl) {
      remoteLlmUrl.addEventListener('change', (e) => {
        this.llmServerUrl = e.target.value;
        this.saveSettings({ llmServerUrl: e.target.value });
      });
    }

    if (btnTestRemote) {
      btnTestRemote.addEventListener('click', () => this.testRemoteConnection());
    }

    // Stealth mode
    this.setupStealthMode();

    // Settings drawer toggle
    if (this.elements.btnSettingsToggle) {
      this.elements.btnSettingsToggle.addEventListener('click', () => {
        this.toggleSettingsDrawer();
      });
    }

    // Compact mode toggle
    if (this.elements.btnCompactToggle) {
      this.elements.btnCompactToggle.addEventListener('click', () => {
        this.toggleCompactMode();
      });
    }

    // Focus mode toggle
    if (this.elements.btnFocusToggle) {
      this.elements.btnFocusToggle.addEventListener('click', () => {
        this.toggleFocusMode();
      });
    }

    // Exit focus mode
    if (this.elements.btnExitFocus) {
      this.elements.btnExitFocus.addEventListener('click', () => {
        this.toggleFocusMode();
      });
    }

    // Pin hint
    if (this.elements.btnPinHint) {
      this.elements.btnPinHint.addEventListener('click', () => {
        this.pinLastHint();
      });
    }

    // Copy last hint
    if (this.elements.btnCopyLast) {
      this.elements.btnCopyLast.addEventListener('click', () => {
        this.copyLastHint();
      });
    }

    // Clear hints
    if (this.elements.btnClearHints) {
      this.elements.btnClearHints.addEventListener('click', () => {
        this.clearHints();
      });
    }

    // Clear transcript
    const btnClearTranscript = document.getElementById('btn-clear-transcript');
    if (btnClearTranscript) {
      btnClearTranscript.addEventListener('click', () => {
        this.clearTranscript();
      });
    }

    // Toggle transcripts visibility
    const btnToggleTranscripts = document.getElementById('btn-toggle-transcripts');
    if (btnToggleTranscripts) {
      btnToggleTranscripts.addEventListener('click', () => {
        this.toggleTranscripts();
      });
    }

    // Collapse transcripts
    const btnCollapseTranscripts = document.getElementById('btn-collapse-transcripts');
    if (btnCollapseTranscripts) {
      btnCollapseTranscripts.addEventListener('click', () => {
        this.collapseTranscripts();
        btnCollapseTranscripts.textContent = this.transcriptsCollapsed ? '▼' : '▲';
      });
    }

    // Хоткеи
    document.addEventListener('keydown', (e) => this.handleHotkeys(e));

    // История
    this.elements.btnHistory.addEventListener('click', () => {
      this.showHistoryModal();
    });

    this.elements.btnCloseModal.addEventListener('click', () => {
      this.hideHistoryModal();
    });

    this.elements.btnCloseSessionView.addEventListener('click', () => {
      this.hideSessionView();
    });

    // Закрытие модалок по клику на фон
    this.elements.historyModal.addEventListener('click', (e) => {
      if (e.target === this.elements.historyModal) {
        this.hideHistoryModal();
      }
    });

    this.elements.sessionViewModal.addEventListener('click', (e) => {
      if (e.target === this.elements.sessionViewModal) {
        this.hideSessionView();
      }
    });

    // Закрытие ошибки
    this.elements.btnDismissError.addEventListener('click', () => {
      this.hideError();
    });

    // Export/Import sessions
    this.setupExportImport();

    // Ollama model selection
    this.setupModelSelection();

    // Audio devices
    this.setupAudioDevices();

    // Vision AI
    this.setupVisionAI();
  }

  setupAudioDevices() {
    const inputDevice = document.getElementById('input-device');
    const loopbackDevice = document.getElementById('loopback-device');
    const refreshBtn = document.getElementById('btn-refresh-devices');
    const dualAudio = document.getElementById('dual-audio');

    // Загружаем устройства при старте
    this.loadAudioDevices();

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadAudioDevices());
    }

    if (inputDevice) {
      inputDevice.addEventListener('change', (e) => {
        this.inputDeviceIndex = e.target.value;
        this.saveSettings({ inputDeviceIndex: e.target.value });
      });
    }

    if (loopbackDevice) {
      loopbackDevice.addEventListener('change', (e) => {
        this.loopbackDeviceIndex = e.target.value;
        this.saveSettings({ loopbackDeviceIndex: e.target.value });
      });
    }

    if (dualAudio) {
      dualAudio.addEventListener('change', (e) => {
        this.dualAudioEnabled = e.target.checked;
        this.saveSettings({ dualAudioEnabled: e.target.checked });
        this.showToast(e.target.checked ? 'Dual Audio включён' : 'Dual Audio выключен', 'success');
      });
    }
  }

  async loadAudioDevices() {
    try {
      const resp = await fetch(`${this.llmServerUrl}/audio/devices`);
      const data = await resp.json();

      const inputSelect = document.getElementById('input-device');
      const loopbackSelect = document.getElementById('loopback-device');

      if (inputSelect && data.input) {
        inputSelect.innerHTML =
          '<option value="">По умолчанию</option>' +
          data.input.map((d) => `<option value="${d.index}">${d.name}</option>`).join('');
      }

      if (loopbackSelect && data.output) {
        const loopbacks = data.output.filter((d) => d.isLoopback);
        loopbackSelect.innerHTML =
          '<option value="">Авто (Loopback)</option>' +
          loopbacks.map((d) => `<option value="${d.index}">${d.name}</option>`).join('');
      }
    } catch (e) {
      console.error('Ошибка загрузки аудио устройств:', e);
    }
  }

  setupVisionAI() {
    const visionEnabled = document.getElementById('vision-enabled');
    const captureBtn = document.getElementById('btn-capture-screen');
    const visionModal = document.getElementById('vision-modal');
    const closeVision = document.getElementById('btn-close-vision');
    const captureFullscreen = document.getElementById('btn-capture-fullscreen');
    const captureWindow = document.getElementById('btn-capture-window');
    const captureRegion = document.getElementById('btn-capture-region');
    const visionSend = document.getElementById('btn-vision-send');
    const visionRetake = document.getElementById('btn-vision-retake');
    const visionCancel = document.getElementById('btn-vision-cancel');

    this.capturedScreenshot = null;

    if (visionEnabled) {
      visionEnabled.addEventListener('change', (e) => {
        this.visionEnabled = e.target.checked;
        this.saveSettings({ visionEnabled: e.target.checked });
      });
    }

    // Открыть Vision modal
    if (captureBtn) {
      captureBtn.addEventListener('click', () => this.showVisionModal());
    }

    // Закрыть Vision modal
    if (closeVision) {
      closeVision.addEventListener('click', () => this.hideVisionModal());
    }
    if (visionModal) {
      visionModal.addEventListener('click', (e) => {
        if (e.target === visionModal) this.hideVisionModal();
      });
    }

    // Опции захвата
    if (captureFullscreen) {
      captureFullscreen.addEventListener('click', () => this.captureScreen('fullscreen'));
    }
    if (captureWindow) {
      captureWindow.addEventListener('click', () => this.captureScreen('window'));
    }
    if (captureRegion) {
      captureRegion.addEventListener('click', () => this.captureScreen('region'));
    }

    // Действия preview
    if (visionSend) {
      visionSend.addEventListener('click', () => this.sendScreenshotToAI());
    }
    if (visionRetake) {
      visionRetake.addEventListener('click', () => this.retakeScreenshot());
    }
    if (visionCancel) {
      visionCancel.addEventListener('click', () => this.hideVisionModal());
    }

    // Горячая клавиша Ctrl+S для Vision
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 's' && this.visionEnabled) {
        e.preventDefault();
        this.showVisionModal();
      }
    });
  }

  showVisionModal() {
    const modal = document.getElementById('vision-modal');
    const previewContainer = document.getElementById('vision-preview-container');
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

  async captureScreen(mode = 'fullscreen') {
    try {
      this.hideVisionModal(); // Скрываем modal перед захватом

      await new Promise((r) => setTimeout(r, 200)); // Даём время скрыться

      const imageData = await window.electronAPI?.captureScreen();

      if (imageData) {
        this.capturedScreenshot = imageData;
        this.showScreenshotPreview(imageData);
        this.showVisionModal();
      } else {
        this.showToast('Ошибка захвата экрана', 'error');
      }
    } catch (e) {
      console.error('Capture error:', e);
      this.showToast('Ошибка захвата', 'error');
    }
  }

  showScreenshotPreview(imageData) {
    const previewContainer = document.getElementById('vision-preview-container');
    const previewImg = document.getElementById('vision-preview-img');

    if (previewImg) {
      previewImg.src = `data:image/png;base64,${imageData}`;
    }
    if (previewContainer) {
      previewContainer.classList.remove('hidden');
    }
  }

  retakeScreenshot() {
    const previewContainer = document.getElementById('vision-preview-container');
    if (previewContainer) previewContainer.classList.add('hidden');
    this.capturedScreenshot = null;
  }

  async sendScreenshotToAI() {
    if (!this.capturedScreenshot) {
      this.showToast('Сначала сделайте скриншот', 'error');
      return;
    }

    this.showToast('Анализ изображения...', 'info');

    try {
      const resp = await fetch(`${this.llmServerUrl}/vision/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: this.capturedScreenshot,
          prompt:
            'Это скриншот с собеседования или технической задачи. Опиши что видишь и дай рекомендации по ответу.',
        }),
      });

      const data = await resp.json();

      if (data.analysis) {
        // Показываем результат в modal
        const resultContainer = document.getElementById('vision-result');
        const analysisText = document.getElementById('vision-analysis-text');

        if (analysisText) analysisText.textContent = data.analysis;
        if (resultContainer) resultContainer.classList.remove('hidden');

        // Добавляем как подсказку
        this.addHintItem(`[Vision AI] ${data.analysis}`, new Date().toLocaleTimeString());
        this.showToast('Анализ завершён', 'success');
      } else if (data.error) {
        this.showToast(`Vision ошибка: ${data.error}`, 'error');
      }
    } catch (e) {
      console.error('Vision AI error:', e);
      this.showToast('Ошибка Vision AI', 'error');
    }
  }

  async captureAndAnalyze() {
    try {
      if (window.electronAPI?.captureScreen) {
        const imageData = await window.electronAPI.captureScreen();
        if (imageData) {
          this.showToast('Анализ изображения...', 'info');
          const resp = await fetch(`${this.llmServerUrl}/vision/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: imageData,
              prompt: 'Это скриншот собеседования. Опиши что видишь и дай рекомендации.',
            }),
          });
          const data = await resp.json();
          if (data.analysis) {
            this.addHintItem(`[Vision AI] ${data.analysis}`, new Date().toLocaleTimeString());
          } else if (data.error) {
            this.showToast(`Vision ошибка: ${data.error}`, 'error');
          }
        }
      } else {
        this.showToast('Захват экрана недоступен', 'error');
      }
    } catch (e) {
      this.showToast('Ошибка Vision AI', 'error');
      console.error(e);
    }
  }

  setupStealthMode() {
    const stealthToggle = document.getElementById('stealth-toggle');
    const stealthStrategy = document.getElementById('stealth-strategy');
    const stealthIndicator = document.getElementById('stealth-indicator');
    const stealthStatusText = document.getElementById('stealth-status-text');

    // Загружаем текущее состояние
    this.loadStealthStatus();

    // Toggle stealth
    if (stealthToggle) {
      stealthToggle.addEventListener('change', async (e) => {
        const result = await window.electronAPI?.stealthToggle();
        this.updateStealthUI(result);
      });
    }

    // Выбор стратегии
    if (stealthStrategy) {
      stealthStrategy.addEventListener('change', async (e) => {
        await window.electronAPI?.stealthSetStrategy(e.target.value);
        this.saveSettings({ stealthStrategy: e.target.value });
        this.showToast(`Stealth стратегия: ${e.target.value}`, 'success');
      });
    }

    // Горячая клавиша Ctrl+H
    document.addEventListener('keydown', async (e) => {
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        const result = await window.electronAPI?.stealthToggle();
        this.updateStealthUI(result);
        if (stealthToggle) stealthToggle.checked = result;
      }
    });

    // События от main process
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

      // Проверяем доступность второго монитора
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

    // Показываем toast если в stealth режиме
    if (isActive) {
      this.showToast('Stealth режим активирован', 'warning');
    }
  }

  // Отправить подсказку как toast в stealth режиме
  async sendHintAsToast(text) {
    if (this.stealthMode) {
      await window.electronAPI?.stealthShowToast(text);
    }
  }

  setupExportImport() {
    const exportBtn = document.getElementById('btn-export-sessions');
    const importBtn = document.getElementById('btn-import-sessions');
    const importInput = document.getElementById('import-file-input');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportAllSessions());
    }

    if (importBtn) {
      importBtn.addEventListener('click', () => importInput?.click());
    }

    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) this.importSessions(file);
        importInput.value = '';
      });
    }
  }

  exportAllSessions() {
    try {
      const sessions = JSON.parse(localStorage.getItem('live-hints-sessions') || '[]');

      if (sessions.length === 0) {
        this.showToast('Нет сессий для экспорта', 'warning');
        return;
      }

      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        sessionsCount: sessions.length,
        sessions: sessions,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `live-hints-sessions-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showToast(`Экспортировано ${sessions.length} сессий`, 'success');
    } catch (e) {
      console.error('Export error:', e);
      this.showToast('Ошибка экспорта', 'error');
    }
  }

  async importSessions(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.sessions || !Array.isArray(data.sessions)) {
        this.showToast('Неверный формат файла', 'error');
        return;
      }

      const existingSessions = JSON.parse(localStorage.getItem('live-hints-sessions') || '[]');
      const existingIds = new Set(existingSessions.map((s) => s.id));

      // Добавляем только новые сессии
      let imported = 0;
      for (const session of data.sessions) {
        if (!existingIds.has(session.id)) {
          existingSessions.push(session);
          imported++;
        }
      }

      // Сортируем по дате (новые первые)
      existingSessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

      localStorage.setItem('live-hints-sessions', JSON.stringify(existingSessions));

      this.showToast(`Импортировано ${imported} новых сессий`, 'success');
      this.renderSessionsList();
    } catch (e) {
      console.error('Import error:', e);
      this.showToast('Ошибка импорта: неверный формат', 'error');
    }
  }

  setupModelSelection() {
    const modelSelect = document.getElementById('ollama-model');
    const refreshBtn = document.getElementById('btn-refresh-models');
    const profileBtns = document.querySelectorAll('.btn-profile');

    // Загружаем модели при запуске
    this.loadOllamaModels();

    // Обновить список моделей
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadOllamaModels());
    }

    // Выбор модели
    if (modelSelect) {
      modelSelect.addEventListener('change', (e) => {
        this.setOllamaModel(e.target.value);
      });
    }

    // Профили моделей
    profileBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const profile = btn.dataset.profile;
        this.setModelProfile(profile);
        // Обновляем активную кнопку
        profileBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Горячие клавиши для профилей
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const profiles = ['fast', 'balanced', 'accurate', 'code'];
        const profile = profiles[parseInt(e.key) - 1];
        this.setModelProfile(profile);
        // Обновляем UI
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
      const resp = await fetch(`${this.llmServerUrl}/models`);
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
      await fetch(`${this.llmServerUrl}/model/${encodeURIComponent(modelName)}`, {
        method: 'POST',
      });
      this.showToast(`Модель: ${modelName}`, 'success');
    } catch (e) {
      this.showToast('Ошибка смены модели', 'error');
    }
  }

  async setModelProfile(profileName) {
    try {
      const resp = await fetch(`${this.llmServerUrl}/model/profile/${profileName}`, {
        method: 'POST',
      });
      const data = await resp.json();
      this.showToast(`Профиль: ${profileName}`, 'success');
      this.loadOllamaModels();
    } catch (e) {
      this.showToast('Ошибка смены профиля', 'error');
    }
  }

  async testRemoteConnection() {
    const sttUrl = document.getElementById('remote-stt-url')?.value || this.sttServerUrl;
    const llmUrl = document.getElementById('remote-llm-url')?.value || this.llmServerUrl;

    let sttOk = false;
    let llmOk = false;

    // Тест LLM
    try {
      const resp = await fetch(`${llmUrl}/health`, { timeout: 5000 });
      llmOk = resp.ok;
    } catch (e) {
      llmOk = false;
    }

    // Тест STT (WebSocket)
    try {
      const ws = new WebSocket(sttUrl);
      await new Promise((resolve, reject) => {
        ws.onopen = () => {
          sttOk = true;
          ws.close();
          resolve();
        };
        ws.onerror = () => {
          sttOk = false;
          reject();
        };
        setTimeout(() => {
          ws.close();
          reject();
        }, 3000);
      });
    } catch (e) {
      sttOk = false;
    }

    if (sttOk && llmOk) {
      this.showToast('Оба сервера доступны', 'success');
    } else if (llmOk) {
      this.showToast('LLM доступен, STT недоступен', 'warning');
    } else if (sttOk) {
      this.showToast('STT доступен, LLM недоступен', 'warning');
    } else {
      this.showToast('Оба сервера недоступны', 'error');
    }
  }

  setupIPCListeners() {
    // Получение PCM данных от audio capture и отправка на STT сервер
    window.electronAPI.onPCMData((data) => {
      this.sendAudioToSTT(data);
    });

    // Получение транскрипта
    window.electronAPI.onTranscript((data) => {
      this.addTranscriptItem(data.text, data.timestamp);
    });

    // Получение подсказок
    window.electronAPI.onHint((data) => {
      this.addHintItem(data.text, data.timestamp);
    });

    // Изменение статуса
    window.electronAPI.onStatusChange((status) => {
      this.updateStatus(status);
    });

    // Ошибки
    window.electronAPI.onError((error) => {
      this.showError(error.message);
    });
  }

  sendAudioToSTT(data) {
    if (this.isPaused) return;

    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      try {
        this.wsConnection.send(data);
      } catch (e) {
        console.error('Ошибка отправки аудио:', e);
      }
    }
  }

  // Dual Audio: подключение микрофона
  connectMicrophone() {
    if (!this.dualAudioEnabled) return;

    const micUrl = this.sttServerUrl.replace(':8765', ':8764');

    try {
      this.wsMicrophone = new WebSocket(micUrl);

      this.wsMicrophone.onopen = () => {
        console.log('[MIC] WebSocket подключен');
        this.showToast('Микрофон подключен', 'success');
      };

      this.wsMicrophone.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'transcript' && data.text) {
            this.addTranscriptItem(data.text, data.timestamp, 'candidate');
          }
        } catch (e) {
          console.error('[MIC] Parse error:', e);
        }
      };

      this.wsMicrophone.onerror = (e) => {
        console.error('[MIC] WebSocket error:', e);
      };

      this.wsMicrophone.onclose = () => {
        console.log('[MIC] WebSocket закрыт');
      };
    } catch (e) {
      console.error('[MIC] Ошибка подключения:', e);
    }
  }

  disconnectMicrophone() {
    if (this.wsMicrophone) {
      this.wsMicrophone.close();
      this.wsMicrophone = null;
    }
  }

  toggleMicMute() {
    this.micMuted = !this.micMuted;
    const btn = document.getElementById('btn-mic-mute');
    if (btn) {
      btn.textContent = this.micMuted ? '🔇' : '🎤';
      btn.title = this.micMuted ? 'Включить микрофон' : 'Выключить микрофон';
    }
    this.showToast(this.micMuted ? 'Микрофон выключен' : 'Микрофон включён', 'info');
  }

  // Пауза/Продолжить
  togglePause() {
    if (!this.isRunning) return;

    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      this.updateStatus('paused');
      if (this.elements.btnPause) {
        this.elements.btnPause.textContent = 'Продолжить';
      }
    } else {
      this.updateStatus('listening');
      if (this.elements.btnPause) {
        this.elements.btnPause.textContent = 'Пауза';
      }
    }
  }

  async start() {
    try {
      this.updateStatus('listening');
      this.isRunning = true;
      this.isPaused = false;
      this.updateToggleButton();
      this.clearFeeds();

      // Показываем кнопку паузы
      if (this.elements.btnPause) {
        this.elements.btnPause.classList.remove('hidden');
        this.elements.btnPause.textContent = 'Пауза';
      }

      // Создаём новую сессию
      this.currentSessionId = this.generateSessionId();

      // Подключаемся к WebSocket STT серверу
      await this.connectToSTTServer();

      // Запускаем захват аудио
      await window.electronAPI.startAudioCapture();
    } catch (error) {
      this.showError(`Ошибка запуска: ${error.message}`);
      this.stop();
    }
  }

  async stop() {
    try {
      // Останавливаем захват аудио
      await window.electronAPI.stopAudioCapture();

      // Закрываем WebSocket
      if (this.wsConnection) {
        this.wsConnection.close();
        this.wsConnection = null;
      }

      // Сохраняем сессию
      if (this.currentSessionId) {
        this.saveSession();
        this.currentSessionId = null;
      }

      this.isRunning = false;
      this.isPaused = false;
      this.updateStatus('paused');
      this.updateToggleButton();

      // Скрываем кнопку паузы
      this.elements.btnPause.classList.add('hidden');
    } catch (error) {
      this.showError(`Ошибка остановки: ${error.message}`);
    }
  }

  async connectToSTTServer() {
    return new Promise((resolve, reject) => {
      let resolved = false;

      try {
        console.log('Подключение к STT серверу ws://localhost:8765...');
        this.wsConnection = new WebSocket('ws://localhost:8765');

        this.wsConnection.onopen = () => {
          if (resolved) return;
          resolved = true;
          console.log('Подключено к STT серверу');
          resolve();
        };

        this.wsConnection.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'transcript') {
              const latencyInfo = data.latency_ms ? ` (${data.latency_ms}ms)` : '';
              const source = data.source || 'interviewer';
              console.log(`[STT:${source}] "${data.text}"${latencyInfo}`);

              this.addTranscriptItem(data.text, new Date().toISOString(), source);

              if (this.autoHintsEnabled) {
                this.requestHint(data.text);
              }
              this.elements.btnGetHint.disabled = false;
            }
          } catch (e) {
            console.error('Ошибка парсинга сообщения:', e);
          }
        };

        this.wsConnection.onerror = (error) => {
          console.error('WebSocket ошибка:', error);
          if (!resolved) {
            resolved = true;
            reject(new Error('Ошибка подключения к STT серверу'));
          }
        };

        this.wsConnection.onclose = () => {
          console.log('WebSocket закрыт');
          if (!resolved) {
            resolved = true;
            reject(new Error('Соединение закрыто'));
          }
        };

        // Таймаут подключения (30 секунд - модель загружается при старте)
        setTimeout(() => {
          if (!resolved && this.wsConnection.readyState !== WebSocket.OPEN) {
            resolved = true;
            reject(new Error('Таймаут подключения к STT серверу. Убедитесь что сервер запущен.'));
          }
        }, 30000);
      } catch (error) {
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      }
    });
  }

  async requestHint(transcriptText) {
    // Накапливаем контекст с учётом окна
    this.transcriptContext.push(transcriptText);
    if (this.transcriptContext.length > this.contextWindowSize) {
      this.transcriptContext = this.transcriptContext.slice(-this.contextWindowSize);
    }

    // Формируем контекст с ограничением по символам
    const context = this.buildContext();

    // Дедуп запросов: проверяем hash контекста
    const contextHash = context.join('|');
    if (this.lastContextHash === contextHash) {
      if (this.debugMode) console.log('[LLM] Дубликат контекста, пропускаем');
      return;
    }

    // Защита от множественных запросов
    if (this.hintRequestPending) {
      if (this.debugMode) console.log('[LLM] Запрос уже в процессе, накоплен контекст');
      return;
    }

    this.hintRequestPending = true;
    this.lastContextHash = contextHash;
    this.metrics.t_hint_request_start = performance.now();
    const startTime = this.metrics.t_hint_request_start;

    // Показываем spinner/индикатор загрузки
    this.showHintLoading();

    if (this.debugMode) {
      console.log(
        `[LLM] Streaming запрос: maxTokens=${this.maxTokens}, temperature=${this.temperature}`
      );
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 сек для streaming

      // Используем streaming endpoint
      const response = await fetch('http://localhost:8766/hint/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: transcriptText,
          context: context,
          profile: 'interview',
          max_tokens: this.maxTokens,
          temperature: this.temperature,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        clearTimeout(timeoutId);
        const errorText = await response.text().catch(() => 'Не удалось прочитать ответ');
        console.error(`[LLM] Ошибка ${response.status}: ${errorText.substring(0, 300)}`);
        this.showError(`LLM ошибка ${response.status}`);
        this.hideHintLoading();
        return;
      }

      // Streaming: читаем SSE чанки
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedHint = '';
      let hintElement = null;
      let isFirstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.chunk) {
              if (isFirstChunk) {
                // Первый токен - записываем TTFT
                this.metrics.t_hint_response = performance.now();
                const ttft = Math.round(this.metrics.t_hint_response - startTime);
                if (this.debugMode) console.log(`[LLM] TTFT: ${ttft}ms`);

                // Скрываем spinner, создаём элемент для подсказки
                this.hideHintLoading();
                hintElement = this.createStreamingHintElement();
                isFirstChunk = false;
              }

              accumulatedHint += data.chunk;
              if (hintElement) {
                this.updateStreamingHint(hintElement, accumulatedHint);
              }
            }

            if (data.done) {
              clearTimeout(timeoutId);
              this.metrics.t_hint_done = performance.now();
              const totalLatency = Math.round(this.metrics.t_hint_done - startTime);

              // Обновляем метрики
              this.metrics.llm_client_latency_ms = totalLatency;
              this.metrics.llm_server_latency_ms = data.latency_ms || null;
              this.updateMetricsPanel();

              if (this.debugMode) {
                console.log(
                  `[LLM] Streaming завершён: total=${totalLatency}ms, server=${data.latency_ms}ms, cached=${data.cached}, type=${data.question_type}`
                );
              }

              // Финализируем подсказку с cache индикацией и типом
              if (hintElement && accumulatedHint.trim()) {
                this.finalizeStreamingHint(hintElement, accumulatedHint, {
                  latencyMs: data.latency_ms,
                  cached: data.cached || false,
                  questionType: data.question_type || 'general',
                });
                this.lastHintText = accumulatedHint.trim();
              } else if (!accumulatedHint.trim()) {
                this.hideHintLoading();
                this.showToast('LLM вернул пустой ответ', 'warning');
              }
            }
          } catch (parseError) {
            if (this.debugMode) console.warn('[LLM] SSE parse error:', parseError);
          }
        }
      }
    } catch (error) {
      this.hideHintLoading();
      const errorMessage = this.getReadableError(error);
      console.error('[LLM] Ошибка:', errorMessage);
      this.showError(errorMessage);
    } finally {
      this.hintRequestPending = false;
    }
  }

  // Преобразование ошибок в понятные русские сообщения
  getReadableError(error) {
    if (error.name === 'AbortError') {
      return 'Таймаут запроса к LLM (60 сек)';
    }
    if (error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
      return 'LLM сервер недоступен (http://localhost:8766)';
    }
    if (error.message?.includes('NetworkError') || error.message?.includes('network')) {
      return 'Ошибка сети. Проверьте подключение.';
    }
    if (error.message?.includes('ECONNREFUSED')) {
      return 'LLM сервер не запущен. Запустите: python python/llm_server.py';
    }
    return `Ошибка: ${error.message || 'Неизвестная ошибка'}`;
  }

  // Показать индикатор загрузки подсказки
  showHintLoading() {
    const feed = this.elements.hintsFeed;
    if (!feed) return;

    // Удаляем placeholder
    const placeholder = feed.querySelector('.placeholder');
    if (placeholder) placeholder.remove();

    // Удаляем предыдущий loader если есть
    const existingLoader = feed.querySelector('.hint-loading');
    if (existingLoader) existingLoader.remove();

    const loader = document.createElement('div');
    loader.className = 'feed-item hint-loading';
    loader.innerHTML = `
            <div class="feed-item-time">${this.formatTime(new Date().toISOString())}</div>
            <div class="feed-item-text loading-text">Генерация подсказки...</div>
        `;
    feed.appendChild(loader);
    feed.scrollTop = feed.scrollHeight;
  }

  // Скрыть индикатор загрузки
  hideHintLoading() {
    const feed = this.elements.hintsFeed;
    if (!feed) return;
    const loader = feed.querySelector('.hint-loading');
    if (loader) loader.remove();
  }

  // Создать элемент для streaming подсказки
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

  // Обновить streaming подсказку
  updateStreamingHint(element, text) {
    if (!element) return;
    const textEl = element.querySelector('.feed-item-text');
    if (textEl) {
      // Используем markdown рендеринг для подсказок
      textEl.innerHTML = this.renderMarkdown(text);
    }
    // Scroll to bottom
    const feed = this.elements.hintsFeed;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }

  // Финализировать streaming подсказку
  finalizeStreamingHint(element, text, options = {}) {
    if (!element) return;
    element.classList.remove('streaming-hint');

    const { latencyMs, cached, questionType } = options;
    const timeEl = element.querySelector('.feed-item-time');

    if (timeEl) {
      // Badge типа вопроса
      if (questionType) {
        const typeBadge = document.createElement('span');
        typeBadge.className = `question-type-badge type-${questionType}`;
        typeBadge.textContent = this.getQuestionTypeLabel(questionType);
        timeEl.appendChild(typeBadge);
      }

      // Cache индикация
      if (cached) {
        const cacheBadge = document.createElement('span');
        cacheBadge.className = 'cache-badge';
        cacheBadge.textContent = 'Из кэша';
        timeEl.appendChild(cacheBadge);
      }

      // Латентность (только если не из кэша)
      if (latencyMs && !cached) {
        const latencyBadge = document.createElement('span');
        latencyBadge.className = 'latency-badge';
        latencyBadge.textContent = this.formatLatency(latencyMs);
        timeEl.appendChild(latencyBadge);
      }
    }
  }

  // Получить человекочитаемый label для типа вопроса
  getQuestionTypeLabel(type) {
    const labels = {
      technical: 'Технический',
      experience: 'Опыт',
      general: 'Общий',
    };
    return labels[type] || type;
  }

  updateStatus(status) {
    const statusMap = {
      listening: { class: 'status-listening', text: 'Слушаю...' },
      paused: { class: 'status-paused', text: 'Приостановлено' },
      error: { class: 'status-error', text: 'Ошибка' },
    };

    const config = statusMap[status] || statusMap.paused;

    if (this.elements.statusIndicator) {
      this.elements.statusIndicator.className = `status-indicator ${config.class}`;
    }
    if (this.elements.statusText) {
      this.elements.statusText.textContent = config.text;
    }
  }

  updateToggleButton() {
    const btn = this.elements.btnToggle;
    if (!btn) return;

    const icon = btn.querySelector('.btn-icon');
    const text = btn.querySelector('.btn-text');

    if (this.isRunning) {
      btn.classList.add('active');
      if (icon) icon.textContent = '';
      if (text) text.textContent = 'Стоп';
    } else {
      btn.classList.remove('active');
      if (icon) icon.textContent = '';
      if (text) text.textContent = 'Старт';
    }
  }

  clearFeeds() {
    if (this.elements.transcriptFeed) {
      this.elements.transcriptFeed.innerHTML = '';
    }
    if (this.elements.hintsFeed) {
      this.elements.hintsFeed.innerHTML = '';
    }
  }

  addTranscriptItem(text, timestamp, source = 'interviewer') {
    // Дедуп транскриптов
    if (text === this.lastTranscriptText) {
      console.log('[STT] Дубликат транскрипта, пропускаем');
      return;
    }
    this.lastTranscriptText = text;

    // Добавляем метку источника для Dual Audio
    const icon = source === 'candidate' ? '🗣️' : '🎙️';
    const label = source === 'candidate' ? 'Ты' : 'Интервьюер';
    const formattedText = this.dualAudioEnabled ? `${icon} ${label}: ${text}` : text;

    this.addFeedItem(this.elements.transcriptFeed, formattedText, timestamp, null, source);
  }

  addHintItem(text, timestamp, latencyMs = null) {
    // Дедуп подсказок
    if (text === this.lastHintText) {
      console.log('[LLM] Дубликат подсказки, пропускаем');
      return;
    }
    this.lastHintText = text;
    this.addFeedItem(this.elements.hintsFeed, text, timestamp, latencyMs);
  }

  addFeedItem(feed, text, timestamp, latencyMs = null) {
    // Удаляем placeholder если есть
    const placeholder = feed.querySelector('.placeholder');
    if (placeholder) {
      placeholder.remove();
    }

    const item = document.createElement('div');
    item.className = 'feed-item';

    // Показываем latency если есть (в секундах)
    const latencyBadge = latencyMs
      ? `<span class="latency-badge">${this.formatLatency(latencyMs)}</span>`
      : '';

    // Markdown рендеринг только для hints feed
    const isHintsFeed = feed === this.elements.hintsFeed;
    const renderedText = isHintsFeed ? this.renderMarkdown(text) : this.escapeHtml(text);

    item.innerHTML = `
      <div class="feed-item-time">${this.formatTime(timestamp)}${latencyBadge}</div>
      <div class="feed-item-text">${renderedText}</div>
    `;

    feed.appendChild(item);
    feed.scrollTop = feed.scrollHeight;
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  // Форматирование latency в секундах
  formatLatency(latencyMs) {
    if (latencyMs == null || latencyMs === undefined) return '';
    const seconds = latencyMs / 1000;
    return `${seconds.toFixed(1)}s`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Простой markdown парсер для подсказок
  renderMarkdown(text) {
    if (!text) return '';

    let html = this.escapeHtml(text);

    // Жирный текст: **text** или __text__
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Курсив: *text* или _text_
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Инлайн код: `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Списки: - item или * item
    html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Нумерованные списки: 1. item
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

    // Переносы строк
    html = html.replace(/\n/g, '<br>');

    // Убираем лишние <br> внутри списков
    html = html.replace(/<\/li><br>/g, '</li>');
    html = html.replace(/<br><li>/g, '<li>');

    return html;
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Работа с историей
  saveSession() {
    const session = {
      id: this.currentSessionId,
      date: new Date().toISOString(),
      transcript: this.getTranscriptText(),
      hints: this.getHintsText(),
    };

    const sessions = this.getSessions();
    sessions.unshift(session);

    // Храним максимум 999 сессий
    if (sessions.length > 999) {
      sessions.pop();
    }

    localStorage.setItem('live-hints-sessions', JSON.stringify(sessions));
  }

  getSessions() {
    try {
      return JSON.parse(localStorage.getItem('live-hints-sessions')) || [];
    } catch {
      return [];
    }
  }

  getTranscriptText() {
    const items = this.elements.transcriptFeed.querySelectorAll('.feed-item-text');
    return Array.from(items)
      .map((el) => el.textContent)
      .join('\n');
  }

  getHintsText() {
    const items = this.elements.hintsFeed.querySelectorAll('.feed-item-text');
    return Array.from(items)
      .map((el) => el.textContent)
      .join('\n');
  }

  showHistoryModal() {
    this.renderSessionsList();
    this.elements.historyModal.classList.remove('hidden');
  }

  hideHistoryModal() {
    this.elements.historyModal.classList.add('hidden');
  }

  renderSessionsList() {
    const sessions = this.getSessions();

    if (sessions.length === 0) {
      this.elements.sessionsList.innerHTML = '<p class="placeholder">Нет сохранённых сессий</p>';
      return;
    }

    this.elements.sessionsList.innerHTML = sessions
      .map((session) => {
        const transcriptLines = (session.transcript || '').split('\n').filter((l) => l.trim());
        const hintLines = (session.hints || '').split('\n').filter((l) => l.trim());
        const duration = this.calculateDuration(session);
        const tags = session.tags || [];

        return `
            <div class="session-card" data-session-id="${session.id}">
                <div class="session-card-header">
                    <span class="session-card-title">${session.name || 'Сессия'}</span>
                    <span class="session-card-date">${this.formatDateFull(session.date)}</span>
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
                ${
                  tags.length > 0
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

    // Добавляем обработчики
    this.elements.sessionsList.querySelectorAll('.session-card').forEach((card) => {
      const sessionId = card.dataset.sessionId;

      card.querySelector('.btn-session-view')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showSessionView(sessionId);
      });

      card.querySelector('.btn-session-export')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.exportSession(sessionId);
      });

      card.querySelector('.btn-session-delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteSession(sessionId);
      });

      card.addEventListener('click', () => {
        this.showSessionView(sessionId);
      });
    });
  }

  calculateDuration(session) {
    if (session.endedAt && session.date) {
      const start = new Date(session.date);
      const end = new Date(session.endedAt);
      const diffMs = end - start;
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return '< 1 мин';
      if (mins < 60) return `${mins} мин`;
      const hours = Math.floor(mins / 60);
      return `${hours} ч ${mins % 60} мин`;
    }
    return '—';
  }

  formatDateFull(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  showSessionView(sessionId) {
    const sessions = this.getSessions();
    const session = sessions.find((s) => s.id === sessionId);

    if (!session) return;

    // Парсим транскрипты и подсказки в хронологическом порядке
    const transcriptLines = (session.transcript || '').split('\n').filter((l) => l.trim());
    const hintLines = (session.hints || '').split('\n').filter((l) => l.trim());

    this.elements.sessionViewTitle.textContent =
      session.name || `Сессия от ${this.formatDate(session.date)}`;

    // Форматируем транскрипт с временными метками
    this.elements.sessionTranscript.innerHTML =
      transcriptLines.length > 0
        ? transcriptLines
            .map(
              (line, i) => `
                <div class="session-dialog-item">
                    <span class="dialog-icon">🎙️</span>
                    <span class="dialog-text">${this.escapeHtml(line)}</span>
                </div>
            `
            )
            .join('')
        : '<p class="placeholder">Нет транскрипта</p>';

    // Форматируем подсказки
    this.elements.sessionHints.innerHTML =
      hintLines.length > 0
        ? hintLines
            .map(
              (line, i) => `
                <div class="session-dialog-item hint-item">
                    <span class="dialog-icon">💡</span>
                    <span class="dialog-text">${this.renderMarkdown(line)}</span>
                </div>
            `
            )
            .join('')
        : '<p class="placeholder">Нет подсказок</p>';

    this.hideHistoryModal();
    this.elements.sessionViewModal.classList.remove('hidden');
  }

  exportSession(sessionId) {
    const sessions = this.getSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const content = `# Сессия: ${session.name || 'Без названия'}
Дата: ${this.formatDateFull(session.date)}

## Транскрипт
${session.transcript || 'Нет данных'}

## Подсказки
${session.hints || 'Нет данных'}
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_${new Date(session.date).toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    this.showToast('Сессия экспортирована', 'success');
  }

  deleteSession(sessionId) {
    if (!confirm('Удалить эту сессию?')) return;

    let sessions = this.getSessions();
    sessions = sessions.filter((s) => s.id !== sessionId);
    localStorage.setItem('live-hints-sessions', JSON.stringify(sessions));

    this.renderSessionsList();
    this.showToast('Сессия удалена', 'success');
  }

  hideSessionView() {
    this.elements.sessionViewModal.classList.add('hidden');
  }

  formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Хоткеи
  handleHotkeys(e) {
    // Ctrl+/ - показать/скрыть overlay
    if (e.ctrlKey && e.key === '/') {
      e.preventDefault();
      window.electronAPI.toggleVisibility?.();
    }
    // Ctrl+Arrow - перемещение окна
    if (e.ctrlKey && e.key.startsWith('Arrow')) {
      e.preventDefault();
      const direction = e.key.replace('Arrow', '').toLowerCase();
      window.electronAPI.moveWindow?.(direction);
    }
    // Ctrl+Enter - получить подсказку
    if (e.ctrlKey && e.key === 'Enter' && this.isRunning) {
      e.preventDefault();
      this.manualRequestHint();
    }
    // Ctrl+T - скрыть/показать транскрипты
    if (e.ctrlKey && e.key === 't') {
      e.preventDefault();
      this.toggleTranscripts();
    }
    // Ctrl+H - stealth режим
    if (e.ctrlKey && e.key === 'h') {
      e.preventDefault();
      this.toggleStealth();
    }
    // Ctrl+D - переключить тему
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      this.toggleTheme();
    }
  }

  // Переключение видимости транскриптов
  toggleTranscripts() {
    this.hideTranscripts = !this.hideTranscripts;
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.setAttribute('data-hide-transcripts', this.hideTranscripts);
    }
    // Обновляем кнопку если есть
    const btn = document.getElementById('btn-toggle-transcripts');
    if (btn) {
      btn.textContent = this.hideTranscripts ? '👁' : '👁‍🗨';
      btn.title = this.hideTranscripts ? 'Показать транскрипты' : 'Скрыть транскрипты';
    }
    this.showToast(this.hideTranscripts ? 'Транскрипты скрыты' : 'Транскрипты показаны', 'success');
    this.saveSettings();
  }

  // Свернуть/развернуть блок транскриптов
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

  // Переключение темы
  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', this.theme);
    this.showToast(`Тема: ${this.theme === 'dark' ? 'тёмная' : 'светлая'}`, 'success');
    this.saveSettings();
  }

  // Переключение stealth режима
  async toggleStealth() {
    if (window.electronAPI?.stealthToggle) {
      this.stealthMode = await window.electronAPI.stealthToggle();
      if (this.stealthMode) {
        this.showToast('Stealth режим активирован', 'success');
      }
    }
  }

  // Переключение видимости кастомных инструкций
  toggleCustomInstructions() {
    if (!this.elements.customInstructionsContainer) return;

    if (this.currentProfile === 'custom') {
      this.elements.customInstructionsContainer.classList.remove('hidden');
    } else {
      this.elements.customInstructionsContainer.classList.add('hidden');
    }
  }

  // Построение контекста с ограничением по символам
  buildContext() {
    const items = this.transcriptContext.slice(-this.contextWindowSize);
    let totalChars = 0;
    const result = [];

    // Идём с конца, сохраняя последние реплики
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (totalChars + item.length <= this.maxContextChars) {
        result.unshift(item);
        totalChars += item.length;
      } else {
        break;
      }
    }

    return result;
  }

  // Переключение панели метрик
  toggleMetricsPanel() {
    if (!this.elements.metricsPanel) return;

    if (this.debugMode) {
      this.elements.metricsPanel.classList.remove('hidden');
      document.body.classList.add('debug-mode');
    } else {
      this.elements.metricsPanel.classList.add('hidden');
      document.body.classList.remove('debug-mode');
    }
  }

  // Переключение Settings drawer
  toggleSettingsDrawer() {
    if (!this.elements.settingsDrawer) return;

    const isOpen = this.elements.settingsDrawer.classList.toggle('open');
    if (this.elements.btnSettingsToggle) {
      this.elements.btnSettingsToggle.classList.toggle('active', isOpen);
    }
  }

  // Переключение Compact mode
  toggleCompactMode() {
    this.compactMode = !this.compactMode;
    document.body.classList.toggle('compact-mode', this.compactMode);

    if (this.elements.btnCompactToggle) {
      this.elements.btnCompactToggle.classList.toggle('active', this.compactMode);
    }

    this.saveSettings({ compactMode: this.compactMode });
  }

  // Переключение Focus mode
  toggleFocusMode() {
    this.focusMode = !this.focusMode;
    document.body.classList.toggle('focus-mode', this.focusMode);

    if (this.elements.btnFocusToggle) {
      this.elements.btnFocusToggle.classList.toggle('active', this.focusMode);
    }

    this.saveSettings({ focusMode: this.focusMode });
  }

  // Закрепить последнюю подсказку
  pinLastHint() {
    if (!this.lastHintText) {
      this.showToast('Нет подсказки для закрепления', 'info');
      return;
    }

    this.pinnedHintText = this.lastHintText;

    if (this.elements.pinnedHintText) {
      this.elements.pinnedHintText.textContent = this.pinnedHintText;
    }
    if (this.elements.pinnedHintContainer) {
      this.elements.pinnedHintContainer.classList.remove('hidden');
    }

    this.showToast('Подсказка закреплена', 'success');
  }

  // Открепить подсказку
  unpinHint() {
    this.pinnedHintText = '';
    if (this.elements.pinnedHintContainer) {
      this.elements.pinnedHintContainer.classList.add('hidden');
    }
  }

  // Копировать последнюю подсказку в буфер
  async copyLastHint() {
    const textToCopy = this.pinnedHintText || this.lastHintText;

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

  // Очистить hints
  clearHints() {
    if (this.elements.hintsFeed) {
      this.elements.hintsFeed.innerHTML = '<p class="placeholder">Подсказки появятся здесь...</p>';
    }
    this.lastHintText = '';
    this.unpinHint();
  }

  // Очистить transcript
  clearTranscript() {
    if (this.elements.transcriptFeed) {
      this.elements.transcriptFeed.innerHTML = '<p class="placeholder">Ожидание речи...</p>';
    }
    this.transcriptContext = [];
    this.lastTranscriptText = '';
    this.lastContextHash = '';
  }

  // Обновление панели метрик
  updateMetricsPanel() {
    if (!this.debugMode) return;

    if (this.elements.metricsSttLatency) {
      this.elements.metricsSttLatency.textContent = this.metrics.stt_latency_ms ?? '-';
    }
    if (this.elements.metricsLlmLatency) {
      const serverMs = this.metrics.llm_server_latency_ms ?? '-';
      this.elements.metricsLlmLatency.textContent = serverMs;
    }
  }

  // Проверка здоровья LLM сервера
  async checkHealth() {
    try {
      const response = await fetch('http://localhost:8766/health', {
        method: 'GET',
        timeout: 5000,
      });

      if (response.ok) {
        const data = await response.json();
        const msg = `LLM: ${data.status}, модель: ${data.model}`;
        this.showToast(msg, 'success');
        console.log('[Health]', data);
      } else {
        this.showError('LLM сервер недоступен');
      }
    } catch (error) {
      this.showError(`LLM сервер не отвечает: ${error.message}`);
    }
  }

  // Показ toast сообщения
  showToast(message, type = 'info') {
    // Используем существующий errorToast для простоты
    if (this.elements.errorMessage) {
      this.elements.errorMessage.textContent = message;
    }
    if (this.elements.errorToast) {
      this.elements.errorToast.classList.remove('hidden');
      this.elements.errorToast.style.background = type === 'success' ? 'var(--accent-success)' : '';
      setTimeout(() => {
        this.elements.errorToast.classList.add('hidden');
        this.elements.errorToast.style.background = '';
      }, 3000);
    }
  }

  // Сборка system prompt с учётом профиля
  buildSystemPrompt() {
    const MAX_PROMPT_LENGTH = 4000;
    const DEFAULT_FALLBACK = 'Ты ассистент. Дай краткий ответ по контексту разговора на русском.';

    const profiles = {
      job_interview_ru: `Ты помощник на собеседовании. Давай краткие, полезные подсказки по техническим вопросам. Отвечай на русском, кратко и по делу.

Ассистент должен отвечать от имени кандидата, придерживаясь единого потока речи; избегать точек между предложениями, когда это возможно. Максимальное разделение — абзацами при смене мысли; преимущественно использовать запятые и переносы строк для выделения тем, имитируя живую речь.

- Все ответы формулируются на русском языке
- Англицизмы запрещены
- Допускается только разговорный стиль; избегать шаблонных и штампованных фраз
- Проявлять живость, непринужденность, использовать обороты, характерные для устной речи
- Не разрешается дословное повторение одной и той же фразы в похожих ответах

Структура ответа:
- Первая мысль — краткая вводная
- Далее описывать логику или шаги через запятую, всё в едином потоке
- Итоговая фраза

Запрещено упоминать «как ИИ» или «как модель». Не придумывать вымышленных деталей.`,
    };

    // Для custom профиля: нормализуем и валидируем инструкции
    if (this.currentProfile === 'custom') {
      const trimmed = (this.customInstructions || '').trim();
      if (trimmed.length > 0) {
        // Ограничиваем длину
        return trimmed.length > MAX_PROMPT_LENGTH
          ? trimmed.substring(0, MAX_PROMPT_LENGTH)
          : trimmed;
      }
      // Пустые инструкции — используем fallback
      return DEFAULT_FALLBACK;
    }

    return profiles[this.currentProfile] || profiles.job_interview_ru;
  }

  // Ручной запрос подсказки по кнопке
  async manualRequestHint() {
    if (!this.isRunning || this.transcriptContext.length === 0) {
      this.showError('Нет транскрипта для анализа. Дождитесь речи.');
      return;
    }

    // Берём весь накопленный контекст
    const fullContext = this.transcriptContext.join(' ');
    await this.requestHint(fullContext);
  }

  // Настройки
  loadSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem('live-hints-settings')) || {};
      if (settings.llmProvider) {
        this.elements.llmProvider.value = settings.llmProvider;
      }
      if (settings.aiProfile) {
        this.currentProfile = settings.aiProfile;
        this.elements.aiProfile.value = settings.aiProfile;
        this.toggleCustomInstructions();
      }
      if (settings.customInstructions) {
        this.customInstructions = settings.customInstructions;
        if (this.elements.customInstructions) {
          this.elements.customInstructions.value = settings.customInstructions;
        }
      }
      if (settings.autoHints !== undefined) {
        this.autoHintsEnabled = settings.autoHints;
        this.elements.autoHints.checked = settings.autoHints;
      }
      // Прозрачность
      if (settings.opacity !== undefined) {
        this.elements.opacitySlider.value = settings.opacity;
        this.elements.opacityValue.textContent = `${settings.opacity}%`;
        window.electronAPI.setOpacity(settings.opacity);
      }
      // Размер шрифта транскрипта
      if (settings.fontTranscript !== undefined) {
        this.elements.fontTranscript.value = settings.fontTranscript;
        this.elements.fontTranscriptValue.textContent = `${settings.fontTranscript}px`;
        document.documentElement.style.setProperty(
          '--font-transcript',
          `${settings.fontTranscript}px`
        );
      }
      // Размер шрифта подсказок
      if (settings.fontHints !== undefined) {
        this.elements.fontHints.value = settings.fontHints;
        this.elements.fontHintsValue.textContent = `${settings.fontHints}px`;
        document.documentElement.style.setProperty('--font-hints', `${settings.fontHints}px`);
      }
      // Расширенные настройки контекста и LLM
      if (settings.contextWindowSize !== undefined) {
        this.contextWindowSize = settings.contextWindowSize;
        if (this.elements.contextWindowSize) {
          this.elements.contextWindowSize.value = settings.contextWindowSize;
        }
        if (this.elements.contextWindowSizeValue) {
          this.elements.contextWindowSizeValue.textContent = settings.contextWindowSize;
        }
      }
      if (settings.maxContextChars !== undefined) {
        this.maxContextChars = settings.maxContextChars;
        if (this.elements.maxContextChars) {
          this.elements.maxContextChars.value = settings.maxContextChars;
        }
        if (this.elements.maxContextCharsValue) {
          this.elements.maxContextCharsValue.textContent = settings.maxContextChars;
        }
      }
      if (settings.maxTokens !== undefined) {
        this.maxTokens = settings.maxTokens;
        if (this.elements.maxTokens) {
          this.elements.maxTokens.value = settings.maxTokens;
        }
        if (this.elements.maxTokensValue) {
          this.elements.maxTokensValue.textContent = settings.maxTokens;
        }
      }
      if (settings.temperature !== undefined) {
        this.temperature = settings.temperature;
        if (this.elements.temperature) {
          this.elements.temperature.value = Math.round(settings.temperature * 10);
        }
        if (this.elements.temperatureValue) {
          this.elements.temperatureValue.textContent = settings.temperature.toFixed(1);
        }
      }
      if (settings.debugMode !== undefined) {
        this.debugMode = settings.debugMode;
        if (this.elements.debugMode) {
          this.elements.debugMode.checked = settings.debugMode;
        }
        this.toggleMetricsPanel();
      }
      // UI режимы
      if (settings.compactMode) {
        this.compactMode = true;
        document.body.classList.add('compact-mode');
        if (this.elements.btnCompactToggle) {
          this.elements.btnCompactToggle.classList.add('active');
        }
      }
      if (settings.focusMode) {
        this.focusMode = true;
        document.body.classList.add('focus-mode');
        if (this.elements.btnFocusToggle) {
          this.elements.btnFocusToggle.classList.add('active');
        }
      }
    } catch {
      // Игнорируем ошибки
    }
  }

  saveSettings(newSettings) {
    try {
      const settings = JSON.parse(localStorage.getItem('live-hints-settings')) || {};
      Object.assign(settings, newSettings);
      localStorage.setItem('live-hints-settings', JSON.stringify(settings));
    } catch {
      // Игнорируем ошибки
    }
  }

  // Уведомления об ошибках
  showError(message) {
    this.elements.errorMessage.textContent = message;
    this.elements.errorToast.classList.remove('hidden');
    this.updateStatus('error');

    // Автоскрытие через 5 секунд
    setTimeout(() => {
      this.hideError();
    }, 5000);
  }

  hideError() {
    this.elements.errorToast.classList.add('hidden');
  }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
  window.liveHintsApp = new LiveHintsApp();
});
