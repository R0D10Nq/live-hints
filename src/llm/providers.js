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
    this.model = config.model || 'ministral-3:8b';
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
            temperature: 0.8,
            num_predict: 100,
          },
        }),
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
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: this.buildMessages(text, context),
        max_tokens: 150,
        temperature: 0.8,
      }),
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
      return 'GEMINI_API_KEY не установлен. Получите ключ на aistudio.google.com';
    }

    const systemPrompt = this.config.systemPrompt || SYSTEM_PROMPT;
    const prompt =
      `${systemPrompt}\n\n` +
      (context.length > 0
        ? `Контекст:\n${context
            .slice(-5)
            .map((c) => `- ${c}`)
            .join('\n')}\n\n`
        : '') +
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
            temperature: 0.8,
          },
        }),
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
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost',
        'X-Title': 'Live Hints',
      },
      body: JSON.stringify({
        model: this.model,
        messages: this.buildMessages(text, context),
        max_tokens: 150,
        temperature: 0.8,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || 'Нет подсказки';
    }

    throw new Error(`OpenRouter HTTP ${response.status}`);
  }
}

/**
 * Claude (Anthropic) провайдер
 */
class ClaudeProvider extends BaseLLMProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    this.model = config.model || 'claude-3-haiku-20240307';
  }

  async generateHint(text, context = []) {
    if (!this.apiKey) {
      return 'ANTHROPIC_API_KEY не установлен. Получите ключ на console.anthropic.com';
    }

    const systemPrompt = this.config.systemPrompt || SYSTEM_PROMPT;
    const contextText = context
      .slice(-5)
      .map((c) => `Пользователь: ${c}`)
      .join('\n');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.config.maxTokens || 150,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: contextText
              ? `${contextText}\n\nТранскрипт: ${text}\n\nДай подсказку:`
              : `Транскрипт: ${text}\n\nДай подсказку:`,
          },
        ],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.content?.[0]?.text || 'Нет подсказки';
    }

    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Claude HTTP ${response.status}: ${errorData.error?.message || 'Неизвестная ошибка'}`
    );
  }
}

/**
 * GigaChat (Сбер) провайдер
 */
class GigaChatProvider extends BaseLLMProvider {
  constructor(config = {}) {
    super(config);
    this.clientId = config.clientId || process.env.GIGACHAT_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.GIGACHAT_CLIENT_SECRET;
    this.scope = config.scope || 'GIGACHAT_API_PERS';
    this.model = config.model || 'GigaChat';
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        'GIGACHAT_CLIENT_ID и GIGACHAT_CLIENT_SECRET не установлены. Получите на developers.sber.ru'
      );
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        RqUID: this.generateUUID(),
      },
      body: `scope=${this.scope}`,
    });

    if (response.ok) {
      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_at - 60) * 1000;
      return this.accessToken;
    }

    throw new Error(`GigaChat auth error: ${response.status}`);
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  async generateHint(text, context = []) {
    try {
      const token = await this.getAccessToken();
      const systemPrompt = this.config.systemPrompt || SYSTEM_PROMPT;

      const messages = [{ role: 'system', content: systemPrompt }];
      for (const ctx of context.slice(-5)) {
        messages.push({ role: 'user', content: ctx });
      }
      messages.push({ role: 'user', content: `Транскрипт: ${text}\n\nДай подсказку:` });

      const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          max_tokens: this.config.maxTokens || 150,
          temperature: this.config.temperature || 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'Нет подсказки';
      }

      throw new Error(`GigaChat HTTP ${response.status}`);
    } catch (error) {
      if (error.message.includes('не установлены')) {
        return error.message;
      }
      throw error;
    }
  }
}

/**
 * Yandex GPT провайдер
 */
class YandexGPTProvider extends BaseLLMProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.YANDEX_API_KEY;
    this.folderId = config.folderId || process.env.YANDEX_FOLDER_ID;
    this.model = config.model || 'yandexgpt-lite';
  }

  async generateHint(text, context = []) {
    if (!this.apiKey) {
      return 'YANDEX_API_KEY не установлен. Получите на console.cloud.yandex.ru';
    }
    if (!this.folderId) {
      return 'YANDEX_FOLDER_ID не установлен. Укажите ID каталога из Yandex Cloud';
    }

    const systemPrompt = this.config.systemPrompt || SYSTEM_PROMPT;
    const messages = [{ role: 'system', text: systemPrompt }];
    for (const ctx of context.slice(-5)) {
      messages.push({ role: 'user', text: ctx });
    }
    messages.push({ role: 'user', text: `Транскрипт: ${text}\n\nДай подсказку:` });

    const modelUri = `gpt://${this.folderId}/${this.model}`;

    const response = await fetch(
      'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
      {
        method: 'POST',
        headers: {
          Authorization: `Api-Key ${this.apiKey}`,
          'Content-Type': 'application/json',
          'x-folder-id': this.folderId,
        },
        body: JSON.stringify({
          modelUri,
          completionOptions: {
            stream: false,
            temperature: this.config.temperature || 0.6,
            maxTokens: String(this.config.maxTokens || 150),
          },
          messages,
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.result?.alternatives?.[0]?.message?.text || 'Нет подсказки';
    }

    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Yandex GPT HTTP ${response.status}: ${errorData.message || 'Неизвестная ошибка'}`
    );
  }
}

/**
 * Mock провайдер для тестов
 */
class MockProvider extends BaseLLMProvider {
  constructor(config = {}) {
    super(config);
    this.responses = config.responses || ['Тестовая подсказка'];
    this.callIndex = 0;
  }

  async generateHint(text, context = []) {
    const response = this.responses[this.callIndex % this.responses.length];
    this.callIndex++;
    return response;
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
    openrouter: OpenRouterProvider,
    claude: ClaudeProvider,
    gigachat_free: (cfg) =>
      new GigaChatProvider({ ...cfg, scope: 'GIGACHAT_API_PERS', model: 'GigaChat' }),
    gigachat_max: (cfg) =>
      new GigaChatProvider({ ...cfg, scope: 'GIGACHAT_API_CORP', model: 'GigaChat-Max' }),
    yandex_lite: (cfg) => new YandexGPTProvider({ ...cfg, model: 'yandexgpt-lite' }),
    yandex_pro: (cfg) => new YandexGPTProvider({ ...cfg, model: 'yandexgpt' }),
    mock: MockProvider,
  };

  const providerOrClass = providers[name] || OllamaProvider;
  if (typeof providerOrClass === 'function' && providerOrClass.prototype) {
    return new providerOrClass(config);
  }
  return providerOrClass(config);
}

/**
 * Список доступных провайдеров
 */
const AVAILABLE_PROVIDERS = [
  { id: 'ollama', name: 'Ollama (локально)', requiresKey: false },
  { id: 'openai', name: 'OpenAI', requiresKey: true, envVars: ['OPENAI_API_KEY'] },
  { id: 'gemini', name: 'Gemini', requiresKey: true, envVars: ['GEMINI_API_KEY'] },
  { id: 'claude', name: 'Claude (Anthropic)', requiresKey: true, envVars: ['ANTHROPIC_API_KEY'] },
  { id: 'openrouter', name: 'OpenRouter', requiresKey: true, envVars: ['OPENROUTER_API_KEY'] },
  {
    id: 'gigachat_free',
    name: 'GigaChat Free (Freemium)',
    requiresKey: true,
    envVars: ['GIGACHAT_CLIENT_ID', 'GIGACHAT_CLIENT_SECRET'],
  },
  {
    id: 'gigachat_max',
    name: 'GigaChat Max (Paid)',
    requiresKey: true,
    envVars: ['GIGACHAT_CLIENT_ID', 'GIGACHAT_CLIENT_SECRET'],
  },
  {
    id: 'yandex_lite',
    name: 'Yandex Trial (Lite)',
    requiresKey: true,
    envVars: ['YANDEX_API_KEY', 'YANDEX_FOLDER_ID'],
  },
  {
    id: 'yandex_pro',
    name: 'Yandex Pro (Paid)',
    requiresKey: true,
    envVars: ['YANDEX_API_KEY', 'YANDEX_FOLDER_ID'],
  },
];

/**
 * AI Профили для разных сценариев
 */
const AI_PROFILES = {
  job_interview_ru: {
    id: 'job_interview_ru',
    name: 'Job interview (RU)',
    description: 'Короткие подсказки 1-3 пункта для собеседования',
    systemPrompt: `Ты ассистент для собеседований. Давай краткие подсказки на русском:
- Максимум 1-3 пункта
- Без воды и вступлений
- Конкретные формулировки ответов
- Если вопрос технический - ключевые тезисы`,
    maxTokens: 100,
    temperature: 0.3,
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    description: 'Пользовательские инструкции',
    systemPrompt: '',
    maxTokens: 500,
    temperature: 0.8,
  },
};

module.exports = {
  BaseLLMProvider,
  OllamaProvider,
  OpenAIProvider,
  GeminiProvider,
  OpenRouterProvider,
  ClaudeProvider,
  GigaChatProvider,
  YandexGPTProvider,
  MockProvider,
  createProvider,
  AVAILABLE_PROVIDERS,
  AI_PROFILES,
  SYSTEM_PROMPT,
};
