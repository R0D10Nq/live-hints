/**
 * Live Hints Onboarding — Adaptive Wizard
 * Шаги динамически меняются в зависимости от выбранного режима
 */

// Конфигурация режимов и их обязательных/опциональных шагов
const MODE_CONFIG = {
  job_interview_ru: {
    name: 'Собеседование',
    icon: '🎯',
    requiredSteps: [1, 2, 3, 4], // Все шаги
    optionalAfterUpload: [3], // Вакансия опциональна после загрузки резюме
    needsResume: true, // Резюме обязательно
    needsVacancy: false, // Вакансия опциональна
    badgeText: 'Шаг {n} из 4',
  },
  business_meeting: {
    name: 'Переговоры',
    icon: '🤝',
    requiredSteps: [1, 2], // Только сценарий + контекст
    optionalAfterUpload: [],
    needsResume: false,
    needsVacancy: false,
    badgeText: 'Шаг {n} из 2',
  },
  daily_sync: {
    name: 'Созвоны',
    icon: '📞',
    requiredSteps: [1, 2], // Только сценарий + контекст
    optionalAfterUpload: [],
    needsResume: false,
    needsVacancy: false,
    badgeText: 'Шаг {n} из 2',
  },
  presentation: {
    name: 'Презентация',
    icon: '📊',
    requiredSteps: [1, 3, 4], // Сценарий + контекст + аудио
    optionalAfterUpload: [],
    needsResume: false,
    needsVacancy: true,
    badgeText: 'Шаг {n} из 3',
  },
  custom: {
    name: 'Свой сценарий',
    icon: '⚙️',
    requiredSteps: [1, 2], // Сценарий + контекст
    optionalAfterUpload: [],
    needsResume: false,
    needsVacancy: false,
    badgeText: 'Шаг {n} из 2',
  },
};

class OnboardingController {
  constructor() {
    this.currentStep = 1;
    this.selectedMode = null;
    this.hasResume = false;
    this.hasVacancy = false;

    // Кэш DOM
    this.els = {};
    this.init();
  }

  init() {
    this.cacheDOM();
    this.bindEvents();
    this.renderStepIndicator();
    this.renderStep();
    this.updateNav();
  }

  cacheDOM() {
    this.els.stepIndicator = document.getElementById('stepIndicator');
    this.els.stepCard = document.getElementById('stepCard');
    this.els.btnBack = document.getElementById('btnBack');
    this.els.btnNext = document.getElementById('btnNext');
    this.els.btnFinish = document.getElementById('btnFinish');
    this.els.btnSkip = document.getElementById('btnSkip');
    this.els.curStep = document.getElementById('curStep');
    this.els.totalSteps = document.getElementById('totalSteps');
  }

  bindEvents() {
    // Навигация
    this.els.btnBack.addEventListener('click', () => this.prevStep());
    this.els.btnNext.addEventListener('click', () => this.nextStep());
    this.els.btnFinish.addEventListener('click', () => this.finish());
    this.els.btnSkip.addEventListener('click', () => this.nextStep());

    // Управление окном
    document.getElementById('btnMin').addEventListener('click', () => {
      window.electron?.minimizeWindow?.();
    });
    document.getElementById('btnClose').addEventListener('click', () => {
      window.electron?.closeWindow?.();
    });

    // Клавиатура
    document.addEventListener('keydown', (e) => {
      const tag = e.target?.tagName || '';
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === 'Enter') this.nextStep();
      else if (e.key === 'ArrowLeft') this.prevStep();
    });
  }

  // ---- RENDERING STEP INDICATOR ----
  renderStepIndicator() {
    const total = MODE_CONFIG[this.selectedMode]?.requiredSteps?.length || 2;
    this.els.totalSteps.textContent = total;

    this.els.stepIndicator.innerHTML = '';
    for (let i = 1; i <= total; i++) {
      const dot = document.createElement('div');
      dot.className = 'step-dot';
      if (i === this.currentStep) dot.classList.add('active');
      else if (i < this.currentStep) dot.classList.add('done');

      dot.innerHTML = `
        <div class="dot-num">${i < this.currentStep ? '✓' : i}</div>
        ${this.getStepLabel(i)}
      `;
      this.els.stepIndicator.appendChild(dot);
    }
  }

  getStepLabel(step) {
    const labels = ['Сценарий', 'Контекст/Резюме', 'Вакансия', 'Аудио'];
    return `<span class="step-label">${labels[step - 1] || step}</span>`;
  }

  // ---- RENDER STEP CONTENT ----
  renderStep() {
    const steps = this.getSteps();
    if (this.currentStep > steps.length) {
      this.renderFinish();
      return;
    }

    const config = MODE_CONFIG['job_interview_ru'] || MODE_CONFIG.business_meeting; // fallback
    const total = config.requiredSteps?.length || 3;

    const badge = `Шаг ${this.currentStep} из ${total}`;
    this.els.curStep.textContent = this.currentStep;

    switch (this.currentStep) {
      case 1:
        return this.renderModeSelection();
      case 2:
        return this.selectedMode === 'job_interview_ru'
          ? this.renderResume()
          : this.renderContext();
      case 3:
        if (this.shouldShowVacancy()) return this.renderVacancy();
        // Если вакансия не нужна, пропускаем на шаг 4 или finish
        if (this.currentStep < total) {
          this.nextStep();
          return;
        }
        throw new Error('Invalid step');
      case 4:
        return this.renderAudio();
      default:
        return this.renderFinish();
    }
  }

  getSteps() {
    const cfg = MODE_CONFIG[this.selectedMode];
    if (!cfg) return [1, 2, 3, 4]; // fallback to all steps
    return cfg.requiredSteps;
  }

  shouldShowVacancy() {
    return this.selectedMode === 'presentation' || (this.hasResume && Math.random() > 0.5); // optional для остальных
  }

  renderModeSelection() {
    const modes = Object.entries(MODE_CONFIG)
      .map(
        ([id, cfg]) => `
      <div class="mode-card ${this.selectedMode === id ? 'sel' : ''}" data-mode="${id}">
        <div class="mode-icon">${cfg.icon}</div>
        <div class="mode-name">${cfg.name}</div>
        <div class="mode-desc">${
          cfg.name === 'job_interview_ru'
            ? 'Технические вопросы и ответы по вашему опыту'
            : cfg.name === 'business_meeting'
              ? 'Аргументы и контраргументы для встреч'
              : cfg.name === 'daily_sync'
                ? 'Краткие статусы и обсуждение задач'
                : cfg.name === 'presentation'
                  ? 'Убедительные питчи и демонстрации'
                  : 'Полностью кастомные инструкции'
        }</div>
      </div>
    `
      )
      .join('');

    this.els.stepCard.innerHTML = `
      <div class="badge">Шаг 1 из 4</div>
      <h2>Выберите сценарий</h2>
      <p class="subtitle">AI подстроит стиль подсказок под вашу ситуацию</p>
      <div class="mode-grid">${modes}</div>
    `;

    // Bind mode selection
    this.els.stepCard.querySelectorAll('.mode-card').forEach((card) => {
      card.addEventListener('click', () => this.selectMode(card));
    });
  }

  selectMode(card) {
    const id = card.dataset.mode;
    this.selectedMode = id;

    // Update visual state
    document.querySelectorAll('.mode-card').forEach((c) => c.classList.remove('sel'));
    card.classList.add('sel');

    // Re-render indicator with new step count
    this.renderStepIndicator();
  }

  renderResume() {
    const hasText = !!document.querySelector('#resumeInput')?.value;
    const nextDisabled = !this.hasResume && !hasText;

    this.els.btnNext.disabled = nextDisabled;

    if (!this.hasResume) {
      this.els.stepCard.innerHTML = `
        <div class="badge">Шаг 2 из 4 — Резюме (обязательно)</div>
        <h2>Загрузите резюме</h2>
        <p class="subtitle">AI будет опираться на ваш опыт при формулировке ответов. 
           Для режима "Собеседование" это обязательно.</p>

        <div class="upload-zone" id="resumeDrop">
          <div class="upload-icon">📄</div>
          <div class="upload-title">Перетащите файл или нажмите для выбора</div>
          <div class="upload-hint">PDF, DOCX, TXT — до 10MB</div>
        </div>
        <input type="file" id="resumeInput" accept=".txt,.pdf,.docx" multiple>

        <button class="meta-link" id="toggleResumeText">Или вставить текст вручную</button>
        <textarea class="text-input hidden" id="resumeTextarea" rows="6" 
                  placeholder="Вставьте текст резюме..."></textarea>

        <div id="resumeResult" class="hidden" style="margin-top:12px;padding:12px;background:var(--success);border-radius:8px;color:white;font-size:13px;"></div>
      `;

      const drop = document.getElementById('resumeDrop');
      const input = document.getElementById('resumeInput');
      const toggleBtn = document.getElementById('toggleResumeText');
      const textarea = document.getElementById('resumeTextarea');

      drop.addEventListener('click', () => input.click());
      input.addEventListener('change', (e) => this.handleFile(e, 'resume'));

      toggleBtn.addEventListener('click', () => {
        textarea.classList.toggle('hidden');
        drop.classList.toggle('hidden');
        toggleBtn.textContent = textarea.classList.contains('hidden')
          ? 'Или вставить текст вручную'
          : 'Скрыть текстовое поле';
      });

      textarea.addEventListener('input', () => {
        this.els.btnNext.disabled = !textarea.value.trim();
      });
    } else {
      this.els.stepCard.innerHTML = `
        <div class="badge">Шаг 2 из 4 — Резюме (загружено)</div>
        <h2>Резюме уже загружено</h2>
        <p class="subtitle">Ваше резюме сохранено и будет использоваться для подсказок.</p>
        <div id="resumeResult" style="margin-top:12px;padding:12px;background:var(--success);border-radius:8px;color:white;font-size:13px;">✓ Резюме активно</div>
      `;
    }
  }

  handleFile(e, type) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'resume') this.hasResume = true;
    else if (type === 'vacancy') this.hasVacancy = true;

    const resultId = type + 'Result';
    const result = document.getElementById(resultId);
    if (result) {
      result.textContent = `✓ ${file.name} загружен`;
      result.classList.remove('hidden');
    }

    this.els.btnNext.disabled = false;
  }

  renderContext() {
    this.els.stepCard.innerHTML = `
      <div class="badge">Шаг 2 — Контекст</div>
      <h2>Дополнительный контекст</h2>
      <p class="subtitle">Опишите ситуацию: роль, проект, команда, ключевые моменты. 
         Это поможет AI давать более точные подсказки.</p>

      <textarea class="text-input" id="contextTextarea" rows="6"
                placeholder="Например: Я frontend-разработчик с 5-летним опытом, работаю над проектом X, ожидаю технических вопросов по React и TypeScript..."></textarea>

      ${
        this.selectedMode === 'custom'
          ? `
        <div style="margin-top:12px;">
          <button class="meta-link" id="saveContextBtn">Сохранить контекст</button>
        </div>
      `
          : ''
      }
    `;

    const textarea = document.getElementById('contextTextarea');
    this.els.btnNext.disabled = false; // context is never required (optional)
  }

  renderVacancy() {
    const hasText = !!document.querySelector('#vacancyInput')?.value;

    this.els.stepCard.innerHTML = `
      <div class="badge">Шаг ${this.currentStep} — Вакансия</div>
      <h2>Описание вакансии</h2>
      <p class="subtitle">Загрузите текст или PDF с описанием позиции. 
         AI подстроит акценты под требования работодателя.</p>

      <div class="upload-zone" id="vacancyDrop">
        <div class="upgrade-icon">☁️</div>
        <div class="upload-title">Загрузить вакансию (PDF/TXT)</div>
      </div>
      <input type="file" id="vacancyInput" accept=".txt,.pdf" multiple>

      <button class "meta-link" id="toggleVacancyText">Или вставить текст вручную</button>
      <textarea class="text-input hidden" id="vacancyTextarea" rows="5" 
                placeholder="Вставьте описание вакансии..."></textarea>
    `;

    const drop = document.getElementById('vacancyDrop');
    const input = document.getElementById('vacancyInput');
    const toggleBtn = document.getElementById('toggleVacancyText');
    const textarea = document.getElementById('vacancyTextarea');

    drop.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => this.handleFile(e, 'vacancy'));

    toggleBtn.addEventListener('click', () => {
      textarea.classList.toggle('hidden');
      drop.classList.toggle('hidden');
      toggleBtn.textContent = 'Скрыть текстовое поле';
    });

    // Vacancy is optional - always allows next
    this.els.btnNext.disabled = false;
  }

  renderAudio() {
    this.els.stepCard.innerHTML = `
      <div class="badge">Шаг ${this.currentStep} — Аудио</div>
      <h2>Настройка микрофона</h2>
      <p class="subtitle">Выберите устройство для захвата голоса перед началом сессии</p>

      <select class="form-select" id="micSelect">
        <option value="">Загрузка устройств...</option>
      </select>

      <div class="audio-visualizer" id="viz">
        ${Array(16)
          .fill(0)
          .map(() => `<div class="wave"></div>`)
          .join('')}
      </div>

      <button class="btn btn-primary" id="testMic" style="width:100%">
        ▶ Тест микрофона
      </button>
    `;

    this.loadMicrophones();

    document.getElementById('testMic').addEventListener('click', () => {
      const select = document.getElementById('micSelect');
      if (!select.value) return alert('Сначала выберите микрофон');

      // Simple visual feedback
      document.getElementById('viz').style.animation = 'pulse 0.5s';
      setTimeout(() => (document.getElementById('viz').style.animation = ''), 500);
    });

    this.els.btnNext.disabled = false;
  }

  async loadMicrophones() {
    const select = document.getElementById('micSelect');
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((d) => d.kind === 'audioinput');

      select.innerHTML = '<option value="">Выберите микрофон...</option>';
      mics.forEach((mic) => {
        const opt = document.createElement('option');
        opt.value = mic.deviceId;
        opt.textContent = mic.label || `Микрофон ${select.options.length}`;
        select.appendChild(opt);
      });
    } catch (err) {
      select.innerHTML = '<option>Нет доступа к микрофону</option>';
    }
  }

  renderFinish() {
    this.els.stepCard.innerHTML = `
      <div style="text-align:center;padding:40px;">
        <div style="font-size:64px;margin-bottom:20px;">🎉</div>
        <h2 style="margin-bottom:12px;">Всё готово!</h2>
        <p class="subtitle">
          Режим: ${
            this.selectedMode === 'job_interview_ru'
              ? 'Собеседование'
              : this.selectedMode || 'Не выбран'
          }<br>
          Аудио захват будет активен с начала разговора.
        </p>
      </div>
    `;
  }

  // ---- NAVIGATION ──
  nextStep() {
    const steps = this.getSteps();
    if (this.currentStep >= steps.length) return;

    this.currentStep++;
    this.renderStep();
    this.updateNav();
  }

  prevStep() {
    if (this.currentStep <= 1) return;
    this.currentStep--;
    this.renderStep();
    this.updateNav();
  }

  updateNav() {
    const steps = this.getSteps();
    const isLast = this.currentStep === steps.length;

    this.els.btnBack.classList.toggle('hidden', this.currentStep === 1);
    this.els.btnNext.classList.toggle('hidden', isLast);
    this.els.btnFinish.classList.toggle('hidden', !isLast);
    this.els.btnSkip.classList.toggle('hidden', true); // skip not allowed in this version

    if (this.els.curStep) this.els.curStep.textContent = this.currentStep;
  }

  async finish() {
    const settings = {
      mode: this.selectedMode,
      timestamp: Date.now(),
    };

    this.els.btnFinish.disabled = true;
    this.els.btnFinish.textContent = 'Запуск...';

    try {
      await window.electron?.finishOnboarding(settings);
      console.log('[Onboarding] Complete:', settings);
    } catch (err) {
      alert('Ошибка: ' + err.message);
      this.els.btnFinish.disabled = false;
      this.els.btnFinish.textContent = 'Запустить ✓';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new OnboardingController());
