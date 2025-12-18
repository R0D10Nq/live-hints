/**
 * HintPipeline - Оркестратор пайплайна подсказок
 * Управляет потоком данных: Аудио -> STT -> LLM -> UI
 */

const EventEmitter = require('events');

/**
 * Состояния пайплайна
 */
const PipelineState = {
    IDLE: 'idle',
    STARTING: 'starting',
    RUNNING: 'running',
    STOPPING: 'stopping',
    ERROR: 'error'
};

/**
 * События пайплайна
 */
const PipelineEvents = {
    STATE_CHANGE: 'stateChange',
    TRANSCRIPT: 'transcript',
    HINT: 'hint',
    ERROR: 'error',
    AUDIO_LEVEL: 'audioLevel'
};

class HintPipeline extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            sttUrl: options.sttUrl || 'ws://localhost:8765',
            llmUrl: options.llmUrl || 'http://localhost:8766',
            llmProvider: options.llmProvider || 'ollama',
            minTranscriptLength: options.minTranscriptLength || 10,
            hintDebounceMs: options.hintDebounceMs || 2000,
            ...options
        };

        this.state = PipelineState.IDLE;
        this.wsConnection = null;
        this.transcriptBuffer = [];
        this.hintDebounceTimer = null;
        this.lastHintTime = 0;
    }

    /**
     * Изменяет состояние пайплайна
     * @param {string} newState - Новое состояние
     */
    setState(newState) {
        const oldState = this.state;
        this.state = newState;
        this.emit(PipelineEvents.STATE_CHANGE, { oldState, newState });
    }

    /**
     * Получает текущее состояние
     * @returns {string} Текущее состояние
     */
    getState() {
        return this.state;
    }

    /**
     * Запускает пайплайн
     * @returns {Promise<void>}
     */
    async start() {
        if (this.state === PipelineState.RUNNING) {
            return;
        }

        this.setState(PipelineState.STARTING);

        try {
            await this.connectToSTT();
            this.setState(PipelineState.RUNNING);
        } catch (error) {
            this.setState(PipelineState.ERROR);
            this.emit(PipelineEvents.ERROR, { message: error.message, code: 'START_FAILED' });
            throw error;
        }
    }

    /**
     * Останавливает пайплайн
     * @returns {Promise<void>}
     */
    async stop() {
        if (this.state === PipelineState.IDLE) {
            return;
        }

        this.setState(PipelineState.STOPPING);

        // Очищаем таймеры
        if (this.hintDebounceTimer) {
            clearTimeout(this.hintDebounceTimer);
            this.hintDebounceTimer = null;
        }

        // Закрываем WebSocket
        if (this.wsConnection) {
            this.wsConnection.close();
            this.wsConnection = null;
        }

        // Очищаем буфер
        this.transcriptBuffer = [];

        this.setState(PipelineState.IDLE);
    }

    /**
     * Подключается к STT серверу
     * @returns {Promise<void>}
     */
    async connectToSTT() {
        return new Promise((resolve, reject) => {
            // В Node.js используем ws, в браузере - WebSocket
            const WebSocketClass = typeof WebSocket !== 'undefined' ? WebSocket : require('ws');

            this.wsConnection = new WebSocketClass(this.options.sttUrl);

            const timeout = setTimeout(() => {
                reject(new Error('Таймаут подключения к STT серверу'));
            }, 5000);

            this.wsConnection.onopen = () => {
                clearTimeout(timeout);
                resolve();
            };

            this.wsConnection.onmessage = (event) => {
                this.handleSTTMessage(event.data);
            };

            this.wsConnection.onerror = (error) => {
                clearTimeout(timeout);
                this.emit(PipelineEvents.ERROR, { message: 'Ошибка WebSocket', code: 'WS_ERROR' });
                reject(error);
            };

            this.wsConnection.onclose = () => {
                if (this.state === PipelineState.RUNNING) {
                    this.setState(PipelineState.ERROR);
                    this.emit(PipelineEvents.ERROR, { message: 'Соединение потеряно', code: 'WS_CLOSED' });
                }
            };
        });
    }

    /**
     * Обрабатывает сообщение от STT сервера
     * @param {string} data - Данные сообщения
     */
    handleSTTMessage(data) {
        try {
            const message = typeof data === 'string' ? JSON.parse(data) : data;

            if (message.type === 'transcript' && message.text) {
                const transcript = {
                    text: message.text,
                    timestamp: new Date().toISOString()
                };

                this.emit(PipelineEvents.TRANSCRIPT, transcript);
                this.transcriptBuffer.push(transcript.text);
                this.scheduleHintGeneration();
            }
        } catch (error) {
            console.error('Ошибка парсинга STT сообщения:', error);
        }
    }

    /**
     * Отправляет аудио данные в STT
     * @param {ArrayBuffer|Buffer} audioData - PCM аудио данные
     */
    sendAudio(audioData) {
        if (this.wsConnection && this.wsConnection.readyState === 1) { // WebSocket.OPEN = 1
            this.wsConnection.send(audioData);
        }
    }

    /**
     * Планирует генерацию подсказки с debounce
     */
    scheduleHintGeneration() {
        // Очищаем предыдущий таймер
        if (this.hintDebounceTimer) {
            clearTimeout(this.hintDebounceTimer);
        }

        this.hintDebounceTimer = setTimeout(() => {
            this.generateHint();
        }, this.options.hintDebounceMs);
    }

    /**
     * Генерирует подсказку на основе транскрипта
     */
    async generateHint() {
        // Проверяем минимальную длину
        const fullText = this.transcriptBuffer.join(' ');
        if (fullText.length < this.options.minTranscriptLength) {
            return;
        }

        // Проверяем время с последней подсказки
        const now = Date.now();
        if (now - this.lastHintTime < this.options.hintDebounceMs) {
            return;
        }

        try {
            const response = await fetch(`${this.options.llmUrl}/hint`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: fullText,
                    provider: this.options.llmProvider,
                    context: this.transcriptBuffer.slice(-10) // Последние 10 фрагментов
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.hint) {
                    this.lastHintTime = now;
                    this.emit(PipelineEvents.HINT, {
                        text: data.hint,
                        provider: data.provider,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        } catch (error) {
            console.error('Ошибка генерации подсказки:', error);
        }
    }

    /**
     * Устанавливает LLM провайдера
     * @param {string} provider - Имя провайдера
     */
    setProvider(provider) {
        this.options.llmProvider = provider;
    }

    /**
     * Очищает буфер транскрипта
     */
    clearBuffer() {
        this.transcriptBuffer = [];

        // Отправляем команду очистки в STT
        if (this.wsConnection && this.wsConnection.readyState === 1) {
            this.wsConnection.send(JSON.stringify({ command: 'clear' }));
        }
    }

    /**
     * Получает статистику пайплайна
     * @returns {Object} Статистика
     */
    getStats() {
        return {
            state: this.state,
            transcriptCount: this.transcriptBuffer.length,
            lastHintTime: this.lastHintTime ? new Date(this.lastHintTime).toISOString() : null,
            provider: this.options.llmProvider
        };
    }
}

module.exports = { HintPipeline, PipelineState, PipelineEvents };
