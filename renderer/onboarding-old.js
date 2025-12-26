// Live Hints - Onboarding Process (Redesigned)

class OnboardingApp {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 4;
    this.settings = {
      // Step 1: Profile
      profile: 'job_interview_ru',
      customPrompt: '',
      // Step 2: Resume
      resumeContent: null,
      resumeFileName: null,
      // Step 3: Vacancy
      vacancyContent: null,
      vacancyFileName: null,
      // Step 4: Audio
      microphoneId: null,
      microphoneIndex: null,
      microphoneGranted: false,
      dualAudioEnabled: false,
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

      // Step 1: Profile
      profileCards: document.getElementById('profile-cards'),
      customPromptArea: document.getElementById('custom-prompt-area'),
      customPrompt: document.getElementById('custom-prompt'),

      // Step 2: Resume
      resumeUploadArea: document.getElementById('resume-upload-area'),
      resumeFileInput: document.getElementById('resume-file-input'),
      resumeFileInfo: document.getElementById('resume-file-info'),
      resumeFileName: document.getElementById('resume-file-name'),
      resumeFileSize: document.getElementById('resume-file-size'),
      btnRemoveResume: document.getElementById('btn-remove-resume'),
      btnPasteResume: document.getElementById('btn-paste-resume'),
      resumePasteArea: document.getElementById('resume-paste-area'),
      resumeText: document.getElementById('resume-text'),

      // Step 3: Vacancy
      vacancyUploadArea: document.getElementById('vacancy-upload-area'),
      vacancyFileInput: document.getElementById('vacancy-file-input'),
      vacancyFileInfo: document.getElementById('vacancy-file-info'),
      vacancyFileName: document.getElementById('vacancy-file-name'),
      vacancyFileSize: document.getElementById('vacancy-file-size'),
      btnRemoveVacancy: document.getElementById('btn-remove-vacancy'),
      btnPasteVacancy: document.getElementById('btn-paste-vacancy'),
      vacancyPasteArea: document.getElementById('vacancy-paste-area'),
      vacancyText: document.getElementById('vacancy-text'),

      // Step 4: Audio
      btnRequestMic: document.getElementById('btn-request-mic'),
      micStatus: document.getElementById('mic-status'),
      micDeviceSelection: document.getElementById('mic-device-selection'),
      micSelect: document.getElementById('mic-select'),
      micVuMeter: document.getElementById('mic-vu-meter'),
      dualAudioCheckbox: document.getElementById('dual-audio-checkbox'),
    };

    this.init();
  }

  init() {
    this.bindEvents();
    this.updateUI();
  }

  bindEvents() {
    // Window controls
    this.elements.btnMinimize?.addEventListener('click', () => {
      window.electronAPI?.minimizeWindow();
    });

    this.elements.btnClose?.addEventListener('click', () => {
      window.electronAPI?.closeWindow();
    });

    // Navigation
    this.elements.btnBack?.addEventListener('click', () => this.prevStep());
    this.elements.btnNext?.addEventListener('click', () => this.nextStep());
    this.elements.btnSkip?.addEventListener('click', () => this.skipStep());
    this.elements.btnFinish?.addEventListener('click', () => this.finish());

    // Step 1: Profile cards
    this.elements.profileCards?.querySelectorAll('.profile-card').forEach((card) => {
      card.addEventListener('click', () => this.selectProfile(card));
    });

    this.elements.customPrompt?.addEventListener('input', (e) => {
      this.settings.customPrompt = e.target.value;
    });

    // Step 2: Resume
    this.setupFileUpload('resume');

    // Step 3: Vacancy
    this.setupFileUpload('vacancy');

    // Step 4: Audio
    this.elements.btnRequestMic?.addEventListener('click', () => this.requestMicrophoneAccess());
    this.elements.micSelect?.addEventListener('change', (e) => {
      this.settings.microphoneId = e.target.value;
      const selectedIndex = e.target.selectedIndex;
      this.settings.microphoneIndex = selectedIndex > 0 ? selectedIndex - 1 : null;
      this.startVuMeter(e.target.value);
    });

    this.elements.dualAudioCheckbox?.addEventListener('change', (e) => {
      this.settings.dualAudioEnabled = e.target.checked;
    });
  }

  setupFileUpload(type) {
    const uploadArea = this.elements[`${type}UploadArea`];
    const fileInput = this.elements[`${type}FileInput`];
    const btnPaste = this.elements[`btnPaste${type.charAt(0).toUpperCase() + type.slice(1)}`];
    const pasteArea = this.elements[`${type}PasteArea`];
    const textArea = this.elements[`${type}Text`];
    const btnRemove = this.elements[`btnRemove${type.charAt(0).toUpperCase() + type.slice(1)}`];

    uploadArea?.addEventListener('click', () => fileInput?.click());

    uploadArea?.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea?.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });

    uploadArea?.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) this.handleFileSelect(file, type);
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.handleFileSelect(file, type);
    });

    btnPaste?.addEventListener('click', () => {
      pasteArea?.classList.toggle('hidden');
      uploadArea?.classList.toggle('hidden', !pasteArea?.classList.contains('hidden'));
    });

    textArea?.addEventListener('input', (e) => {
      this.settings[`${type}Content`] = e.target.value || null;
    });

    btnRemove?.addEventListener('click', () => this.removeFile(type));
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
    if (this.elements.currentStepEl) {
      this.elements.currentStepEl.textContent = this.currentStep;
    }

    // Update navigation buttons
    this.elements.btnBack?.classList.toggle('hidden', this.currentStep === 1);
    this.elements.btnNext?.classList.toggle('hidden', this.currentStep === this.totalSteps);
    this.elements.btnFinish?.classList.toggle('hidden', this.currentStep !== this.totalSteps);

    // Show skip button on step 3 (vacancy is optional)
    this.elements.btnSkip?.classList.toggle('hidden', this.currentStep !== 3);

    // Disable Next on step 2 if no resume
    if (this.currentStep === 2) {
      const hasResume = this.settings.resumeContent && this.settings.resumeContent.trim().length > 0;
      this.elements.btnNext?.classList.toggle('disabled', !hasResume);
      if (this.elements.btnNext) {
        this.elements.btnNext.disabled = !hasResume;
      }
    } else if (this.elements.btnNext) {
      this.elements.btnNext.disabled = false;
      this.elements.btnNext.classList.remove('disabled');
    }
  }

  nextStep() {
    // Validate step 2 (resume required)
    if (this.currentStep === 2) {
      if (!this.settings.resumeContent || this.settings.resumeContent.trim().length === 0) {
        this.showError('Загрузите резюме для продолжения');
        return;
      }
    }

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
    // Step 3 (vacancy) is skippable
    if (this.currentStep === 3) {
      this.currentStep++;
      this.updateUI();
    }
  }

  showError(message) {
    // Simple alert for now
    alert(message);
  }

  selectProfile(card) {
    // Remove selection from all cards
    this.elements.profileCards?.querySelectorAll('.profile-card').forEach((c) => {
      c.classList.remove('selected');
    });

    // Select clicked card
    card.classList.add('selected');
    this.settings.profile = card.dataset.profile;

    // Show/hide custom prompt area
    const isCustom = this.settings.profile === 'custom';
    this.elements.customPromptArea?.classList.toggle('hidden', !isCustom);
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

  async handleFileSelect(file, type) {
    const validExtensions = type === 'resume'
      ? ['.pdf', '.txt', '.docx']
      : ['.pdf', '.txt'];

    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(extension)) {
      this.showError(`Поддерживаемые форматы: ${validExtensions.join(', ')}`);
      return;
    }

    // Читаем содержимое файла
    try {
      let content = '';

      if (extension === '.txt') {
        content = await this.readTextFile(file);
        console.log(`[Onboarding] Загружен TXT: ${content.length} символов`);
      } else if (extension === '.pdf') {
        // PDF через Electron API
        if (window.electronAPI?.parseFile) {
          content = await window.electronAPI.parseFile(file.path, 'pdf');
          console.log(`[Onboarding] Загружен PDF: ${content.length} символов`);
        } else {
          this.showError('Парсинг PDF недоступен');
          return;
        }
      } else if (extension === '.docx') {
        // DOCX через Electron API
        if (window.electronAPI?.parseFile) {
          content = await window.electronAPI.parseFile(file.path, 'docx');
          console.log(`[Onboarding] Загружен DOCX: ${content.length} символов`);
        } else {
          this.showError('Парсинг DOCX недоступен');
          return;
        }
      }

      // Сохраняем контент
      this.settings[`${type}Content`] = content;
      this.settings[`${type}FileName`] = file.name;

      // Update UI
      const uploadArea = this.elements[`${type}UploadArea`];
      const fileInfo = this.elements[`${type}FileInfo`];
      const fileName = this.elements[`${type}FileName`];
      const fileSize = this.elements[`${type}FileSize`];

      uploadArea?.classList.add('hidden');
      fileInfo?.classList.remove('hidden');
      if (fileName) fileName.textContent = file.name;
      if (fileSize) fileSize.textContent = this.formatFileSize(file.size);

      // Update validation
      this.updateUI();

    } catch (err) {
      console.error('[Onboarding] Ошибка чтения файла:', err);
      this.showError('Ошибка чтения файла: ' + err.message);
    }
  }

  readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file, 'utf-8');
    });
  }

  removeFile(type) {
    this.settings[`${type}Content`] = null;
    this.settings[`${type}FileName`] = null;

    const uploadArea = this.elements[`${type}UploadArea`];
    const fileInfo = this.elements[`${type}FileInfo`];
    const fileInput = this.elements[`${type}FileInput`];
    const pasteArea = this.elements[`${type}PasteArea`];

    uploadArea?.classList.remove('hidden');
    fileInfo?.classList.add('hidden');
    pasteArea?.classList.add('hidden');
    if (fileInput) fileInput.value = '';

    this.updateUI();
  }

  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  async finish() {
    // Cleanup audio
    if (this.vuAnimationId) {
      cancelAnimationFrame(this.vuAnimationId);
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }

    // Prepare settings
    const onboardingSettings = {
      onboardingCompleted: true,
      // Profile
      profile: this.settings.profile,
      customPrompt: this.settings.customPrompt,
      // Audio
      microphoneId: this.settings.microphoneId,
      inputDeviceIndex: this.settings.microphoneIndex,
      dualAudioEnabled: this.settings.dualAudioEnabled,
    };

    // Save to localStorage
    localStorage.setItem('live-hints-onboarding', JSON.stringify(onboardingSettings));

    // Also update main settings
    const existingSettings = JSON.parse(localStorage.getItem('live-hints-settings') || '{}');
    const mergedSettings = {
      ...existingSettings,
      profile: this.settings.profile,
      customPrompt: this.settings.customPrompt,
      inputDeviceIndex: this.settings.microphoneIndex,
      dualAudioEnabled: this.settings.dualAudioEnabled,
    };
    localStorage.setItem('live-hints-settings', JSON.stringify(mergedSettings));

    // Save resume and vacancy files via IPC
    try {
      if (this.settings.resumeContent && window.electronAPI?.saveContextFile) {
        await window.electronAPI.saveContextFile('resume', this.settings.resumeContent);
        console.log('[Onboarding] Резюме сохранено');
      }

      if (this.settings.vacancyContent && window.electronAPI?.saveContextFile) {
        await window.electronAPI.saveContextFile('vacancy', this.settings.vacancyContent);
        console.log('[Onboarding] Вакансия сохранена');
      }
    } catch (err) {
      console.error('[Onboarding] Ошибка сохранения файлов:', err);
    }

    // Notify main process to open main window
    if (window.electronAPI?.finishOnboarding) {
      await window.electronAPI.finishOnboarding(onboardingSettings);
    } else {
      window.close();
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new OnboardingApp();
});
