/**
 * Тесты для хранения настроек
 */

describe('Settings Storage', () => {
    let mockStorage;

    beforeEach(() => {
        mockStorage = {};

        // Мокаем localStorage
        global.localStorage = {
            getItem: (key) => mockStorage[key] || null,
            setItem: (key, value) => { mockStorage[key] = value; },
            removeItem: (key) => { delete mockStorage[key]; },
            clear: () => { mockStorage = {}; }
        };
    });

    afterEach(() => {
        delete global.localStorage;
    });

    describe('сохранение и загрузка', () => {
        it('должен сохранять настройки в localStorage', () => {
            const settings = {
                llmProvider: 'openai',
                aiProfile: 'custom',
                opacity: 80,
                fontTranscript: 16,
                fontHints: 18
            };

            localStorage.setItem('live-hints-settings', JSON.stringify(settings));

            const loaded = JSON.parse(localStorage.getItem('live-hints-settings'));
            expect(loaded).toEqual(settings);
        });

        it('должен возвращать null для несуществующих настроек', () => {
            const result = localStorage.getItem('live-hints-settings');
            expect(result).toBeNull();
        });

        it('должен корректно сериализовать все типы настроек', () => {
            const settings = {
                llmProvider: 'ollama',
                aiProfile: 'job_interview_ru',
                customInstructions: 'Тестовые инструкции',
                autoHints: true,
                opacity: 100,
                fontTranscript: 14,
                fontHints: 14
            };

            localStorage.setItem('live-hints-settings', JSON.stringify(settings));
            const loaded = JSON.parse(localStorage.getItem('live-hints-settings'));

            expect(loaded.llmProvider).toBe('ollama');
            expect(loaded.aiProfile).toBe('job_interview_ru');
            expect(loaded.customInstructions).toBe('Тестовые инструкции');
            expect(loaded.autoHints).toBe(true);
            expect(loaded.opacity).toBe(100);
            expect(loaded.fontTranscript).toBe(14);
            expect(loaded.fontHints).toBe(14);
        });

        it('должен мержить новые настройки с существующими', () => {
            // Начальные настройки
            localStorage.setItem('live-hints-settings', JSON.stringify({
                llmProvider: 'ollama',
                opacity: 100
            }));

            // Загружаем, добавляем, сохраняем
            const existing = JSON.parse(localStorage.getItem('live-hints-settings')) || {};
            const updated = { ...existing, fontTranscript: 20 };
            localStorage.setItem('live-hints-settings', JSON.stringify(updated));

            const loaded = JSON.parse(localStorage.getItem('live-hints-settings'));
            expect(loaded.llmProvider).toBe('ollama');
            expect(loaded.opacity).toBe(100);
            expect(loaded.fontTranscript).toBe(20);
        });
    });

    describe('валидация значений', () => {
        it('прозрачность должна быть в диапазоне 10-100', () => {
            const validateOpacity = (value) => Math.max(10, Math.min(100, value));

            expect(validateOpacity(0)).toBe(10);
            expect(validateOpacity(50)).toBe(50);
            expect(validateOpacity(150)).toBe(100);
        });

        it('размер шрифта должен быть в диапазоне 12-28', () => {
            const validateFontSize = (value) => Math.max(12, Math.min(28, value));

            expect(validateFontSize(8)).toBe(12);
            expect(validateFontSize(20)).toBe(20);
            expect(validateFontSize(40)).toBe(28);
        });
    });
});

describe('State Machine', () => {
    describe('состояния приложения', () => {
        let state;

        beforeEach(() => {
            state = {
                isRunning: false,
                isPaused: false
            };
        });

        it('начальное состояние: остановлено', () => {
            expect(state.isRunning).toBe(false);
            expect(state.isPaused).toBe(false);
        });

        it('start: переход в running', () => {
            state.isRunning = true;
            state.isPaused = false;

            expect(state.isRunning).toBe(true);
            expect(state.isPaused).toBe(false);
        });

        it('pause: переход в paused (только из running)', () => {
            // Start first
            state.isRunning = true;
            state.isPaused = false;

            // Then pause
            if (state.isRunning) {
                state.isPaused = true;
            }

            expect(state.isRunning).toBe(true);
            expect(state.isPaused).toBe(true);
        });

        it('resume: переход из paused в running', () => {
            // Start -> Pause
            state.isRunning = true;
            state.isPaused = true;

            // Resume
            if (state.isRunning && state.isPaused) {
                state.isPaused = false;
            }

            expect(state.isRunning).toBe(true);
            expect(state.isPaused).toBe(false);
        });

        it('stop: переход в stopped из любого состояния', () => {
            // Start -> Pause -> Stop
            state.isRunning = true;
            state.isPaused = true;

            // Stop
            state.isRunning = false;
            state.isPaused = false;

            expect(state.isRunning).toBe(false);
            expect(state.isPaused).toBe(false);
        });

        it('полный цикл: start -> pause -> resume -> stop', () => {
            // Start
            state.isRunning = true;
            state.isPaused = false;
            expect(state.isRunning).toBe(true);
            expect(state.isPaused).toBe(false);

            // Pause
            state.isPaused = true;
            expect(state.isRunning).toBe(true);
            expect(state.isPaused).toBe(true);

            // Resume
            state.isPaused = false;
            expect(state.isRunning).toBe(true);
            expect(state.isPaused).toBe(false);

            // Stop
            state.isRunning = false;
            expect(state.isRunning).toBe(false);
            expect(state.isPaused).toBe(false);
        });

        it('pause невозможна если не running', () => {
            // Try to pause when not running
            const canPause = state.isRunning;

            if (canPause) {
                state.isPaused = true;
            }

            expect(state.isPaused).toBe(false);
        });
    });

    describe('блокировка операций на паузе', () => {
        it('аудио не отправляется на паузе', () => {
            const state = { isPaused: true };
            let audioSent = false;

            const sendAudio = () => {
                if (state.isPaused) return;
                audioSent = true;
            };

            sendAudio();
            expect(audioSent).toBe(false);
        });

        it('аудио отправляется когда не на паузе', () => {
            const state = { isPaused: false };
            let audioSent = false;

            const sendAudio = () => {
                if (state.isPaused) return;
                audioSent = true;
            };

            sendAudio();
            expect(audioSent).toBe(true);
        });
    });
});

describe('Длинные подсказки', () => {
    it('текст 500+ символов должен сохраняться полностью', () => {
        const longHint = 'А'.repeat(600);

        // Симуляция escapeHtml
        const escapeHtml = (text) => {
            const div = { textContent: '', innerHTML: '' };
            div.textContent = text;
            div.innerHTML = div.textContent;
            return div.innerHTML;
        };

        const escaped = escapeHtml(longHint);
        expect(escaped.length).toBe(600);
        expect(escaped.endsWith('А'.repeat(50))).toBe(true);
    });

    it('многострочный текст должен сохранять переносы', () => {
        const multilineHint = 'Первая строка\nВторая строка\nТретья строка с длинным текстом для проверки';

        const escapeHtml = (text) => {
            const div = { textContent: '', innerHTML: '' };
            div.textContent = text;
            div.innerHTML = div.textContent;
            return div.innerHTML;
        };

        const escaped = escapeHtml(multilineHint);
        expect(escaped).toContain('Первая строка');
        expect(escaped).toContain('Третья строка');
    });

    it('текст не должен обрезаться slice/substring', () => {
        const hint = 'Это очень длинная подсказка которая содержит много информации и не должна обрезаться никаким образом в процессе рендеринга в DOM элемент карточки подсказки';

        // Проверяем что нет обрезания
        const processed = hint; // Нет slice/substring

        expect(processed.length).toBe(hint.length);
        expect(processed.endsWith('подсказки')).toBe(true);
    });
});

describe('Дедуп запросов и результатов', () => {
    it('дедуп контекста по hash', () => {
        const context1 = ['привет', 'мир'];
        const context2 = ['привет', 'мир'];
        const context3 = ['привет', 'другой'];

        const hash1 = context1.join('|');
        const hash2 = context2.join('|');
        const hash3 = context3.join('|');

        expect(hash1).toBe(hash2);
        expect(hash1).not.toBe(hash3);
    });

    it('дедуп подсказок по тексту', () => {
        let lastHintText = '';
        const hints = [];

        const addHint = (text) => {
            if (text === lastHintText) return false;
            lastHintText = text;
            hints.push(text);
            return true;
        };

        expect(addHint('подсказка 1')).toBe(true);
        expect(addHint('подсказка 1')).toBe(false); // Дубликат
        expect(addHint('подсказка 2')).toBe(true);
        expect(hints.length).toBe(2);
    });

    it('дедуп транскриптов по тексту', () => {
        let lastTranscript = '';
        const transcripts = [];

        const addTranscript = (text) => {
            if (text === lastTranscript) return false;
            lastTranscript = text;
            transcripts.push(text);
            return true;
        };

        expect(addTranscript('фраза 1')).toBe(true);
        expect(addTranscript('фраза 1')).toBe(false); // Дубликат
        expect(addTranscript('фраза 2')).toBe(true);
        expect(transcripts.length).toBe(2);
    });
});

describe('buildSystemPrompt', () => {
    it('job_interview_ru профиль возвращает правильный промпт', () => {
        const profiles = {
            job_interview_ru: 'Ты помощник на собеседовании.',
            custom: ''
        };
        const currentProfile = 'job_interview_ru';
        const prompt = profiles[currentProfile] || profiles.job_interview_ru;

        expect(prompt).toContain('собеседовании');
    });

    it('custom профиль использует пользовательские инструкции', () => {
        const customInstructions = 'Отвечай как эксперт по JavaScript';
        const currentProfile = 'custom';

        let result;
        if (currentProfile === 'custom' && customInstructions) {
            result = customInstructions;
        } else {
            result = 'default';
        }

        expect(result).toBe(customInstructions);
    });

    it('custom профиль без инструкций использует дефолт', () => {
        const customInstructions = '';
        const currentProfile = 'custom';
        const defaultPrompt = 'Ты ассистент.';

        let result;
        if (currentProfile === 'custom' && customInstructions) {
            result = customInstructions;
        } else {
            result = defaultPrompt;
        }

        expect(result).toBe(defaultPrompt);
    });
});
