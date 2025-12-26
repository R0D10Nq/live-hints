/**
 * Тесты для LLM провайдеров
 */

const {
  createProvider,
  MockProvider,
  AVAILABLE_PROVIDERS,
  AI_PROFILES,
} = require('../../src/llm/providers');

describe('LLM Providers', () => {
  describe('createProvider', () => {
    it('должен создавать Ollama провайдер по умолчанию', () => {
      const provider = createProvider('ollama');
      expect(provider).toBeDefined();
      expect(provider.constructor.name).toBe('OllamaProvider');
    });

    it('должен создавать OpenAI провайдер', () => {
      const provider = createProvider('openai');
      expect(provider).toBeDefined();
      expect(provider.constructor.name).toBe('OpenAIProvider');
    });

    it('должен создавать Gemini провайдер', () => {
      const provider = createProvider('gemini');
      expect(provider).toBeDefined();
      expect(provider.constructor.name).toBe('GeminiProvider');
    });

    it('должен создавать Claude провайдер', () => {
      const provider = createProvider('claude');
      expect(provider).toBeDefined();
      expect(provider.constructor.name).toBe('ClaudeProvider');
    });

    it('должен создавать GigaChat Free провайдер', () => {
      const provider = createProvider('gigachat_free');
      expect(provider).toBeDefined();
      expect(provider.constructor.name).toBe('GigaChatProvider');
      expect(provider.scope).toBe('GIGACHAT_API_PERS');
    });

    it('должен создавать GigaChat Max провайдер', () => {
      const provider = createProvider('gigachat_max');
      expect(provider).toBeDefined();
      expect(provider.constructor.name).toBe('GigaChatProvider');
      expect(provider.scope).toBe('GIGACHAT_API_CORP');
    });

    it('должен создавать Yandex Lite провайдер', () => {
      const provider = createProvider('yandex_lite');
      expect(provider).toBeDefined();
      expect(provider.constructor.name).toBe('YandexGPTProvider');
      expect(provider.model).toBe('yandexgpt-lite');
    });

    it('должен создавать Yandex Pro провайдер', () => {
      const provider = createProvider('yandex_pro');
      expect(provider).toBeDefined();
      expect(provider.constructor.name).toBe('YandexGPTProvider');
      expect(provider.model).toBe('yandexgpt');
    });

    it('должен создавать Mock провайдер', () => {
      const provider = createProvider('mock');
      expect(provider).toBeDefined();
      expect(provider.constructor.name).toBe('MockProvider');
    });

    it('должен возвращать Ollama для неизвестного провайдера', () => {
      const provider = createProvider('unknown');
      expect(provider.constructor.name).toBe('OllamaProvider');
    });
  });

  describe('MockProvider', () => {
    it('должен возвращать заданные ответы', async () => {
      const provider = new MockProvider({
        responses: ['Ответ 1', 'Ответ 2'],
      });

      const hint1 = await provider.generateHint('тест');
      expect(hint1).toBe('Ответ 1');

      const hint2 = await provider.generateHint('тест');
      expect(hint2).toBe('Ответ 2');

      const hint3 = await provider.generateHint('тест');
      expect(hint3).toBe('Ответ 1'); // Цикл
    });
  });

  describe('AVAILABLE_PROVIDERS', () => {
    it('должен содержать все провайдеры', () => {
      expect(AVAILABLE_PROVIDERS.length).toBe(9);

      const ids = AVAILABLE_PROVIDERS.map((p) => p.id);
      expect(ids).toContain('ollama');
      expect(ids).toContain('openai');
      expect(ids).toContain('gemini');
      expect(ids).toContain('claude');
      expect(ids).toContain('openrouter');
      expect(ids).toContain('gigachat_free');
      expect(ids).toContain('gigachat_max');
      expect(ids).toContain('yandex_lite');
      expect(ids).toContain('yandex_pro');
    });

    it('должен указывать требования к ключам', () => {
      const ollama = AVAILABLE_PROVIDERS.find((p) => p.id === 'ollama');
      expect(ollama.requiresKey).toBe(false);

      const openai = AVAILABLE_PROVIDERS.find((p) => p.id === 'openai');
      expect(openai.requiresKey).toBe(true);
      expect(openai.envVars).toContain('OPENAI_API_KEY');

      const gigachat = AVAILABLE_PROVIDERS.find((p) => p.id === 'gigachat_free');
      expect(gigachat.requiresKey).toBe(true);
      expect(gigachat.envVars).toContain('GIGACHAT_CLIENT_ID');
      expect(gigachat.envVars).toContain('GIGACHAT_CLIENT_SECRET');
    });
  });

  describe('AI_PROFILES', () => {
    it('должен содержать профиль job_interview_ru', () => {
      expect(AI_PROFILES.job_interview_ru).toBeDefined();
      expect(AI_PROFILES.job_interview_ru.name).toBe('Job interview (RU)');
      expect(AI_PROFILES.job_interview_ru.maxTokens).toBe(100);
      expect(AI_PROFILES.job_interview_ru.temperature).toBe(0.3);
    });

    it('должен содержать профиль custom', () => {
      expect(AI_PROFILES.custom).toBeDefined();
      expect(AI_PROFILES.custom.name).toBe('Custom');
      expect(AI_PROFILES.custom.systemPrompt).toBe('');
    });
  });

  describe('Провайдеры без ключей', () => {
    it('OpenAI должен возвращать ошибку без ключа', async () => {
      const provider = createProvider('openai', { apiKey: null });
      const hint = await provider.generateHint('тест');
      expect(hint).toContain('OPENAI_API_KEY не установлен');
    });

    it('Gemini должен возвращать ошибку без ключа', async () => {
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const provider = createProvider('gemini', { apiKey: undefined });
      const hint = await provider.generateHint('тест');
      expect(hint).toContain('GEMINI_API_KEY не установлен');

      if (originalKey) process.env.GEMINI_API_KEY = originalKey;
    });

    it('Claude должен возвращать ошибку без ключа', async () => {
      const provider = createProvider('claude', { apiKey: null });
      const hint = await provider.generateHint('тест');
      expect(hint).toContain('ANTHROPIC_API_KEY не установлен');
    });

    it('Yandex должен возвращать ошибку без ключа', async () => {
      const provider = createProvider('yandex_lite', { apiKey: null });
      const hint = await provider.generateHint('тест');
      expect(hint).toContain('YANDEX_API_KEY не установлен');
    });

    it('Yandex должен возвращать ошибку без folder ID', async () => {
      const provider = createProvider('yandex_lite', { apiKey: 'test-key', folderId: null });
      const hint = await provider.generateHint('тест');
      expect(hint).toContain('YANDEX_FOLDER_ID не установлен');
    });

    it('OpenRouter должен возвращать ошибку без ключа', async () => {
      const provider = createProvider('openrouter', { apiKey: null });
      const hint = await provider.generateHint('тест');
      expect(hint).toContain('OPENROUTER_API_KEY не установлен');
    });
  });

  describe('BaseLLMProvider', () => {
    const { BaseLLMProvider } = require('../../src/llm/providers');

    it('должен выбрасывать ошибку при вызове generateHint', async () => {
      const provider = new BaseLLMProvider();
      await expect(provider.generateHint('тест')).rejects.toThrow('Метод не реализован');
    });

    it('должен строить messages корректно', () => {
      const provider = new BaseLLMProvider();
      const messages = provider.buildMessages('тест', ['контекст1', 'контекст2']);

      expect(messages[0].role).toBe('system');
      expect(messages.length).toBe(4); // system + 2 context + user
      expect(messages[messages.length - 1].content).toContain('тест');
    });

    it('должен ограничивать контекст 5 элементами', () => {
      const provider = new BaseLLMProvider();
      const context = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'];
      const messages = provider.buildMessages('тест', context);

      // system + 5 context + user = 7
      expect(messages.length).toBe(7);
    });
  });

  describe('OllamaProvider', () => {
    const { OllamaProvider } = require('../../src/llm/providers');

    it('должен использовать дефолтные значения', () => {
      const provider = new OllamaProvider();
      expect(provider.baseUrl).toBe('http://localhost:11434');
      expect(provider.model).toBe('qwen2.5:7b');
    });

    it('должен принимать кастомные значения', () => {
      const provider = new OllamaProvider({
        baseUrl: 'http://custom:1234',
        model: 'llama2',
      });
      expect(provider.baseUrl).toBe('http://custom:1234');
      expect(provider.model).toBe('llama2');
    });

    it('должен обрабатывать fetch ошибку', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed'));

      const provider = new OllamaProvider();
      const hint = await provider.generateHint('тест');
      expect(hint).toContain('Ollama не запущен');
    });

    it('должен обрабатывать успешный ответ', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: { content: 'Подсказка' } }),
      });

      const provider = new OllamaProvider();
      const hint = await provider.generateHint('тест');
      expect(hint).toBe('Подсказка');
    });

    it('должен обрабатывать HTTP ошибку', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const provider = new OllamaProvider();
      await expect(provider.generateHint('тест')).rejects.toThrow('HTTP 500');
    });

    it('должен возвращать "Нет подсказки" если content пустой', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: {} }),
      });

      const provider = new OllamaProvider();
      const hint = await provider.generateHint('тест');
      expect(hint).toBe('Нет подсказки');
    });
  });

  describe('OpenAIProvider', () => {
    const { OpenAIProvider } = require('../../src/llm/providers');

    it('должен обрабатывать успешный ответ', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'OpenAI подсказка' } }],
        }),
      });

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const hint = await provider.generateHint('тест');
      expect(hint).toBe('OpenAI подсказка');
    });

    it('должен обрабатывать HTTP ошибку', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      await expect(provider.generateHint('тест')).rejects.toThrow('OpenAI HTTP 401');
    });
  });

  describe('GeminiProvider', () => {
    const { GeminiProvider } = require('../../src/llm/providers');

    it('должен обрабатывать успешный ответ', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Gemini подсказка' }] } }],
        }),
      });

      const provider = new GeminiProvider({ apiKey: 'test-key' });
      const hint = await provider.generateHint('тест');
      expect(hint).toBe('Gemini подсказка');
    });

    it('должен обрабатывать ответ с контекстом', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Подсказка' }] } }],
        }),
      });

      const provider = new GeminiProvider({ apiKey: 'test-key' });
      const hint = await provider.generateHint('тест', ['контекст1', 'контекст2']);
      expect(hint).toBe('Подсказка');
    });

    it('должен обрабатывать HTTP ошибку', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
      });

      const provider = new GeminiProvider({ apiKey: 'test-key' });
      await expect(provider.generateHint('тест')).rejects.toThrow('Gemini HTTP 403');
    });
  });

  describe('OpenRouterProvider', () => {
    const { OpenRouterProvider } = require('../../src/llm/providers');

    it('должен обрабатывать успешный ответ', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'OpenRouter подсказка' } }],
        }),
      });

      const provider = new OpenRouterProvider({ apiKey: 'test-key' });
      const hint = await provider.generateHint('тест');
      expect(hint).toBe('OpenRouter подсказка');
    });

    it('должен обрабатывать HTTP ошибку', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
      });

      const provider = new OpenRouterProvider({ apiKey: 'test-key' });
      await expect(provider.generateHint('тест')).rejects.toThrow('OpenRouter HTTP 429');
    });
  });

  describe('ClaudeProvider', () => {
    const { ClaudeProvider } = require('../../src/llm/providers');

    it('должен обрабатывать успешный ответ', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Claude подсказка' }],
        }),
      });

      const provider = new ClaudeProvider({ apiKey: 'test-key' });
      const hint = await provider.generateHint('тест');
      expect(hint).toBe('Claude подсказка');
    });

    it('должен обрабатывать ответ с контекстом', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Подсказка' }],
        }),
      });

      const provider = new ClaudeProvider({ apiKey: 'test-key' });
      const hint = await provider.generateHint('тест', ['контекст']);
      expect(hint).toBe('Подсказка');
    });

    it('должен обрабатывать HTTP ошибку с сообщением', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: { message: 'Bad request' } }),
      });

      const provider = new ClaudeProvider({ apiKey: 'test-key' });
      await expect(provider.generateHint('тест')).rejects.toThrow('Claude HTTP 400: Bad request');
    });

    it('должен обрабатывать HTTP ошибку без сообщения', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('parse error')),
      });

      const provider = new ClaudeProvider({ apiKey: 'test-key' });
      await expect(provider.generateHint('тест')).rejects.toThrow('Claude HTTP 500');
    });
  });

  describe('GigaChatProvider', () => {
    const { GigaChatProvider } = require('../../src/llm/providers');

    it('должен генерировать UUID', () => {
      const provider = new GigaChatProvider();
      const uuid = provider.generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('должен возвращать ошибку без credentials', async () => {
      const provider = new GigaChatProvider({ clientId: null, clientSecret: null });
      const hint = await provider.generateHint('тест');
      expect(hint).toContain('не установлены');
    });

    it('должен использовать кэшированный токен', async () => {
      const provider = new GigaChatProvider({
        clientId: 'test-id',
        clientSecret: 'test-secret',
      });
      provider.accessToken = 'cached-token';
      provider.tokenExpiry = Date.now() + 60000;

      const token = await provider.getAccessToken();
      expect(token).toBe('cached-token');
    });

    it('должен обрабатывать успешную генерацию', async () => {
      const provider = new GigaChatProvider({
        clientId: 'test-id',
        clientSecret: 'test-secret',
      });
      provider.accessToken = 'test-token';
      provider.tokenExpiry = Date.now() + 60000;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'GigaChat подсказка' } }],
        }),
      });

      const hint = await provider.generateHint('тест');
      expect(hint).toBe('GigaChat подсказка');
    });

    it('должен обрабатывать ошибку авторизации', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      const provider = new GigaChatProvider({
        clientId: 'test-id',
        clientSecret: 'test-secret',
      });
      provider.accessToken = null;
      provider.tokenExpiry = 0;

      await expect(provider.getAccessToken()).rejects.toThrow('GigaChat auth error: 401');
    });

    it('должен обрабатывать успешную авторизацию', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
      });

      const provider = new GigaChatProvider({
        clientId: 'test-id',
        clientSecret: 'test-secret',
      });

      const token = await provider.getAccessToken();
      expect(token).toBe('new-token');
    });

    it('должен обрабатывать HTTP ошибку генерации', async () => {
      const provider = new GigaChatProvider({
        clientId: 'test-id',
        clientSecret: 'test-secret',
      });
      provider.accessToken = 'test-token';
      provider.tokenExpiry = Date.now() + 60000;

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(provider.generateHint('тест')).rejects.toThrow('GigaChat HTTP 500');
    });

    it('должен добавлять контекст в messages', async () => {
      const provider = new GigaChatProvider({
        clientId: 'test-id',
        clientSecret: 'test-secret',
      });
      provider.accessToken = 'test-token';
      provider.tokenExpiry = Date.now() + 60000;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Подсказка' } }],
        }),
      });

      await provider.generateHint('тест', ['ctx1', 'ctx2', 'ctx3']);

      const fetchCall = global.fetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.messages.length).toBeGreaterThan(2);
    });
  });

  describe('YandexGPTProvider', () => {
    const { YandexGPTProvider } = require('../../src/llm/providers');

    it('должен обрабатывать успешный ответ', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: {
            alternatives: [{ message: { text: 'Yandex подсказка' } }],
          },
        }),
      });

      const provider = new YandexGPTProvider({ apiKey: 'test-key', folderId: 'test-folder' });
      const hint = await provider.generateHint('тест');
      expect(hint).toBe('Yandex подсказка');
    });

    it('должен обрабатывать HTTP ошибку с сообщением', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Bad request' }),
      });

      const provider = new YandexGPTProvider({ apiKey: 'test-key', folderId: 'test-folder' });
      await expect(provider.generateHint('тест')).rejects.toThrow('Yandex GPT HTTP 400: Bad request');
    });

    it('должен обрабатывать HTTP ошибку без сообщения', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('parse error')),
      });

      const provider = new YandexGPTProvider({ apiKey: 'test-key', folderId: 'test-folder' });
      await expect(provider.generateHint('тест')).rejects.toThrow('Yandex GPT HTTP 500');
    });

    it('должен добавлять контекст в messages', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: {
            alternatives: [{ message: { text: 'Подсказка' } }],
          },
        }),
      });

      const provider = new YandexGPTProvider({ apiKey: 'test-key', folderId: 'test-folder' });
      await provider.generateHint('тест', ['ctx1', 'ctx2', 'ctx3']);

      const fetchCall = global.fetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.messages.length).toBeGreaterThan(2);
    });
  });
});
