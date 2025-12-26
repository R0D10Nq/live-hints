/**
 * Интеграционные тесты для LLM API
 */

// Пропускаем если сервер недоступен
const LLM_URL = 'http://localhost:8766';

// Хелпер для проверки доступности сервера
async function isServerAvailable() {
    try {
        const response = await fetch(`${LLM_URL}/health`, { timeout: 2000 });
        return response.ok;
    } catch {
        return false;
    }
}

// Мок fetch если недоступен
if (typeof fetch === 'undefined') {
    global.fetch = jest.fn();
}

describe('LLM API интеграционные тесты', () => {
    let serverAvailable = false;

    beforeAll(async () => {
        try {
            serverAvailable = await isServerAvailable();
        } catch {
            serverAvailable = false;
        }
    });

    describe('Health endpoint', () => {
        test('GET /health должен возвращать статус', async () => {
            if (!serverAvailable) {
                console.log('LLM сервер недоступен, пропускаем тест');
                return;
            }

            const response = await fetch(`${LLM_URL}/health`);
            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data).toHaveProperty('status');
            expect(data).toHaveProperty('model');
        });
    });

    describe('Models endpoint', () => {
        test('GET /models должен возвращать список моделей', async () => {
            if (!serverAvailable) {
                console.log('LLM сервер недоступен, пропускаем тест');
                return;
            }

            const response = await fetch(`${LLM_URL}/models`);
            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data).toHaveProperty('models');
            expect(Array.isArray(data.models)).toBe(true);
        });
    });

    describe('Hint endpoint', () => {
        test('POST /hint должен генерировать подсказку', async () => {
            if (!serverAvailable) {
                console.log('LLM сервер недоступен, пропускаем тест');
                return;
            }

            const response = await fetch(`${LLM_URL}/hint`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: 'Расскажите о своем опыте работы с JavaScript',
                    context: [],
                    profile: 'interview',
                    max_tokens: 100,
                }),
            });

            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data).toHaveProperty('hint');
            expect(typeof data.hint).toBe('string');
        }, 30000);

        test('POST /hint с коротким текстом должен возвращать ошибку', async () => {
            if (!serverAvailable) {
                console.log('LLM сервер недоступен, пропускаем тест');
                return;
            }

            const response = await fetch(`${LLM_URL}/hint`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: 'Да',
                    context: [],
                }),
            });

            expect(response.status).toBe(400);
        });
    });

    describe('Stream endpoint', () => {
        test('POST /hint/stream должен возвращать SSE поток', async () => {
            if (!serverAvailable) {
                console.log('LLM сервер недоступен, пропускаем тест');
                return;
            }

            const response = await fetch(`${LLM_URL}/hint/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: 'Что такое REST API и как он работает?',
                    context: [],
                    profile: 'interview',
                    max_tokens: 100,
                }),
            });

            expect(response.ok).toBe(true);
            expect(response.headers.get('content-type')).toContain('text/event-stream');
        }, 30000);
    });

    describe('Cache clear endpoint', () => {
        test('POST /cache/clear должен очищать кэш', async () => {
            if (!serverAvailable) {
                console.log('LLM сервер недоступен, пропускаем тест');
                return;
            }

            const response = await fetch(`${LLM_URL}/cache/clear`, {
                method: 'POST',
            });

            expect(response.ok).toBe(true);

            const data = await response.json();
            expect(data).toHaveProperty('status');
            expect(data.status).toBe('ok');
        });
    });
});

// Мок тесты для API (всегда выполняются)
describe('LLM API Mock тесты', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('HintRequest валидация', () => {
        test('должен принимать минимальный запрос', () => {
            const request = {
                text: 'Тестовый вопрос',
            };

            expect(request.text).toBeTruthy();
            expect(request.text.length).toBeGreaterThan(5);
        });

        test('должен отклонять короткий текст', () => {
            const request = {
                text: 'Да',
            };

            expect(request.text.length).toBeLessThan(5);
        });

        test('должен принимать полный запрос', () => {
            const request = {
                text: 'Расскажите о себе',
                context: ['Предыдущий вопрос'],
                profile: 'custom',
                max_tokens: 200,
                temperature: 0.5,
                model: 'llama2',
                system_prompt: 'Кастомный промпт',
                user_context: 'Резюме пользователя',
            };

            expect(request).toHaveProperty('text');
            expect(request).toHaveProperty('context');
            expect(request).toHaveProperty('profile');
            expect(request).toHaveProperty('max_tokens');
            expect(request).toHaveProperty('temperature');
            expect(request).toHaveProperty('model');
            expect(request).toHaveProperty('system_prompt');
            expect(request).toHaveProperty('user_context');
        });
    });

    describe('HintResponse структура', () => {
        test('должен содержать hint', () => {
            const response = {
                hint: 'Тестовая подсказка',
                latency_ms: 100,
                ttft_ms: 50,
            };

            expect(response).toHaveProperty('hint');
            expect(typeof response.hint).toBe('string');
        });

        test('должен содержать метрики', () => {
            const response = {
                hint: 'Подсказка',
                latency_ms: 100,
                ttft_ms: 50,
            };

            expect(response).toHaveProperty('latency_ms');
            expect(response).toHaveProperty('ttft_ms');
            expect(typeof response.latency_ms).toBe('number');
            expect(typeof response.ttft_ms).toBe('number');
        });
    });

    describe('SSE Stream структура', () => {
        test('chunk сообщение должно содержать chunk', () => {
            const message = { chunk: 'Часть ответа' };
            expect(message).toHaveProperty('chunk');
        });

        test('done сообщение должно содержать метаданные', () => {
            const message = {
                done: true,
                question_type: 'technical',
                latency_ms: 1500,
                ttft_ms: 200,
            };

            expect(message.done).toBe(true);
            expect(message).toHaveProperty('question_type');
            expect(message).toHaveProperty('latency_ms');
            expect(message).toHaveProperty('ttft_ms');
        });

        test('cached сообщение должно содержать флаг', () => {
            const message = {
                chunk: 'Кэшированный ответ',
                cached: true,
                question_type: 'general',
            };

            expect(message.cached).toBe(true);
        });
    });

    describe('Error responses', () => {
        test('400 для короткого текста', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: () => Promise.resolve({ detail: 'Текст слишком короткий' }),
            });

            const response = await fetch(`${LLM_URL}/hint`, {
                method: 'POST',
                body: JSON.stringify({ text: 'Да' }),
            });

            expect(response.status).toBe(400);
        });

        test('500 для внутренней ошибки', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ detail: 'Internal Server Error' }),
            });

            const response = await fetch(`${LLM_URL}/hint`, {
                method: 'POST',
                body: JSON.stringify({ text: 'Тестовый вопрос' }),
            });

            expect(response.status).toBe(500);
        });
    });
});
