<<<<<<< HEAD
/**
 * LLM Providers - Клиенты для различных LLM провайдеров
 * Используется как fallback когда Python сервер недоступен
 */

const SYSTEM_PROMPT = `Ты — умный ассистент для переговоров и звонков. 
Твоя задача — анализировать транскрипт разговора и давать краткие, полезные подсказки.

Правила:
1. Подсказки должны быть короткими (1-2 предложения)
2. Фокусируйся на контексте разговора
3. Предлагай конкретные действия или ответы
4. Если контекста недостаточно — скажи что нужно уточнить
5. Отвечай на русском языке`;

/**
 * Базовый класс провайдера
 */
class BaseLLMProvider {
    constructor(config = {}) {
        this.config = config;
    }

    async generateHint(text, context = []) {
        throw new Error('Метод не реализован');
    }

    buildMessages(text, context = []) {
        const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

        for (const ctx of context.slice(-5)) {
            messages.push({ role: 'user', content: ctx });
        }

        messages.push({ role: 'user', content: `Транскрипт: ${text}\n\nДай подсказку:` });

        return messages;
    }
}

/**
 * Ollama провайдер (локальный)
 */
class OllamaProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.baseUrl = config.baseUrl || 'http://localhost:11434';
        this.model = config.model || 'llama3.2';
    }

    async generateHint(text, context = []) {
        try {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    messages: this.buildMessages(text, context),
                    stream: false,
                    options: {
                        temperature: 0.7,
                        num_predict: 100
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.message?.content || 'Нет подсказки';
            }

            throw new Error(`HTTP ${response.status}`);
        } catch (error) {
            if (error.message.includes('fetch')) {
                return 'Ollama не запущен. Запустите: ollama serve';
            }
            throw error;
        }
    }
}

/**
 * OpenAI провайдер
 */
class OpenAIProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
        this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
        this.model = config.model || 'gpt-4o-mini';
    }

    async generateHint(text, context = []) {
        if (!this.apiKey) {
            return 'OPENAI_API_KEY не установлен';
        }

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.model,
                messages: this.buildMessages(text, context),
                max_tokens: 150,
                temperature: 0.7
            })
        });

        if (response.ok) {
            const data = await response.json();
            return data.choices[0]?.message?.content || 'Нет подсказки';
        }

        throw new Error(`OpenAI HTTP ${response.status}`);
    }
}

/**
 * Gemini провайдер
 */
class GeminiProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.apiKey = config.apiKey || process.env.GEMINI_API_KEY;
        this.model = config.model || 'gemini-1.5-flash';
    }

    async generateHint(text, context = []) {
        if (!this.apiKey) {
            return 'GEMINI_API_KEY не установлен';
        }

        const prompt = `${SYSTEM_PROMPT}\n\n` +
            (context.length > 0 ? `Контекст:\n${context.slice(-5).map(c => `- ${c}`).join('\n')}\n\n` : '') +
            `Транскрипт: ${text}\n\nДай подсказку:`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        maxOutputTokens: 150,
                        temperature: 0.7
                    }
                })
            }
        );

        if (response.ok) {
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Нет подсказки';
        }

        throw new Error(`Gemini HTTP ${response.status}`);
    }
}

/**
 * OpenRouter провайдер
 */
class OpenRouterProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.apiKey = config.apiKey || process.env.OPENROUTER_API_KEY;
        this.model = config.model || 'meta-llama/llama-3.2-3b-instruct:free';
    }

    async generateHint(text, context = []) {
        if (!this.apiKey) {
            return 'OPENROUTER_API_KEY не установлен';
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost',
                'X-Title': 'Live Hints'
            },
            body: JSON.stringify({
                model: this.model,
                messages: this.buildMessages(text, context),
                max_tokens: 150,
                temperature: 0.7
            })
        });

        if (response.ok) {
            const data = await response.json();
            return data.choices?.[0]?.message?.content || 'Нет подсказки';
        }

        throw new Error(`OpenRouter HTTP ${response.status}`);
    }
}

/**
 * Фабрика провайдеров
 */
function createProvider(name, config = {}) {
    const providers = {
        ollama: OllamaProvider,
        openai: OpenAIProvider,
        gemini: GeminiProvider,
        openrouter: OpenRouterProvider
    };

    const ProviderClass = providers[name] || OllamaProvider;
    return new ProviderClass(config);
}

/**
 * Список доступных провайдеров
 */
const AVAILABLE_PROVIDERS = [
    { id: 'ollama', name: 'Ollama (локально)', requiresKey: false },
    { id: 'openai', name: 'OpenAI', requiresKey: true },
    { id: 'gemini', name: 'Gemini', requiresKey: true },
    { id: 'openrouter', name: 'OpenRouter', requiresKey: true }
];

module.exports = {
    BaseLLMProvider,
    OllamaProvider,
    OpenAIProvider,
    GeminiProvider,
    OpenRouterProvider,
    createProvider,
    AVAILABLE_PROVIDERS,
    SYSTEM_PROMPT
};
=======
/**
 * LLM Providers - Клиенты для различных LLM провайдеров
 * Используется как fallback когда Python сервер недоступен
 */

const SYSTEM_PROMPT = `Ты — умный ассистент для переговоров и звонков. 
Твоя задача — анализировать транскрипт разговора и давать краткие, полезные подсказки.

Правила:
1. Подсказки должны быть короткими (1-2 предложения)
2. Фокусируйся на контексте разговора
3. Предлагай конкретные действия или ответы
4. Если контекста недостаточно — скажи что нужно уточнить
5. Отвечай на русском языке`;

/**
 * Базовый класс провайдера
 */
class BaseLLMProvider {
    constructor(config = {}) {
        this.config = config;
    }

    async generateHint(text, context = []) {
        throw new Error('Метод не реализован');
    }

    buildMessages(text, context = []) {
        const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

        for (const ctx of context.slice(-5)) {
            messages.push({ role: 'user', content: ctx });
        }

        messages.push({ role: 'user', content: `Транскрипт: ${text}\n\nДай подсказку:` });

        return messages;
    }
}

/**
 * Ollama провайдер (локальный)
 */
class OllamaProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.baseUrl = config.baseUrl || 'http://localhost:11434';
        this.model = config.model || 'llama3.2';
    }

    async generateHint(text, context = []) {
        try {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    messages: this.buildMessages(text, context),
                    stream: false,
                    options: {
                        temperature: 0.7,
                        num_predict: 100
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.message?.content || 'Нет подсказки';
            }

            throw new Error(`HTTP ${response.status}`);
        } catch (error) {
            if (error.message.includes('fetch')) {
                return 'Ollama не запущен. Запустите: ollama serve';
            }
            throw error;
        }
    }
}

/**
 * OpenAI провайдер
 */
class OpenAIProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
        this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
        this.model = config.model || 'gpt-4o-mini';
    }

    async generateHint(text, context = []) {
        if (!this.apiKey) {
            return 'OPENAI_API_KEY не установлен';
        }

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.model,
                messages: this.buildMessages(text, context),
                max_tokens: 150,
                temperature: 0.7
            })
        });

        if (response.ok) {
            const data = await response.json();
            return data.choices[0]?.message?.content || 'Нет подсказки';
        }

        throw new Error(`OpenAI HTTP ${response.status}`);
    }
}

/**
 * Gemini провайдер
 */
class GeminiProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.apiKey = config.apiKey || process.env.GEMINI_API_KEY;
        this.model = config.model || 'gemini-1.5-flash';
    }

    async generateHint(text, context = []) {
        if (!this.apiKey) {
            return 'GEMINI_API_KEY не установлен';
        }

        const prompt = `${SYSTEM_PROMPT}\n\n` +
            (context.length > 0 ? `Контекст:\n${context.slice(-5).map(c => `- ${c}`).join('\n')}\n\n` : '') +
            `Транскрипт: ${text}\n\nДай подсказку:`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        maxOutputTokens: 150,
                        temperature: 0.7
                    }
                })
            }
        );

        if (response.ok) {
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Нет подсказки';
        }

        throw new Error(`Gemini HTTP ${response.status}`);
    }
}

/**
 * OpenRouter провайдер
 */
class OpenRouterProvider extends BaseLLMProvider {
    constructor(config = {}) {
        super(config);
        this.apiKey = config.apiKey || process.env.OPENROUTER_API_KEY;
        this.model = config.model || 'meta-llama/llama-3.2-3b-instruct:free';
    }

    async generateHint(text, context = []) {
        if (!this.apiKey) {
            return 'OPENROUTER_API_KEY не установлен';
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost',
                'X-Title': 'Live Hints'
            },
            body: JSON.stringify({
                model: this.model,
                messages: this.buildMessages(text, context),
                max_tokens: 150,
                temperature: 0.7
            })
        });

        if (response.ok) {
            const data = await response.json();
            return data.choices?.[0]?.message?.content || 'Нет подсказки';
        }

        throw new Error(`OpenRouter HTTP ${response.status}`);
    }
}

/**
 * Фабрика провайдеров
 */
function createProvider(name, config = {}) {
    const providers = {
        ollama: OllamaProvider,
        openai: OpenAIProvider,
        gemini: GeminiProvider,
        openrouter: OpenRouterProvider
    };

    const ProviderClass = providers[name] || OllamaProvider;
    return new ProviderClass(config);
}

/**
 * Список доступных провайдеров
 */
const AVAILABLE_PROVIDERS = [
    { id: 'ollama', name: 'Ollama (локально)', requiresKey: false },
    { id: 'openai', name: 'OpenAI', requiresKey: true },
    { id: 'gemini', name: 'Gemini', requiresKey: true },
    { id: 'openrouter', name: 'OpenRouter', requiresKey: true }
];

module.exports = {
    BaseLLMProvider,
    OllamaProvider,
    OpenAIProvider,
    GeminiProvider,
    OpenRouterProvider,
    createProvider,
    AVAILABLE_PROVIDERS,
    SYSTEM_PROMPT
};
>>>>>>> 19b38e4 (Initial local commit)
