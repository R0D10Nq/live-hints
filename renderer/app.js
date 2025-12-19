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

        // Настройки контекста и LLM
        this.contextWindowSize = 10;  // 5..20
        this.maxContextChars = 3000;  // 2000..6000
        this.maxTokens = 200;         // 50..500
        this.temperature = 0.3;       // 0.0..1.0
        this.debugMode = false;

        // Метрики runtime
        this.metrics = {
            t_audio_in: null,
            t_transcript_last: null,
            t_hint_request_start: null,
            t_hint_response: null,
            t_hint_done: null,
            stt_latency_ms: null,
            llm_client_latency_ms: null,
            llm_server_latency_ms: null
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
            pinnedHintText: document.getElementById('pinned-hint-text')
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

        // Собираем system prompt с учётом профиля
        const systemPrompt = this.buildSystemPrompt();

        // Диагностика: логируем текущие настройки и prompt
        const savedSettings = JSON.parse(localStorage.getItem('live-hints-settings') || '{}');
        console.log(`[LLM] Запрос: profile=${this.currentProfile}, savedProfile=${savedSettings.aiProfile || 'не задан'}`);
        console.log(`[LLM] customInstructions.len=${(this.customInstructions || '').length}, system_prompt.len=${systemPrompt.length}`);
        console.log(`[LLM] System prompt preview: ${systemPrompt.substring(0, 120)}...`);

        // Debug: расширенная диагностика
        if (this.debugMode) {
            console.log(`[LLM Debug] context_len=${context.length}, maxTokens=${this.maxTokens}, temperature=${this.temperature}`);
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 сек для больших моделей

            const response = await fetch('http://localhost:8766/hint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: transcriptText,
                    context: context,
                    system_prompt: systemPrompt,
                    profile: this.currentProfile,
                    max_tokens: this.maxTokens,
                    temperature: this.temperature
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            this.metrics.t_hint_response = performance.now();

            if (response.ok) {
                const data = await response.json();
                this.metrics.t_hint_done = performance.now();
                const clientLatency = Math.round(this.metrics.t_hint_done - startTime);

                // ===== DEBUG: Full response analysis =====
                console.log('[DEBUG-UI] Full response object:', data);
                console.log('[DEBUG-UI] Response analysis:', {
                    keys: Object.keys(data),
                    hint_exists: 'hint' in data,
                    hint_type: typeof data.hint,
                    hint_value: data.hint,
                    hint_length: data.hint?.length,
                    hint_trimmed_length: data.hint?.trim?.()?.length,
                    latency_ms: data.latency_ms,
                    ttft_ms: data.ttft_ms
                });

                // Обновляем метрики (поддержка обоих форматов latency_ms и latencyMs)
                const serverLatency = data.latency_ms ?? data.latencyMs ?? null;
                this.metrics.llm_client_latency_ms = clientLatency;
                this.metrics.llm_server_latency_ms = serverLatency;
                this.updateMetricsPanel();

                // Проверка hint с детальным логированием
                const hintValue = data.hint;
                const hintTrimmed = hintValue?.trim?.() || '';
                console.log(`[DEBUG-UI] Hint check: raw="${hintValue}", trimmed="${hintTrimmed}", len=${hintTrimmed.length}`);

                if (hintTrimmed.length > 0) {
                    console.log(`[LLM] Подсказка за ${this.formatLatency(clientLatency)} (server: ${this.formatLatency(serverLatency)})`);
                    this.addHintItem(hintTrimmed, new Date().toISOString(), serverLatency);
                } else {
                    // Подсказка пустая - уведомляем пользователя
                    console.warn('[DEBUG-UI] EMPTY HINT! Full data:', JSON.stringify(data));
                    this.showToast('LLM вернул пустой ответ', 'warning');
                }
            } else {
                const errorText = await response.text().catch(() => 'Не удалось прочитать ответ');
                console.error(`[LLM] Ошибка ${response.status}: ${errorText.substring(0, 300)}`);
                this.showError(`LLM ошибка ${response.status}`);
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
            if (icon) icon.textContent = '⏹';
            if (text) text.textContent = 'Стоп';
        } else {
            btn.classList.remove('active');
            if (icon) icon.textContent = '▶';
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

        // Показываем latency если есть (в секундах)
        const latencyBadge = latencyMs ? `<span class="latency-badge">${this.formatLatency(latencyMs)}</span>` : '';

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
                timeout: 5000
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

Запрещено упоминать «как ИИ» или «как модель». Не придумывать вымышленных деталей.`
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
                document.documentElement.style.setProperty('--font-transcript', `${settings.fontTranscript}px`);
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
