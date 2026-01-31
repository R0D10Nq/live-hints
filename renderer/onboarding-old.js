/**
 * Live Hints - Onboarding Process
 * Рефакторинг: использует модули из modules/onboarding/
 */

import { FileHandler } from './modules/onboarding/file-handler.js';
import { AudioSetup } from './modules/onboarding/audio-setup.js';

class OnboardingApp {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 4;
    this.settings = {
      profile: 'job_interview_ru',
      customPrompt: '',
      resumeContent: null,
      resumeFileName: null,
      vacancyContent: null,
      vacancyFileName: null,
      modeContext: '',
      microphoneId: null,
      microphoneIndex: null,
      microphoneGranted: false,
      dualAudioEnabled: false,
    };

    this.elements = this.cacheElements();
    this.fileHandler = new FileHandler(this);
    this.audioSetup = new AudioSetup(this);

    this.init();
  }

  cacheElements() {
    return {
      progressSteps: document.querySelectorAll('.progress-step'),
      progressLines: document.querySelectorAll('.progress-line'),
      currentStepEl: document.getElementById('current-step'),
      stepContents: document.querySelectorAll('.step-content'),
      btnBack: document.getElementById('btn-back'),
      btnNext: document.getElementById('btn-next'),
      btnSkip: document.getElementById('btn-skip'),
      btnFinish: document.getElementById('btn-finish'),
      btnMinimize: document.getElementById('btn-minimize'),
      btnClose: document.getElementById('btn-close'),
      modeCards: document.querySelectorAll('.mode-card'),
      modeContextArea: document.getElementById('mode-context-area'),
      modeContext: document.getElementById('mode-context'),
      customPromptArea: document.getElementById('custom-prompt-area'),
      customPrompt: document.getElementById('custom-prompt'),
      resumeUploadArea: document.getElementById('resume-upload-area'),
      resumeFileInput: document.getElementById('resume-file-input'),
      resumeFileInfo: document.getElementById('resume-file-info'),
      resumeFileName: document.getElementById('resume-file-name'),
      resumeFileSize: document.getElementById('resume-file-size'),
      btnRemoveResume: document.getElementById('btn-remove-resume'),
      btnPasteResume: document.getElementById('btn-paste-resume'),
      resumePasteArea: document.getElementById('resume-paste-area'),
      resumeText: document.getElementById('resume-text'),
      vacancyUploadArea: document.getElementById('vacancy-upload-area'),
      vacancyFileInput: document.getElementById('vacancy-file-input'),
      vacancyFileInfo: document.getElementById('vacancy-file-info'),
      vacancyFileName: document.getElementById('vacancy-file-name'),
      vacancyFileSize: document.getElementById('vacancy-file-size'),
      btnRemoveVacancy: document.getElementById('btn-remove-vacancy'),
      btnPasteVacancy: document.getElementById('btn-paste-vacancy'),
      vacancyPasteArea: document.getElementById('vacancy-paste-area'),
      vacancyText: document.getElementById('vacancy-text'),
      btnRequestMic: document.getElementById('btn-request-mic'),
      micStatus: document.getElementById('mic-status'),
      micDeviceSelection: document.getElementById('mic-device-selection'),
      micSelect: document.getElementById('mic-select'),
      micVuMeter: document.getElementById('mic-vu-meter'),
      dualAudioCheckbox: document.getElementById('dual-audio-checkbox'),
    };
  }

  init() {
    this.bindEvents();
    this.updateUI();
    this.updateResumeStep();
  }

  bindEvents() {
    this.elements.btnMinimize?.addEventListener('click', () =>
      window.electronAPI?.minimizeWindow()
    );
    this.elements.btnClose?.addEventListener('click', () => window.electronAPI?.closeWindow());

    this.elements.btnBack?.addEventListener('click', () => this.prevStep());
    this.elements.btnNext?.addEventListener('click', () => this.nextStep());
    this.elements.btnSkip?.addEventListener('click', () => this.skipStep());
    this.elements.btnFinish?.addEventListener('click', () => this.finish());

    // Mode cards event listeners
    this.elements.modeCards?.forEach((card) => {
      card.addEventListener('click', () => this.selectMode(card));
    });

    this.elements.modeContext?.addEventListener('input', (e) => {
      this.settings.modeContext = e.target.value;
    });

    // Custom prompt event listeners
    this.elements.customPrompt?.addEventListener('input', (e) => {
      this.settings.customPrompt = e.target.value;
    });

    this.fileHandler.setup('resume');
    this.fileHandler.setup('vacancy');

    this.elements.btnRequestMic?.addEventListener('click', () =>
      this.audioSetup.requestMicrophoneAccess()
    );
    this.elements.micSelect?.addEventListener('change', (e) => {
      this.settings.microphoneId = e.target.value;
      const selectedIndex = e.target.selectedIndex;
      this.settings.microphoneIndex = selectedIndex > 0 ? selectedIndex - 1 : null;
      this.audioSetup.startVuMeter(e.target.value);
    });

    this.elements.dualAudioCheckbox?.addEventListener('change', (e) => {
      this.settings.dualAudioEnabled = e.target.checked;
    });
  }

  updateUI() {
    this.elements.progressSteps.forEach((step, index) => {
      const stepNum = index + 1;
      step.classList.remove('active', 'completed');
      if (stepNum < this.currentStep) step.classList.add('completed');
      else if (stepNum === this.currentStep) step.classList.add('active');
    });

    this.elements.progressLines.forEach((line, index) => {
      line.classList.toggle('completed', index < this.currentStep - 1);
    });

    this.elements.stepContents.forEach((content) => {
      const stepNum = parseInt(content.dataset.step);
      content.classList.toggle('active', stepNum === this.currentStep);
    });

    if (this.elements.currentStepEl) {
      this.elements.currentStepEl.textContent = this.currentStep;
    }

    this.elements.btnBack?.classList.toggle('hidden', this.currentStep === 1);
    this.elements.btnNext?.classList.toggle('hidden', this.currentStep === this.totalSteps);
    this.elements.btnFinish?.classList.toggle('hidden', this.currentStep !== this.totalSteps);
    this.elements.btnSkip?.classList.toggle('hidden', this.currentStep !== 3);

    if (this.currentStep === 2) {
      // Блокируем кнопку только если резюме обязательно для текущего профиля
      const needsResume = this.settings.profile === 'job_interview_ru' || this.settings.profile === 'job_interview_en';
      const hasResume = this.settings.resumeContent && this.settings.resumeContent.trim().length > 0;
      const shouldDisable = needsResume && !hasResume;

      this.elements.btnNext?.classList.toggle('disabled', shouldDisable);
      if (this.elements.btnNext) this.elements.btnNext.disabled = shouldDisable;
    } else if (this.elements.btnNext) {
      this.elements.btnNext.disabled = false;
      this.elements.btnNext.classList.remove('disabled');
    }
  }

  nextStep() {
    if (this.currentStep === 2) {
      // Проверяем обязательность резюме только для профилей собеседования
      const needsResume = this.settings.profile === 'job_interview_ru' || this.settings.profile === 'job_interview_en';
      if (needsResume && (!this.settings.resumeContent || this.settings.resumeContent.trim().length === 0)) {
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
    if (this.currentStep === 3) {
      this.currentStep++;
      this.updateUI();
    }
  }

  showError(message) {
    alert(message);
  }

  selectMode(card) {
    this.elements.modeCards?.forEach((c) => {
      c.classList.remove('selected');
    });
    card.classList.add('selected');
    this.settings.profile = card.dataset.mode;

    // Показываем поле контекста для всех режимов кроме собеседования
    const needsContext = !['job_interview_ru', 'job_interview_en'].includes(this.settings.profile);
    this.elements.modeContextArea?.classList.toggle('hidden', !needsContext);

    // Показываем поле custom prompt для custom режима
    const isCustom = this.settings.profile === 'custom';
    this.elements.customPromptArea?.classList.toggle('hidden', !isCustom);

    // Обновляем текст и обязательность шага с резюме
    this.updateResumeStep();
  }

  updateResumeStep() {
    const resumeRequiredNote = document.getElementById('resume-required-note');
    const resumeOptionalNote = document.getElementById('resume-optional-note');
    const resumeStepDesc = document.getElementById('resume-step-desc');

    if (this.settings.profile === 'job_interview_ru' || this.settings.profile === 'job_interview_en') {
      // Для собеседования резюме обязательно
      resumeRequiredNote?.classList.remove('hidden');
      resumeOptionalNote?.classList.add('hidden');
      if (resumeStepDesc) {
        resumeStepDesc.textContent = 'Резюме поможет AI давать персонализированные ответы на основе вашего опыта';
      }
    } else {
      // Для других режимов резюме не обязательно
      resumeRequiredNote?.classList.add('hidden');
      resumeOptionalNote?.classList.remove('hidden');
      if (resumeStepDesc) {
        resumeStepDesc.textContent = 'Резюме может быть полезно для персонализации (необязательно)';
      }
    }
  }

  async finish() {
    this.audioSetup.cleanup();

    const onboardingSettings = {
      onboardingCompleted: true,
      profile: this.settings.profile,
      customPrompt: this.settings.customPrompt,
      contextFileContent: this.settings.resumeContent, // Сохраняем для совместимости
      modeContext: this.settings.modeContext, // Сохраняем контекст режима
      microphoneId: this.settings.microphoneId,
      inputDeviceIndex: this.settings.microphoneIndex,
      dualAudioEnabled: this.settings.dualAudioEnabled,
    };

    localStorage.setItem('live-hints-onboarding', JSON.stringify(onboardingSettings));

    const existingSettings = JSON.parse(localStorage.getItem('live-hints-settings') || '{}');
    const mergedSettings = {
      ...existingSettings,
      profile: this.settings.profile,
      customPrompt: this.settings.customPrompt,
      inputDeviceIndex: this.settings.microphoneIndex,
      dualAudioEnabled: this.settings.dualAudioEnabled,
    };
    localStorage.setItem('live-hints-settings', JSON.stringify(mergedSettings));

    try {
      if (this.settings.resumeContent && window.electronAPI?.saveContextFile) {
        await window.electronAPI.saveContextFile('resume', this.settings.resumeContent);
      }
      if (this.settings.vacancyContent && window.electronAPI?.saveContextFile) {
        await window.electronAPI.saveContextFile('vacancy', this.settings.vacancyContent);
      }
      if (this.settings.modeContext && window.electronAPI?.saveContextFile) {
        await window.electronAPI.saveContextFile('user_context', this.settings.modeContext);
      }
    } catch (err) {
      console.error('[Onboarding] Ошибка сохранения файлов:', err);
    }

    if (window.electronAPI?.finishOnboarding) {
      await window.electronAPI.finishOnboarding(onboardingSettings);
    } else {
      window.close();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new OnboardingApp();
});
