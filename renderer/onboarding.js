/**
 * Live Hints Onboarding — Adaptive Wizard
 * Шаги динамически меняются в зависимости от выбранного режима.
 * Каждый шаг определяется типом (mode, resume, context, vacancy, audio),
 * а не порядковым номером — это исключает рассогласование навигации.
 */

const ICONS = {
  interview:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  meeting:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  call: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  presentation:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  custom:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
  resume:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  vacancy:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  finish:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  check:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
};

const MODE_CONFIG = {
  job_interview_ru: {
    name: 'Собеседование',
    icon: ICONS.interview,
    description: 'Технические вопросы и ответы по вашему опыту',
    steps: ['mode', 'resume', 'vacancy', 'audio'],
  },
  business_meeting: {
    name: 'Переговоры',
    icon: ICONS.meeting,
    description: 'Аргументы и контраргументы для встреч',
    steps: ['mode', 'context'],
  },
  daily_sync: {
    name: 'Созвоны',
    icon: ICONS.call,
    description: 'Краткие статусы и обсуждение задач',
    steps: ['mode', 'context'],
  },
  presentation: {
    name: 'Презентация',
    icon: ICONS.presentation,
    description: 'Убедительные питчи и демонстрации',
    steps: ['mode', 'context', 'audio'],
  },
  custom: {
    name: 'Свой сценарий',
    icon: ICONS.custom,
    description: 'Полностью кастомные инструкции',
    steps: ['mode', 'context'],
  },
};

const STEP_LABELS = {
  mode: 'Сценарий',
  resume: 'Резюме',
  context: 'Контекст',
  vacancy: 'Вакансия',
  audio: 'Аудио',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

class OnboardingController {
  constructor() {
    this.stepIndex = 0;
    this.selectedMode = null;

    // Накопленные данные пользователя
    this.resumeText = '';
    this.contextText = '';
    this.vacancyText = '';
    this.selectedMic = '';

    // Состояние теста микрофона
    this._micStream = null;
    this._micCtx = null;
    this._testingMic = false;

    this.els = {};
    this.init();
  }

  // -- Вычисляемые свойства навигации --

  get steps() {
    if (!this.selectedMode) return ['mode'];
    return MODE_CONFIG[this.selectedMode].steps;
  }

  get totalSteps() {
    return this.steps.length;
  }

  get currentType() {
    return this.steps[this.stepIndex] || 'mode';
  }

  get isLastStep() {
    return this.stepIndex >= this.totalSteps - 1;
  }

  // -- Инициализация --

  init() {
    this.cacheDOM();
    this.bindEvents();
    this.render();
  }

  cacheDOM() {
    this.els.indicator = document.getElementById('stepIndicator');
    this.els.card = document.getElementById('stepCard');
    this.els.btnBack = document.getElementById('btnBack');
    this.els.btnNext = document.getElementById('btnNext');
    this.els.btnFinish = document.getElementById('btnFinish');
    this.els.btnSkip = document.getElementById('btnSkip');
    this.els.curStep = document.getElementById('curStep');
    this.els.totalSteps = document.getElementById('totalSteps');
  }

  bindEvents() {
    this.els.btnBack.addEventListener('click', () => this.prevStep());
    this.els.btnNext.addEventListener('click', () => this.nextStep());
    this.els.btnFinish.addEventListener('click', () => this.finish());
    this.els.btnSkip.addEventListener('click', () => this.nextStep());

    document.getElementById('btnMin').addEventListener('click', () => {
      window.electron?.minimizeWindow?.();
    });
    document.getElementById('btnClose').addEventListener('click', () => {
      window.electron?.closeWindow?.();
    });

    document.addEventListener('keydown', (e) => {
      const tag = e.target?.tagName || '';
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') {
        return;
      }
      if (e.key === 'Enter' && !this.els.btnNext.disabled) {
        this.nextStep();
      } else if (e.key === 'ArrowLeft') {
        this.prevStep();
      }
    });
  }

  // -- Сбор данных текущего шага перед уходом --

  collectCurrentStepData() {
    switch (this.currentType) {
      case 'resume': {
        const ta = document.getElementById('resumeTextarea');
        if (ta && ta.value.trim()) this.resumeText = ta.value.trim();
        break;
      }
      case 'context': {
        const ta = document.getElementById('contextTextarea');
        if (ta && ta.value.trim()) this.contextText = ta.value.trim();
        break;
      }
      case 'vacancy': {
        const ta = document.getElementById('vacancyTextarea');
        if (ta && ta.value.trim()) this.vacancyText = ta.value.trim();
        break;
      }
      case 'audio': {
        const sel = document.getElementById('micSelect');
        if (sel && sel.value) this.selectedMic = sel.value;
        break;
      }
    }
  }

  // -- Отрисовка --

  render() {
    this.stopMicTest();
    this.renderIndicator();
    this.renderContent();
    this.updateNav();
  }

  renderIndicator() {
    const total = this.totalSteps;
    this.els.totalSteps.textContent = total;
    this.els.curStep.textContent = this.stepIndex + 1;

    this.els.indicator.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('div');
      dot.className = 'step-dot';
      if (i === this.stepIndex) dot.classList.add('active');
      else if (i < this.stepIndex) dot.classList.add('done');

      const label = STEP_LABELS[this.steps[i]] || '';
      dot.innerHTML = `
        <div class="dot-num">${i < this.stepIndex ? ICONS.check : i + 1}</div>
        <span class="step-label">${label}</span>
      `;
      this.els.indicator.appendChild(dot);
    }
  }

  renderContent() {
    switch (this.currentType) {
      case 'mode':
        return this.renderModeSelection();
      case 'resume':
        return this.renderResume();
      case 'context':
        return this.renderContext();
      case 'vacancy':
        return this.renderVacancy();
      case 'audio':
        return this.renderAudio();
      default:
        return this.renderFinishScreen();
    }
  }

  // -- Шаг: Выбор сценария --

  renderModeSelection() {
    const modes = Object.entries(MODE_CONFIG)
      .map(
        ([id, cfg]) => `
      <div class="mode-card ${this.selectedMode === id ? 'sel' : ''}"
           data-mode="${id}">
        <div class="mode-icon">${cfg.icon}</div>
        <div class="mode-name">${cfg.name}</div>
        <div class="mode-desc">${cfg.description}</div>
      </div>
    `
      )
      .join('');

    this.els.card.innerHTML = `
      <div class="badge">Шаг 1 из ${this.totalSteps}</div>
      <h2>Выберите сценарий</h2>
      <p class="subtitle">
        AI подстроит стиль подсказок под вашу ситуацию
      </p>
      <div class="mode-grid">${modes}</div>
    `;

    this.els.btnNext.disabled = !this.selectedMode;

    this.els.card.querySelectorAll('.mode-card').forEach((card) => {
      card.addEventListener('click', () => this.selectMode(card));
    });
  }

  selectMode(card) {
    this.selectedMode = card.dataset.mode;

    document.querySelectorAll('.mode-card').forEach((c) => c.classList.remove('sel'));
    card.classList.add('sel');

    this.els.btnNext.disabled = false;
    this.renderIndicator();
    this.updateNav();
  }

  // -- Шаг: Загрузка резюме --

  renderResume() {
    const stepNum = this.stepIndex + 1;
    this.els.card.innerHTML = `
      <div class="badge">Шаг ${stepNum} из ${this.totalSteps}</div>
      <h2>Загрузите резюме</h2>
      <p class="subtitle">
        AI будет опираться на ваш опыт при формулировке ответов.
      </p>

      <div class="upload-zone" id="resumeDrop">
        <div class="upload-icon">${ICONS.resume}</div>
        <div class="upload-title">
          Перетащите файл или нажмите для выбора
        </div>
        <div class="upload-hint">PDF, DOCX, TXT — до 10 МБ</div>
      </div>
      <input type="file" id="resumeInput"
             accept=".txt,.pdf,.docx">

      <button class="meta-link" id="toggleResumeText">
        Или вставить текст вручную
      </button>
      <textarea class="text-input hidden" id="resumeTextarea"
                rows="6"
                placeholder="Вставьте текст резюме..."
      >${this.escapeHtml(this.resumeText)}</textarea>

      <div id="resumeResult" class="hidden"
           style="margin-top:12px;padding:12px;
                  background:var(--success);border-radius:8px;
                  color:white;font-size:13px;"></div>
    `;

    if (this.resumeText) {
      this.showUploadResult(
        'resumeResult',
        'Резюме загружено (' + this.resumeText.length + ' символов)'
      );
    }

    const drop = document.getElementById('resumeDrop');
    const input = document.getElementById('resumeInput');
    const toggle = document.getElementById('toggleResumeText');
    const textarea = document.getElementById('resumeTextarea');

    drop.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => this.handleFileUpload(e.target.files[0], 'resume'));

    this.setupDragDrop(drop, input);

    toggle.addEventListener('click', () => {
      textarea.classList.toggle('hidden');
      drop.classList.toggle('hidden');
      toggle.textContent = textarea.classList.contains('hidden')
        ? 'Или вставить текст вручную'
        : 'Загрузить файл';
    });

    textarea.addEventListener('input', () => {
      this.els.btnNext.disabled = false;
    });

    this.els.btnNext.disabled = !this.resumeText;
    this.els.btnSkip.classList.remove('hidden');
  }

  // -- Шаг: Контекст --

  renderContext() {
    const stepNum = this.stepIndex + 1;
    this.els.card.innerHTML = `
      <div class="badge">Шаг ${stepNum} из ${this.totalSteps}</div>
      <h2>Дополнительный контекст</h2>
      <p class="subtitle">
        Опишите тему встречи, проект или специфику обсуждения.
      </p>

      <textarea class="text-input" id="contextTextarea"
                rows="6"
                placeholder="Например: Обсуждаем квартальный отчёт, основные метрики — MRR и Churn..."
      >${this.escapeHtml(this.contextText)}</textarea>
    `;

    this.els.btnNext.disabled = false;
  }

  // -- Шаг: Вакансия --

  renderVacancy() {
    const stepNum = this.stepIndex + 1;
    this.els.card.innerHTML = `
      <div class="badge">
        Шаг ${stepNum} из ${this.totalSteps} — необязательно
      </div>
      <h2>Описание вакансии</h2>
      <p class="subtitle">
        Загрузите текст или PDF с описанием позиции.
        AI подстроит акценты под требования работодателя.
      </p>

      <div class="upload-zone" id="vacancyDrop">
        <div class="upload-icon">${ICONS.vacancy}</div>
        <div class="upload-title">
          Загрузить вакансию (PDF / TXT)
        </div>
      </div>
      <input type="file" id="vacancyInput" accept=".txt,.pdf">

      <button class="meta-link" id="toggleVacancyText">
        Или вставить текст вручную
      </button>
      <textarea class="text-input hidden" id="vacancyTextarea"
                rows="5"
                placeholder="Вставьте описание вакансии..."
      >${this.escapeHtml(this.vacancyText)}</textarea>

      <div id="vacancyResult" class="hidden"
           style="margin-top:12px;padding:12px;
                  background:var(--success);border-radius:8px;
                  color:white;font-size:13px;"></div>
    `;

    if (this.vacancyText) {
      this.showUploadResult(
        'vacancyResult',
        'Вакансия загружена (' + this.vacancyText.length + ' символов)'
      );
    }

    const drop = document.getElementById('vacancyDrop');
    const input = document.getElementById('vacancyInput');
    const toggle = document.getElementById('toggleVacancyText');
    const textarea = document.getElementById('vacancyTextarea');

    drop.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => this.handleFileUpload(e.target.files[0], 'vacancy'));

    this.setupDragDrop(drop, input);

    toggle.addEventListener('click', () => {
      textarea.classList.toggle('hidden');
      drop.classList.toggle('hidden');
      toggle.textContent = textarea.classList.contains('hidden')
        ? 'Или вставить текст вручную'
        : 'Загрузить файл';
    });

    this.els.btnNext.disabled = false;
    this.els.btnSkip.classList.remove('hidden');
  }

  // -- Шаг: Аудио --

  renderAudio() {
    const stepNum = this.stepIndex + 1;
    this.els.card.innerHTML = `
      <div class="badge">Шаг ${stepNum} из ${this.totalSteps}</div>
      <h2>Настройка микрофона</h2>
      <p class="subtitle">
        Выберите устройство для захвата голоса и проверьте звук
      </p>

      <select class="form-select" id="micSelect">
        <option value="">Загрузка устройств...</option>
      </select>

      <div class="audio-visualizer" id="viz">
        ${Array(16)
          .fill(0)
          .map(() => '<div class="wave"></div>')
          .join('')}
      </div>

      <button class="btn btn-primary" id="testMic"
              style="width:100%">
        Тест микрофона
      </button>
      <div id="micStatus" style="margin-top:8px;font-size:12px;
           color:var(--muted);text-align:center;"></div>
    `;

    this.loadMicrophones();

    document.getElementById('testMic').addEventListener('click', () => {
      this.toggleMicTest();
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
      mics.forEach((mic, i) => {
        const opt = document.createElement('option');
        opt.value = mic.deviceId;
        opt.textContent = mic.label || `Микрофон ${i + 1}`;
        if (this.selectedMic === mic.deviceId) opt.selected = true;
        select.appendChild(opt);
      });
    } catch {
      select.innerHTML = '<option>Нет доступа к микрофону</option>';
      const status = document.getElementById('micStatus');
      if (status) {
        status.textContent = 'Предоставьте разрешение на доступ к микрофону';
        status.style.color = 'var(--error)';
      }
    }
  }

  async toggleMicTest() {
    if (this._testingMic) {
      this.stopMicTest();
      return;
    }

    const select = document.getElementById('micSelect');
    if (!select || !select.value) {
      const status = document.getElementById('micStatus');
      if (status) {
        status.textContent = 'Сначала выберите микрофон';
        status.style.color = 'var(--error)';
      }
      return;
    }

    try {
      this._micStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: select.value } },
      });

      this._micCtx = new AudioContext();
      const source = this._micCtx.createMediaStreamSource(this._micStream);
      const analyser = this._micCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const bars = document.querySelectorAll('#viz .wave');
      const data = new Uint8Array(analyser.frequencyBinCount);
      this._testingMic = true;

      const btn = document.getElementById('testMic');
      if (btn) btn.textContent = 'Остановить тест';
      const status = document.getElementById('micStatus');
      if (status) {
        status.textContent = 'Говорите в микрофон...';
        status.style.color = 'var(--success)';
      }

      const draw = () => {
        if (!this._testingMic) return;
        analyser.getByteFrequencyData(data);
        bars.forEach((bar, i) => {
          const val = data[i % data.length] || 0;
          const pct = Math.max(10, (val / 255) * 100);
          bar.style.height = `${pct}%`;
        });
        requestAnimationFrame(draw);
      };
      draw();

      // Автоостановка через 10 секунд
      this._micTimer = setTimeout(() => this.stopMicTest(), 10000);
    } catch (err) {
      const status = document.getElementById('micStatus');
      if (status) {
        status.textContent = 'Ошибка: ' + (err.message || err);
        status.style.color = 'var(--error)';
      }
    }
  }

  stopMicTest() {
    this._testingMic = false;
    if (this._micTimer) {
      clearTimeout(this._micTimer);
      this._micTimer = null;
    }
    if (this._micStream) {
      this._micStream.getTracks().forEach((t) => t.stop());
      this._micStream = null;
    }
    if (this._micCtx) {
      this._micCtx.close().catch(() => {});
      this._micCtx = null;
    }

    const btn = document.getElementById('testMic');
    if (btn) btn.textContent = 'Тест микрофона';
    const bars = document.querySelectorAll('#viz .wave');
    bars.forEach((bar) => (bar.style.height = '20%'));
    const status = document.getElementById('micStatus');
    if (status && status.style.color !== 'var(--error)') {
      status.textContent = '';
    }
  }

  // -- Финальный экран --

  renderFinishScreen() {
    const cfg = MODE_CONFIG[this.selectedMode];
    this.els.card.innerHTML = `
      <div style="text-align:center;padding:40px;">
        <div class="finish-icon">
          ${ICONS.finish}
        </div>
        <h2 style="margin-bottom:12px;">Всё готово!</h2>
        <p class="subtitle">
          Режим: ${cfg?.name || 'Не выбран'}<br>
          Аудио захват будет активен с начала разговора.
        </p>
      </div>
    `;
  }

  // -- Загрузка и парсинг файлов --

  setupDragDrop(dropZone, fileInput) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.style.borderColor = 'var(--accent)';
      dropZone.style.background = 'var(--accent-dim)';
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.style.borderColor = '';
      dropZone.style.background = '';
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.style.borderColor = '';
      dropZone.style.background = '';

      const file = e.dataTransfer?.files?.[0];
      if (!file) return;

      const field = fileInput.id === 'resumeInput' ? 'resume' : 'vacancy';
      this.handleFileUpload(file, field);
    });
  }

  async handleFileUpload(file, field) {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      const resultId = field + 'Result';
      this.showUploadResult(resultId, 'Файл слишком большой (макс. 10 МБ)', true);
      return;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    const allowedExts = ['txt', 'pdf', 'docx'];
    if (!allowedExts.includes(ext)) {
      const resultId = field + 'Result';
      this.showUploadResult(
        resultId,
        'Формат не поддерживается. Используйте PDF, DOCX или TXT',
        true
      );
      return;
    }

    const resultId = field + 'Result';

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      const text = await window.electron.parseFileBuffer(uint8, ext);

      if (!text || !text.trim()) {
        this.showUploadResult(resultId, 'Файл пуст или не удалось извлечь текст', true);
        return;
      }

      if (field === 'resume') {
        this.resumeText = text.trim();
      } else {
        this.vacancyText = text.trim();
      }

      this.showUploadResult(
        resultId,
        file.name + ' загружен (' + text.trim().length + ' символов)'
      );
      this.els.btnNext.disabled = false;
    } catch (err) {
      this.showUploadResult(resultId, 'Ошибка чтения файла: ' + (err.message || err), true);
    }
  }

  showUploadResult(elementId, message, isError = false) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = (isError ? '✗ ' : '✓ ') + message;
    el.style.background = isError ? 'var(--error)' : 'var(--success)';
    el.classList.remove('hidden');
  }

  // -- Навигация --

  nextStep() {
    if (this.els.btnNext.disabled) return;
    this.collectCurrentStepData();

    if (this.stepIndex >= this.totalSteps - 1) return;
    this.stepIndex++;
    this.render();
  }

  prevStep() {
    if (this.stepIndex <= 0) return;
    this.collectCurrentStepData();
    this.stepIndex--;
    this.render();
  }

  updateNav() {
    this.els.btnBack.classList.toggle('hidden', this.stepIndex === 0);
    this.els.btnNext.classList.toggle('hidden', this.isLastStep);
    this.els.btnFinish.classList.toggle('hidden', !this.isLastStep);
    this.els.btnSkip.classList.add('hidden');

    if (this.els.curStep) {
      this.els.curStep.textContent = this.stepIndex + 1;
    }
  }

  // -- Завершение --

  async finish() {
    this.collectCurrentStepData();

    // Сохранение контекстных файлов на бэкенд
    try {
      if (this.resumeText) {
        await window.electron?.saveContextFile?.('resume', this.resumeText);
      }
      if (this.contextText) {
        await window.electron?.saveContextFile?.('user_context', this.contextText);
      }
      if (this.vacancyText) {
        await window.electron?.saveContextFile?.('vacancy', this.vacancyText);
      }
    } catch (err) {
      console.error('[Onboarding] Ошибка сохранения контекста:', err);
    }

    const settings = {
      mode: this.selectedMode,
      selectedMic: this.selectedMic,
      hasResume: !!this.resumeText,
      hasVacancy: !!this.vacancyText,
      hasContext: !!this.contextText,
      timestamp: Date.now(),
    };

    this.els.btnFinish.disabled = true;
    this.els.btnFinish.textContent = 'Запуск...';

    try {
      await window.electron?.finishOnboarding(settings);
    } catch (err) {
      const msg = err?.message || 'Неизвестная ошибка';
      alert('Ошибка запуска: ' + msg);
      this.els.btnFinish.disabled = false;
      this.els.btnFinish.textContent = 'Запустить ✓';
    }
  }

  // -- Утилиты --

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new OnboardingController();
});
