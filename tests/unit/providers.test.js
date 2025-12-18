/**
 * Тесты для LLM провайдеров
 */

const {
    createProvider,
    MockProvider,
    AVAILABLE_PROVIDERS,
    AI_PROFILES
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
                responses: ['Ответ 1', 'Ответ 2']
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

            const ids = AVAILABLE_PROVIDERS.map(p => p.id);
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
            const ollama = AVAILABLE_PROVIDERS.find(p => p.id === 'ollama');
            expect(ollama.requiresKey).toBe(false);

            const openai = AVAILABLE_PROVIDERS.find(p => p.id === 'openai');
            expect(openai.requiresKey).toBe(true);
            expect(openai.envVars).toContain('OPENAI_API_KEY');

            const gigachat = AVAILABLE_PROVIDERS.find(p => p.id === 'gigachat_free');
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
            // Сохраняем и очищаем env переменную
            const originalKey = process.env.GEMINI_API_KEY;
            delete process.env.GEMINI_API_KEY;

            const provider = createProvider('gemini', { apiKey: undefined });
            const hint = await provider.generateHint('тест');
            expect(hint).toContain('GEMINI_API_KEY не установлен');

            // Восстанавливаем
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
    });
});
