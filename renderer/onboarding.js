/**
 * Live Hints Onboarding — Interactive Controller
 * Kinetic, cinematic, no AI clichés
 */

class OnboardingController {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.selectedMode = 'job_interview_ru';
        this.hasResume = false;
        this.hasVacancy = false;

        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.initParticles();
        this.initAudioVisualizer();
        this.initMicrophoneSelect();
        this.updateProgress();
    }

    cacheElements() {
        // Steps
        this.steps = document.querySelectorAll('.step-content');
        this.nodes = document.querySelectorAll('.orbit-node');
        this.progressBar = document.getElementById('orbit-progress');

        // Navigation
        this.btnBack = document.getElementById('btn-back');
        this.btnNext = document.getElementById('btn-next');
        this.btnSkip = document.getElementById('btn-skip');
        this.btnFinish = document.getElementById('btn-finish');
        this.stepCounter = document.getElementById('current-step');

        // Mode cards
        this.modeCards = document.querySelectorAll('.mode-card');
        this.modeContextArea = document.getElementById('mode-context-area');

        // File uploads
        this.resumeUpload = document.getElementById('resume-upload');
        this.resumeInput = document.getElementById('resume-input');
        this.vacancyUpload = document.getElementById('vacancy-upload');
        this.vacancyInput = document.getElementById('vacancy-input');
    }

    bindEvents() {
        // Navigation
        this.btnBack?.addEventListener('click', () => this.prevStep());
        this.btnNext?.addEventListener('click', () => this.nextStep());
        this.btnSkip?.addEventListener('click', () => this.nextStep());
        this.btnFinish?.addEventListener('click', () => this.finish());

        // Window controls
        document.getElementById('btn-minimize')?.addEventListener('click', () => {
            window.electronAPI?.minimizeWindow?.();
        });
        document.getElementById('btn-close')?.addEventListener('click', () => {
            window.electronAPI?.closeWindow?.();
        });

        // Mode selection
        this.modeCards.forEach(card => {
            card.addEventListener('click', () => this.selectMode(card));
            card.addEventListener('mouseenter', () => this.hoverCard(card, true));
            card.addEventListener('mouseleave', () => this.hoverCard(card, false));
        });

        // File uploads
        this.setupFileUpload(this.resumeUpload, this.resumeInput, 'resume');
        this.setupFileUpload(this.vacancyUpload, this.vacancyInput, 'vacancy');

        // Text toggles
        document.getElementById('toggle-resume-text')?.addEventListener('click', () => {
            document.getElementById('resume-text-area')?.classList.toggle('hidden');
        });
        document.getElementById('toggle-vacancy-text')?.addEventListener('click', () => {
            document.getElementById('vacancy-text-area')?.classList.toggle('hidden');
        });

        // Skip resume button
        document.getElementById('skip-resume')?.addEventListener('click', () => {
            this.nextStep();
        });

        // Textarea validation
        document.querySelector('#resume-text-area textarea')?.addEventListener('input', () => {
            this.updateButtons();
        });

        // Mic select validation
        document.getElementById('mic-select')?.addEventListener('change', () => {
            this.updateButtons();
        });

        // Test microphone button
        document.getElementById('btn-test-mic')?.addEventListener('click', () => {
            this.testMicrophone();
        });

        // File remove buttons
        document.getElementById('resume-remove')?.addEventListener('click', () => this.removeFile('resume'));
        document.getElementById('vacancy-remove')?.addEventListener('click', () => this.removeFile('vacancy'));

        // File replace buttons
        document.getElementById('resume-replace')?.addEventListener('click', () => this.replaceFile('resume'));
        document.getElementById('vacancy-replace')?.addEventListener('click', () => this.replaceFile('vacancy'));

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'Enter') {
                if (this.currentStep < this.totalSteps) this.nextStep();
                else this.finish();
            } else if (e.key === 'ArrowLeft') {
                this.prevStep();
            }
        });
    }

    initParticles() {
        const container = document.getElementById('particles');
        if (!container) return;

        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 8 + 's';
            particle.style.animationDuration = (6 + Math.random() * 4) + 's';
            container.appendChild(particle);
        }
    }

    initAudioVisualizer() {
        this.audioViz = document.getElementById('audio-viz');
        if (!this.audioViz) return;

        this.waveBars = this.audioViz.querySelectorAll('.wave-bar');
        this.isTestingMic = false;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;

        // Начальное состояние — плоские линии
        this.waveBars.forEach(bar => {
            bar.style.height = '10%';
            bar.style.opacity = '0.3';
        });
    }

    async testMicrophone() {
        if (this.isTestingMic) {
            // Останавливаем тест
            this.stopMicrophoneTest();
        } else {
            // Запускаем реальный тест
            await this.startMicrophoneTest();
        }
    }

    async startMicrophoneTest() {
        try {
            const micSelect = document.getElementById('mic-select');
            const deviceId = micSelect?.value;

            if (!deviceId) {
                this.showError('Сначала выберите микрофон');
                return;
            }

            // Запрашиваем доступ к микрофону
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            // Создаем AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 64;
            this.analyser.smoothingTimeConstant = 0.8;

            // Подключаем микрофон
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);

            // Получаем данные для визуализации
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);

            // Обновляем UI
            this.isTestingMic = true;
            document.getElementById('btn-test-mic').innerHTML = '<span class="btn-icon">■</span> Остановить';
            document.getElementById('btn-test-mic').classList.add('active');

            // Запускаем визуализацию
            this.animateVisualizer();

        } catch (error) {
            console.error('[Microphone] Ошибка доступа:', error);
            this.showError('Не удалось получить доступ к микрофону: ' + error.message);
        }
    }

    stopMicrophoneTest() {
        this.isTestingMic = false;

        // Останавливаем все треки
        if (this.microphone && this.microphone.mediaStream) {
            this.microphone.mediaStream.getTracks().forEach(track => track.stop());
        }

        // Закрываем AudioContext
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }

        // Сбрасываем ссылки
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;

        // Сбрасываем UI
        this.waveBars.forEach(bar => {
            bar.style.height = '10%';
            bar.style.opacity = '0.3';
        });

        document.getElementById('btn-test-mic').innerHTML = '<span class="btn-icon">◉</span> Тест микрофона';
        document.getElementById('btn-test-mic').classList.remove('active');
    }

    animateVisualizer() {
        if (!this.isTestingMic || !this.analyser) {
            return;
        }

        // Получаем частотные данные
        this.analyser.getByteFrequencyData(this.dataArray);

        // Обновляем высоту полос
        const barCount = this.waveBars.length;
        const step = Math.floor(this.dataArray.length / barCount);

        this.waveBars.forEach((bar, i) => {
            const dataIndex = i * step;
            const value = this.dataArray[dataIndex] || 0;
            const height = Math.max(10, (value / 255) * 100);

            bar.style.height = height + '%';
            bar.style.opacity = '0.6';
            bar.classList.toggle('active', height > 50);
        });

        // Продолжаем анимацию
        requestAnimationFrame(() => this.animateVisualizer());
    }

    async initMicrophoneSelect() {
        const select = document.getElementById('mic-select');
        if (!select) return;

        try {
            // Очищаем список, оставляем только плейсхолдер
            select.innerHTML = '<option value="">Выберите микрофон...</option>';

            // Запрашиваем разрешение на доступ к микрофону
            await navigator.mediaDevices.getUserMedia({ audio: true });

            // Получаем список устройств
            const devices = await navigator.mediaDevices.enumerateDevices();
            const mics = devices.filter(d => d.kind === 'audioinput');

            if (mics.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'Микрофоны не найдены';
                select.appendChild(option);
                return;
            }

            // Фильтруем дубликаты по label
            const uniqueMics = [];
            const seenLabels = new Set();
            mics.forEach((mic) => {
                const label = mic.label || `Микрофон ${uniqueMics.length + 1}`;
                if (!seenLabels.has(label)) {
                    seenLabels.add(label);
                    uniqueMics.push(mic);
                }
            });

            uniqueMics.forEach((mic, index) => {
                const option = document.createElement('option');
                option.value = mic.deviceId;
                option.textContent = mic.label || `Микрофон ${index + 1}`;
                select.appendChild(option);
            });
        } catch (err) {
            console.error('Ошибка доступа к микрофону:', err);
            select.innerHTML = '<option value="">Нет доступа к микрофону</option>';
        }
    }

    selectMode(card) {
        this.modeCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedMode = card.dataset.mode;

        // Show context area for custom mode
        if (this.selectedMode === 'custom') {
            this.modeContextArea?.classList.remove('hidden');
        } else {
            this.modeContextArea?.classList.add('hidden');
        }

        // Update resume step UI based on mode
        this.updateResumeStepUI();

        // Haptic feedback
        this.triggerHaptic();

        // Обновляем валидацию кнопки Далее
        this.updateButtons();
    }

    updateResumeStepUI() {
        const skipBtn = document.getElementById('skip-resume');
        const subtitle = document.getElementById('resume-subtitle');

        if (this.selectedMode === 'job_interview_ru') {
            // Для собеседований резюме обязательно
            if (skipBtn) skipBtn.classList.add('hidden');
            if (subtitle) subtitle.textContent = 'AI будет опираться на ваш реальный опыт при формулировке ответов. Обязательно для собеседований.';
        } else {
            // Для других режимов можно пропустить
            if (skipBtn) skipBtn.classList.remove('hidden');
            if (subtitle) subtitle.textContent = 'AI будет опираться на ваш реальный опыт при формулировке ответов. Опционально для этого режима.';
        }
    }

    hoverCard(card, entering) {
        if (entering) {
            const rect = card.getBoundingClientRect();
            const glow = card.querySelector('.card-glow');
            if (glow) {
                glow.style.left = rect.width / 2 - 50 + 'px';
                glow.style.top = rect.height / 2 - 50 + 'px';
            }
        }
    }

    setupFileUpload(zone, input, type) {
        if (!zone || !input) return;

        zone.addEventListener('click', () => input.click());

        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('dragover');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) this.handleFile(file, type);
        });

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.handleFile(file, type);
        });
    }

    handleFile(file, type) {
        const resultEl = document.getElementById(`${type}-result`);
        const filenameEl = document.getElementById(`${type}-filename`);
        const filesizeEl = document.getElementById(`${type}-filesize`);

        if (filenameEl) filenameEl.textContent = file.name;
        if (filesizeEl) filesizeEl.textContent = this.formatFileSize(file.size);
        if (resultEl) {
            resultEl.classList.remove('hidden');
            resultEl.animate([
                { opacity: 0, transform: 'translateY(10px)' },
                { opacity: 1, transform: 'translateY(0)' }
            ], { duration: 300, easing: 'ease-out' });
        }

        if (type === 'resume') this.hasResume = true;
        if (type === 'vacancy') this.hasVacancy = true;

        this.triggerHaptic();

        // Обновляем валидацию кнопки Далее
        this.updateButtons();
    }

    removeFile(type) {
        const resultEl = document.getElementById(`${type}-result`);
        const inputEl = document.getElementById(`${type}-input`);

        if (resultEl) {
            resultEl.classList.add('hidden');
            resultEl.animate([
                { opacity: 1, transform: 'translateY(0)' },
                { opacity: 0, transform: 'translateY(-10px)' }
            ], { duration: 200, easing: 'ease-in' });
        }

        if (inputEl) inputEl.value = '';

        if (type === 'resume') this.hasResume = false;
        if (type === 'vacancy') this.hasVacancy = false;

        this.triggerHaptic();

        // Обновляем валидацию кнопки Далее
        this.updateButtons();
    }

    replaceFile(type) {
        // Открываем диалог выбора файла
        const inputEl = document.getElementById(`${type}-input`);
        if (inputEl) {
            inputEl.click();
        }
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    nextStep() {
        if (this.currentStep >= this.totalSteps) return;

        this.currentStep++;
        this.updateStep();
        this.triggerHaptic();
    }

    prevStep() {
        if (this.currentStep <= 1) return;

        this.currentStep--;
        this.updateStep();
        this.triggerHaptic();
    }

    updateStep() {
        // Update steps visibility
        this.steps.forEach((step, i) => {
            step.classList.toggle('active', i + 1 === this.currentStep);
        });

        // Update progress nodes
        this.nodes.forEach((node, i) => {
            const stepNum = i + 1;
            node.classList.remove('active', 'completed');
            if (stepNum === this.currentStep) {
                node.classList.add('active');
            } else if (stepNum < this.currentStep) {
                node.classList.add('completed');
            }
        });

        // Update progress bar
        this.updateProgress();

        // Update buttons
        this.updateButtons();

        // Update counter
        if (this.stepCounter) {
            this.stepCounter.textContent = this.currentStep;
        }
    }

    updateProgress() {
        if (!this.progressBar) return;
        const progress = ((this.currentStep - 1) / (this.totalSteps - 1)) * 70 + 15;
        this.progressBar.style.width = progress + '%';
    }

    updateButtons() {
        // Back button - скрыта только на первом шаге
        this.btnBack?.classList.toggle('hidden', this.currentStep === 1);

        // Next/Finish buttons - Запустить только на последнем шаге
        const isLast = this.currentStep === this.totalSteps;
        this.btnNext?.classList.toggle('hidden', isLast);
        this.btnFinish?.classList.toggle('hidden', !isLast);

        // Проверяем валидацию текущего шага
        const isValid = this.validateStep();
        if (this.btnNext) this.btnNext.disabled = !isValid;
        if (this.btnFinish) this.btnFinish.disabled = !isValid;
    }

    validateStep() {
        switch (this.currentStep) {
            case 1:
                // Шаг 1: должен быть выбран режим
                return !!this.selectedMode;
            case 2:
                // Шаг 2: резюме обязательно только для собеседований
                if (this.selectedMode === 'job_interview_ru') {
                    const resumeText = document.querySelector('#resume-text-area textarea')?.value;
                    return this.hasResume || (resumeText && resumeText.trim().length > 0);
                }
                // Для других режимов шаг 2 опционален
                return true;
            case 3:
                // Шаг 3: вакансия опциональна, всегда валидно
                return true;
            case 4:
                // Шаг 4: должен быть выбран микрофон
                const micSelect = document.getElementById('mic-select');
                return micSelect && micSelect.value !== '';
            default:
                return true;
        }
    }

    triggerHaptic() {
        if (navigator.vibrate) {
            navigator.vibrate(8);
        }
    }

    async finish() {
        const settings = {
            mode: this.selectedMode,
            hasResume: this.hasResume,
            hasVacancy: this.hasVacancy,
            timestamp: Date.now()
        };

        // Show loading state
        this.btnFinish.disabled = true;
        this.btnFinish.textContent = 'Запуск...';
        this.btnFinish.classList.add('loading');

        try {
            // Check if IPC is available
            if (!window.electronAPI?.finishOnboarding) {
                throw new Error('IPC API не доступен. Перезапустите приложение.');
            }

            // Send to main process
            const result = await window.electronAPI.finishOnboarding(settings);

            if (!result || !result.success) {
                throw new Error(result?.error || 'Неизвестная ошибка');
            }

            console.log('[Onboarding] Finished:', settings);
        } catch (error) {
            console.error('[Onboarding] Ошибка запуска:', error);

            // Reset button state
            this.btnFinish.disabled = false;
            this.btnFinish.textContent = 'Запустить сессию';
            this.btnFinish.classList.remove('loading');

            // Show error
            this.showError('Ошибка запуска: ' + error.message);
        }
    }

    showError(message) {
        // Create or update error toast
        let toast = document.querySelector('.onboarding-error-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'onboarding-error-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('show');

        setTimeout(() => toast.classList.remove('show'), 5000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new OnboardingController();
});
