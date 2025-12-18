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
            fontHintsValue: document.getElementById('font-hints-value')
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
        this.elements.aiProfile.addEventListener('change', (e) => {
            this.currentProfile = e.target.value;
            this.toggleCustomInstructions();
            this.saveSettings({ aiProfile: e.target.value });
        });

        // Пользовательские инструкции
        this.elements.customInstructions.addEventListener('input', (e) => {
            this.customInstructions = e.target.value;
            this.saveSettings({ customInstructions: e.target.value });
        });

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
        // Не отправляем аудио на паузе
        if (this.isPaused) return;

        if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
            try {
                // data это Buffer с бинарными PCM данными
                this.wsConnection.send(data);
            } catch (e) {
                console.error('Ошибка отправки аудио:', e);
            }
        }
    }

    // Пауза/Продолжить
    togglePause() {
        if (!this.isRunning) return;

        this.isPaused = !this.isPaused;

        if (this.isPaused) {
            this.updateStatus('paused');
            this.elements.btnPause.textContent = 'Продолжить';
        } else {
            this.updateStatus('listening');
            this.elements.btnPause.textContent = 'Пауза';
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
            this.elements.btnPause.classList.remove('hidden');
            this.elements.btnPause.textContent = 'Пауза';

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
                            // Показываем транскрипт с latency
                            const latencyInfo = data.latency_ms ? ` (${data.latency_ms}ms)` : '';
                            console.log(`[STT] "${data.text}"${latencyInfo}`);

                            this.addTranscriptItem(data.text, new Date().toISOString(), data.latency_ms);

                            // Запрашиваем подсказку ТОЛЬКО если включены авто-подсказки
                            if (this.autoHintsEnabled) {
                                this.requestHint(data.text);
                            }
                            // Активируем кнопку "Получить ответ"
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
        // Накапливаем контекст ВСЕГДА
        this.transcriptContext.push(transcriptText);
        if (this.transcriptContext.length > 5) {
            this.transcriptContext = this.transcriptContext.slice(-5);
        }

        // Дедуп запросов: проверяем hash контекста
        const contextHash = this.transcriptContext.join('|');
        if (this.lastContextHash === contextHash) {
            console.log('[LLM] Дубликат контекста, пропускаем');
            return;
        }

        // Защита от множественных запросов
        if (this.hintRequestPending) {
            console.log('[LLM] Запрос уже в процессе, накоплен контекст');
            return;
        }

        this.hintRequestPending = true;
        this.lastContextHash = contextHash;
        const startTime = performance.now();

        // Собираем system prompt с учётом профиля
        const systemPrompt = this.buildSystemPrompt();

        console.log(`[LLM] Запрос: profile=${this.currentProfile}, customInstructions.len=${this.customInstructions.length}`);
        console.log(`[LLM] System prompt preview: ${systemPrompt.substring(0, 200)}...`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch('http://localhost:8766/hint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: transcriptText,
                    context: this.transcriptContext,
                    system_prompt: systemPrompt,
                    profile: this.currentProfile
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                const clientLatency = Math.round(performance.now() - startTime);

                if (data.hint && data.hint.length > 5) {
                    console.log(`[LLM] Подсказка за ${clientLatency}ms (server: ${data.latency_ms}ms)`);
                    this.addHintItem(data.hint, new Date().toISOString(), data.latency_ms);
                }
            } else {
                console.error('[LLM] Ошибка:', response.status);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('[LLM] Таймаут');
            } else {
                console.error('Ошибка получения подсказки:', error);
            }
        } finally {
            this.hintRequestPending = false;
        }
    }

    updateStatus(status) {
        const statusMap = {
            listening: { class: 'status-listening', text: 'Слушаю...' },
            paused: { class: 'status-paused', text: 'Приостановлено' },
            error: { class: 'status-error', text: 'Ошибка' }
        };

        const config = statusMap[status] || statusMap.paused;

        this.elements.statusIndicator.className = `status-indicator ${config.class}`;
        this.elements.statusText.textContent = config.text;
    }

    updateToggleButton() {
        const btn = this.elements.btnToggle;
        if (this.isRunning) {
            btn.classList.add('active');
            btn.querySelector('.btn-icon').textContent = '⏹';
            btn.querySelector('.btn-text').textContent = 'Стоп';
        } else {
            btn.classList.remove('active');
            btn.querySelector('.btn-icon').textContent = '▶';
            btn.querySelector('.btn-text').textContent = 'Старт';
        }
    }

    clearFeeds() {
        this.elements.transcriptFeed.innerHTML = '';
        this.elements.hintsFeed.innerHTML = '';
    }

    addTranscriptItem(text, timestamp, latencyMs = null) {
        // Дедуп транскриптов
        if (text === this.lastTranscriptText) {
            console.log('[STT] Дубликат транскрипта, пропускаем');
            return;
        }
        this.lastTranscriptText = text;
        this.addFeedItem(this.elements.transcriptFeed, text, timestamp, latencyMs);
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

        // Показываем latency если есть
        const latencyBadge = latencyMs ? `<span class="latency-badge">${latencyMs}ms</span>` : '';

        item.innerHTML = `
      <div class="feed-item-time">${this.formatTime(timestamp)}${latencyBadge}</div>
      <div class="feed-item-text">${this.escapeHtml(text)}</div>
    `;

        feed.appendChild(item);
        feed.scrollTop = feed.scrollHeight;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
            hints: this.getHintsText()
        };

        const sessions = this.getSessions();
        sessions.unshift(session);

        // Храним максимум 50 сессий
        if (sessions.length > 50) {
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
        return Array.from(items).map(el => el.textContent).join('\n');
    }

    getHintsText() {
        const items = this.elements.hintsFeed.querySelectorAll('.feed-item-text');
        return Array.from(items).map(el => el.textContent).join('\n');
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

        this.elements.sessionsList.innerHTML = sessions.map(session => `
      <div class="session-item" data-session-id="${session.id}">
        <div class="session-item-date">${this.formatDate(session.date)}</div>
        <div class="session-item-preview">${this.escapeHtml(session.transcript.substring(0, 100))}...</div>
      </div>
    `).join('');

        // Добавляем обработчики
        this.elements.sessionsList.querySelectorAll('.session-item').forEach(item => {
            item.addEventListener('click', () => {
                const sessionId = item.dataset.sessionId;
                this.showSessionView(sessionId);
            });
        });
    }

    showSessionView(sessionId) {
        const sessions = this.getSessions();
        const session = sessions.find(s => s.id === sessionId);

        if (!session) return;

        this.elements.sessionViewTitle.textContent = `Сессия от ${this.formatDate(session.date)}`;
        this.elements.sessionTranscript.textContent = session.transcript || 'Нет данных';
        this.elements.sessionHints.textContent = session.hints || 'Нет данных';

        this.hideHistoryModal();
        this.elements.sessionViewModal.classList.remove('hidden');
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
            minute: '2-digit'
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
    }

    // Переключение видимости кастомных инструкций
    toggleCustomInstructions() {
        if (this.currentProfile === 'custom') {
            this.elements.customInstructionsContainer.classList.remove('hidden');
        } else {
            this.elements.customInstructionsContainer.classList.add('hidden');
        }
    }

    // Сборка system prompt с учётом профиля
    buildSystemPrompt() {
        const profiles = {
            job_interview_ru: 'Ты помощник на собеседовании. Давай краткие, полезные подсказки по техническим вопросам. Отвечай на русском, кратко и по делу.',
            custom: this.customInstructions || 'Ты ассистент. Дай краткий ответ по контексту разговора.'
        };

        const basePrompt = profiles[this.currentProfile] || profiles.job_interview_ru;

        // Для custom профиля добавляем инструкции пользователя
        if (this.currentProfile === 'custom' && this.customInstructions) {
            return this.customInstructions;
        }

        return basePrompt;
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
                this.elements.customInstructions.value = settings.customInstructions;
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
                document.documentElement.style.setProperty('--font-transcript', `${settings.fontTranscript}px`);
            }
            // Размер шрифта подсказок
            if (settings.fontHints !== undefined) {
                this.elements.fontHints.value = settings.fontHints;
                this.elements.fontHintsValue.textContent = `${settings.fontHints}px`;
                document.documentElement.style.setProperty('--font-hints', `${settings.fontHints}px`);
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
