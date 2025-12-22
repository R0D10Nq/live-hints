/**
 * LLM Client - HTTP клиент для LLM сервера с поддержкой streaming
 */

class LLMClient {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'http://localhost:8766';
        this.timeout = options.timeout || 60000;

        // Callbacks
        this.onChunk = options.onChunk || (() => { });
        this.onComplete = options.onComplete || (() => { });
        this.onError = options.onError || (() => { });
        this.onStart = options.onStart || (() => { });
    }

    async requestHintStream(text, context, options = {}) {
        const {
            profile = 'interview',
            maxTokens = 500,
            temperature = 0.8
        } = options;

        this.onStart();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(`${this.baseUrl}/hint/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    context,
                    profile,
                    max_tokens: maxTokens,
                    temperature
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                clearTimeout(timeoutId);
                const errorText = await response.text().catch(() => 'Не удалось прочитать ответ');
                throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedHint = '';
            let metadata = {};

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
                            accumulatedHint += data.chunk;
                            this.onChunk(data.chunk, accumulatedHint, data);
                        }

                        if (data.done) {
                            clearTimeout(timeoutId);
                            metadata = {
                                latencyMs: data.latency_ms,
                                ttftMs: data.ttft_ms,
                                cached: data.cached || false,
                                questionType: data.question_type || 'general'
                            };
                            this.onComplete(accumulatedHint, metadata);
                            return { hint: accumulatedHint, ...metadata };
                        }
                    } catch (parseError) {
                        // Ignore SSE parse errors
                    }
                }
            }

            return { hint: accumulatedHint, ...metadata };

        } catch (error) {
            clearTimeout(timeoutId);
            const errorMessage = this._getReadableError(error);
            this.onError(errorMessage, error);
            throw error;
        }
    }

    async checkHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/health`, { timeout: 5000 });
            if (response.ok) {
                return await response.json();
            }
            return { status: 'error', message: `HTTP ${response.status}` };
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }

    _getReadableError(error) {
        if (error.name === 'AbortError') {
            return 'Таймаут запроса к LLM (60 сек)';
        }
        if (error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
            return 'LLM сервер недоступен. Запустите: python python/llm_server.py';
        }
        if (error.message?.includes('NetworkError') || error.message?.includes('network')) {
            return 'Ошибка сети. Проверьте подключение.';
        }
        return `Ошибка: ${error.message || 'Неизвестная ошибка'}`;
    }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LLMClient };
}
