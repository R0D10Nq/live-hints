// Live Hints - Onboarding Process

class OnboardingApp {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 4;
    this.settings = {
      language: 'ru',
      microphoneId: null,
      microphoneGranted: false,
      screenGranted: false,
      selectedMonitor: null,
      contextFilePath: null,
      contextFileName: null,
    };

    this.audioContext = null;
    this.mediaStream = null;
    this.analyser = null;
    this.vuAnimationId = null;

    this.elements = {
      // Progress
      progressSteps: document.querySelectorAll('.progress-step'),
      progressLines: document.querySelectorAll('.progress-line'),
      currentStepEl: document.getElementById('current-step'),

      // Step contents
      stepContents: document.querySelectorAll('.step-content'),

      // Navigation
      btnBack: document.getElementById('btn-back'),
      btnNext: document.getElementById('btn-next'),
      btnSkip: document.getElementById('btn-skip'),
      btnFinish: document.getElementById('btn-finish'),

      // Window controls
      btnMinimize: document.getElementById('btn-minimize'),
      btnClose: document.getElementById('btn-close'),

      // Step 1: Language
      languageSelect: document.getElementById('language-select'),
      languagePreviewText: document.getElementById('language-preview-text'),

      // Step 2: Microphone
      btnRequestMic: document.getElementById('btn-request-mic'),
      micStatus: document.getElementById('mic-status'),
      micDeviceSelection: document.getElementById('mic-device-selection'),
      micSelect: document.getElementById('mic-select'),
      micVuMeter: document.getElementById('mic-vu-meter'),

      // Step 3: Screen
      btnRequestScreen: document.getElementById('btn-request-screen'),
      screenStatus: document.getElementById('screen-status'),
      monitorSelection: document.getElementById('monitor-selection'),
      monitorGrid: document.getElementById('monitor-grid'),

      // Step 4: Context File
      fileUploadArea: document.getElementById('file-upload-area'),
      contextFileInput: document.getElementById('context-file-input'),
      fileInfo: document.getElementById('file-info'),
      fileName: document.getElementById('file-name'),
      fileSize: document.getElementById('file-size'),
      btnRemoveFile: document.getElementById('btn-remove-file'),
    };

    this.languagePreviews = {
      ru: '"Расскажите о себе" — это возможность кратко представить свой опыт и навыки, релевантные позиции...',
      en: '"Tell me about yourself" — this is an opportunity to briefly present your experience and skills relevant to the position...',
      de: '"Erzählen Sie mir von sich" — dies ist eine Gelegenheit, Ihre Erfahrung und Fähigkeiten kurz vorzustellen...',
      fr: '"Parlez-moi de vous" — c\'est l\'occasion de présenter brièvement votre expérience et vos compétences...',
      es: '"Cuéntame sobre ti" — esta es una oportunidad para presentar brevemente tu experiencia y habilidades...',
      zh: '"请介绍一下你自己" — 这是一个简要介绍你的经验和技能的机会...',
      ja: '"自己紹介してください" — これはあなたの経験とスキルを簡潔に紹介する機会です...',
      ko: '"자기소개를 해주세요" — 이것은 귀하의 경험과 기술을 간략하게 소개할 수 있는 기회입니다...',
    };

    this.init();
  }

  init() {
    this.bindEvents();
    this.updateUI();
  }

  bindEvents() {
    // Window controls
    this.elements.btnMinimize.addEventListener('click', () => {
      window.electronAPI.minimizeWindow();
    });

    this.elements.btnClose.addEventListener('click', () => {
      window.electronAPI.closeWindow();
    });

    // Navigation
    this.elements.btnBack.addEventListener('click', () => this.prevStep());
    this.elements.btnNext.addEventListener('click', () => this.nextStep());
    this.elements.btnSkip.addEventListener('click', () => this.skipStep());
    this.elements.btnFinish.addEventListener('click', () => this.finish());

    // Step 1: Language
    this.elements.languageSelect.addEventListener('change', (e) => {
      this.settings.language = e.target.value;
      this.updateLanguagePreview();
    });

    // Step 2: Microphone
    this.elements.btnRequestMic.addEventListener('click', () => this.requestMicrophoneAccess());
    this.elements.micSelect.addEventListener('change', (e) => {
      this.settings.microphoneId = e.target.value;
      this.startVuMeter(e.target.value);
    });

    // Step 3: Screen
    this.elements.btnRequestScreen.addEventListener('click', () => this.requestScreenAccess());

    // Step 4: File upload
    this.elements.fileUploadArea.addEventListener('click', () => {
      this.elements.contextFileInput.click();
    });

    this.elements.fileUploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.elements.fileUploadArea.classList.add('dragover');
    });

    this.elements.fileUploadArea.addEventListener('dragleave', () => {
      this.elements.fileUploadArea.classList.remove('dragover');
    });

    this.elements.fileUploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      this.elements.fileUploadArea.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) this.handleFileSelect(file);
    });

    this.elements.contextFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.handleFileSelect(file);
    });

    this.elements.btnRemoveFile.addEventListener('click', () => this.removeFile());
  }

  updateUI() {
    // Update progress steps
    this.elements.progressSteps.forEach((step, index) => {
      const stepNum = index + 1;
      step.classList.remove('active', 'completed');

      if (stepNum < this.currentStep) {
        step.classList.add('completed');
      } else if (stepNum === this.currentStep) {
        step.classList.add('active');
      }
    });

    // Update progress lines
    this.elements.progressLines.forEach((line, index) => {
      if (index < this.currentStep - 1) {
        line.classList.add('completed');
      } else {
        line.classList.remove('completed');
      }
    });

    // Update step contents
    this.elements.stepContents.forEach((content) => {
      const stepNum = parseInt(content.dataset.step);
      content.classList.toggle('active', stepNum === this.currentStep);
    });

    // Update current step indicator
    this.elements.currentStepEl.textContent = this.currentStep;

    // Update navigation buttons
    this.elements.btnBack.classList.toggle('hidden', this.currentStep === 1);
    this.elements.btnNext.classList.toggle('hidden', this.currentStep === this.totalSteps);
    this.elements.btnFinish.classList.toggle('hidden', this.currentStep !== this.totalSteps);

    // Show skip button only on step 4 (optional)
    this.elements.btnSkip.classList.toggle('hidden', this.currentStep !== 4);
  }

  nextStep() {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.updateUI();
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateUI();
    }
  }

  skipStep() {
    if (this.currentStep === 4) {
      this.finish();
    }
  }

  updateLanguagePreview() {
    const preview = this.languagePreviews[this.settings.language] || this.languagePreviews.ru;
    this.elements.languagePreviewText.textContent = preview;
  }

  async requestMicrophoneAccess() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.settings.microphoneGranted = true;
      this.mediaStream = stream;

      // Update UI
      this.updateMicStatus('granted', 'Доступ предоставлен');
      this.elements.btnRequestMic.disabled = true;
      this.elements.btnRequestMic.innerHTML = '<span class="btn-icon">✓</span> Доступ получен';

      // Show device selection
      this.elements.micDeviceSelection.classList.remove('hidden');

      // Populate microphone list
      await this.populateMicrophoneList();

      // Start VU meter
      this.startVuMeter();
    } catch (err) {
      console.error('Microphone access denied:', err);
      this.updateMicStatus('denied', 'Доступ запрещён');
    }
  }

  updateMicStatus(status, text) {
    const statusIcon = this.elements.micStatus.querySelector('.status-icon');
    const statusText = this.elements.micStatus.querySelector('.status-text');

    statusIcon.className = 'status-icon ' + status;
    statusIcon.textContent = status === 'granted' ? '✓' : status === 'denied' ? '✕' : '○';
    statusText.textContent = text;
  }

  async populateMicrophoneList() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');

      this.elements.micSelect.innerHTML = '';
      audioInputs.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Микрофон ${index + 1}`;
        this.elements.micSelect.appendChild(option);
      });

      if (audioInputs.length > 0) {
        this.settings.microphoneId = audioInputs[0].deviceId;
      }
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
    }
  }

  startVuMeter(deviceId) {
    // Stop previous animation
    if (this.vuAnimationId) {
      cancelAnimationFrame(this.vuAnimationId);
    }

    // Create audio context
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (this.mediaStream) {
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const vuBars = this.elements.micVuMeter.querySelectorAll('.vu-bar');

      const updateVu = () => {
        this.analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        const level = Math.min(average / 128, 1);

        vuBars.forEach((bar, index) => {
          const threshold = (index + 1) / vuBars.length;
          bar.classList.remove('active', 'warning', 'danger');

          if (level >= threshold) {
            if (index >= vuBars.length - 2) {
              bar.classList.add('danger');
            } else if (index >= vuBars.length - 4) {
              bar.classList.add('warning');
            } else {
              bar.classList.add('active');
            }
          }
        });

        this.vuAnimationId = requestAnimationFrame(updateVu);
      };

      updateVu();
    }
  }

  async requestScreenAccess() {
    try {
      // В Electron используем desktopCapturer
      if (window.electronAPI && window.electronAPI.getDisplays) {
        const displays = await window.electronAPI.getDisplays();
        this.settings.screenGranted = true;

        // Update UI
        this.updateScreenStatus('granted', 'Доступ предоставлен');
        this.elements.btnRequestScreen.disabled = true;
        this.elements.btnRequestScreen.innerHTML = '<span class="btn-icon">✓</span> Доступ получен';

        // Show monitor selection
        this.elements.monitorSelection.classList.remove('hidden');
        this.populateMonitorGrid(displays);
      } else {
        // Fallback для браузера
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        stream.getTracks().forEach((track) => track.stop());

        this.settings.screenGranted = true;
        this.updateScreenStatus('granted', 'Доступ предоставлен');
        this.elements.btnRequestScreen.disabled = true;
        this.elements.btnRequestScreen.innerHTML = '<span class="btn-icon">✓</span> Доступ получен';
      }
    } catch (err) {
      console.error('Screen access denied:', err);
      this.updateScreenStatus('denied', 'Доступ запрещён');
    }
  }

  updateScreenStatus(status, text) {
    const statusIcon = this.elements.screenStatus.querySelector('.status-icon');
    const statusText = this.elements.screenStatus.querySelector('.status-text');

    statusIcon.className = 'status-icon ' + status;
    statusIcon.textContent = status === 'granted' ? '✓' : status === 'denied' ? '✕' : '○';
    statusText.textContent = text;
  }

  populateMonitorGrid(displays) {
    this.elements.monitorGrid.innerHTML = '';

    if (!displays || displays.length === 0) {
      // Fallback если нет данных о мониторах
      const card = document.createElement('div');
      card.className = 'monitor-card selected';
      card.innerHTML = `
                <div class="monitor-icon">🖥️</div>
                <div class="monitor-label">Основной экран</div>
            `;
      this.elements.monitorGrid.appendChild(card);
      this.settings.selectedMonitor = 'primary';
      return;
    }

    displays.forEach((display, index) => {
      const card = document.createElement('div');
      card.className = 'monitor-card' + (display.primary ? ' selected' : '');
      card.dataset.displayId = display.id;
      card.innerHTML = `
                <div class="monitor-icon">${display.primary ? '🖥️' : '🖵'}</div>
                <div class="monitor-label">${display.label || `Монитор ${index + 1}`}</div>
            `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.monitor-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        this.settings.selectedMonitor = display.id;
      });

      this.elements.monitorGrid.appendChild(card);

      if (display.primary) {
        this.settings.selectedMonitor = display.id;
      }
    });
  }

  handleFileSelect(file) {
    const validTypes = ['application/pdf', 'text/plain'];
    const validExtensions = ['.pdf', '.txt'];

    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validTypes.includes(file.type) && !validExtensions.includes(extension)) {
      alert('Пожалуйста, выберите файл формата PDF или TXT');
      return;
    }

    this.settings.contextFileName = file.name;
    this.settings.contextFilePath = file.path || file.name;

    // Update UI
    this.elements.fileUploadArea.classList.add('hidden');
    this.elements.fileInfo.classList.remove('hidden');
    this.elements.fileName.textContent = file.name;
    this.elements.fileSize.textContent = this.formatFileSize(file.size);
  }

  removeFile() {
    this.settings.contextFileName = null;
    this.settings.contextFilePath = null;

    this.elements.fileUploadArea.classList.remove('hidden');
    this.elements.fileInfo.classList.add('hidden');
    this.elements.contextFileInput.value = '';
  }

  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  async finish() {
    // Cleanup
    if (this.vuAnimationId) {
      cancelAnimationFrame(this.vuAnimationId);
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }

    // Save settings
    const onboardingSettings = {
      onboardingCompleted: true,
      language: this.settings.language,
      microphoneId: this.settings.microphoneId,
      selectedMonitor: this.settings.selectedMonitor,
      contextFilePath: this.settings.contextFilePath,
      contextFileName: this.settings.contextFileName,
    };

    // Save to localStorage (will be read by main app)
    localStorage.setItem('live-hints-onboarding', JSON.stringify(onboardingSettings));

    // Notify main process to open main window
    if (window.electronAPI && window.electronAPI.finishOnboarding) {
      await window.electronAPI.finishOnboarding(onboardingSettings);
    } else {
      // Fallback: просто закрываем окно
      window.close();
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new OnboardingApp();
});
