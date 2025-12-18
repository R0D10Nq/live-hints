/**
 * Unit тесты для SessionStore
 */

const { SessionStore, MemoryStorage } = require('../../src/storage/session-store');

describe('SessionStore', () => {
    let store;
    let storage;

    beforeEach(() => {
        storage = new MemoryStorage();
        store = new SessionStore(storage);
    });

    afterEach(() => {
        storage.clear();
    });

    describe('createSession', () => {
        test('должен создавать сессию с уникальным ID', () => {
            const session1 = store.createSession();
            const session2 = store.createSession();

            expect(session1.id).toBeDefined();
            expect(session2.id).toBeDefined();
            expect(session1.id).not.toBe(session2.id);
        });

        test('должен создавать сессию с правильной структурой', () => {
            const session = store.createSession();

            expect(session).toHaveProperty('id');
            expect(session).toHaveProperty('createdAt');
            expect(session).toHaveProperty('updatedAt');
            expect(session).toHaveProperty('transcript');
            expect(session).toHaveProperty('hints');
            expect(session).toHaveProperty('metadata');
            expect(Array.isArray(session.transcript)).toBe(true);
            expect(Array.isArray(session.hints)).toBe(true);
        });

        test('должен устанавливать дефолтный провайдер', () => {
            const session = store.createSession();
            expect(session.metadata.provider).toBe('ollama');
        });
    });

    describe('saveSession', () => {
        test('должен сохранять новую сессию', () => {
            const session = store.createSession();
            store.saveSession(session);

            const saved = store.getSession(session.id);
            expect(saved).not.toBeNull();
            expect(saved.id).toBe(session.id);
        });

        test('должен обновлять существующую сессию', () => {
            const session = store.createSession();
            store.saveSession(session);

            session.metadata.provider = 'openai';
            store.saveSession(session);

            const saved = store.getSession(session.id);
            expect(saved.metadata.provider).toBe('openai');
        });

        test('должен выбрасывать ошибку для невалидной сессии', () => {
            expect(() => store.saveSession(null)).toThrow('Невалидная сессия');
            expect(() => store.saveSession({})).toThrow('Невалидная сессия');
        });

        test('должен ограничивать количество сессий', () => {
            store.maxSessions = 5;

            for (let i = 0; i < 10; i++) {
                const session = store.createSession();
                store.saveSession(session);
            }

            const allSessions = store.getAllSessions();
            expect(allSessions.length).toBe(5);
        });
    });

    describe('getSession', () => {
        test('должен возвращать сессию по ID', () => {
            const session = store.createSession();
            store.saveSession(session);

            const found = store.getSession(session.id);
            expect(found).not.toBeNull();
            expect(found.id).toBe(session.id);
        });

        test('должен возвращать null для несуществующей сессии', () => {
            const found = store.getSession('non-existent-id');
            expect(found).toBeNull();
        });
    });

    describe('getAllSessions', () => {
        test('должен возвращать пустой массив если сессий нет', () => {
            const sessions = store.getAllSessions();
            expect(sessions).toEqual([]);
        });

        test('должен возвращать все сессии', () => {
            for (let i = 0; i < 3; i++) {
                const session = store.createSession();
                store.saveSession(session);
            }

            const sessions = store.getAllSessions();
            expect(sessions.length).toBe(3);
        });

        test('новые сессии должны быть первыми', () => {
            const session1 = store.createSession();
            store.saveSession(session1);

            const session2 = store.createSession();
            store.saveSession(session2);

            const sessions = store.getAllSessions();
            expect(sessions[0].id).toBe(session2.id);
            expect(sessions[1].id).toBe(session1.id);
        });
    });

    describe('deleteSession', () => {
        test('должен удалять сессию', () => {
            const session = store.createSession();
            store.saveSession(session);

            const deleted = store.deleteSession(session.id);
            expect(deleted).toBe(true);

            const found = store.getSession(session.id);
            expect(found).toBeNull();
        });

        test('должен возвращать false для несуществующей сессии', () => {
            const deleted = store.deleteSession('non-existent-id');
            expect(deleted).toBe(false);
        });
    });

    describe('addTranscript', () => {
        test('должен добавлять транскрипт в сессию', () => {
            const session = store.createSession();
            store.saveSession(session);

            store.addTranscript(session.id, 'Привет, как дела?');

            const updated = store.getSession(session.id);
            expect(updated.transcript.length).toBe(1);
            expect(updated.transcript[0].text).toBe('Привет, как дела?');
        });

        test('должен добавлять timestamp', () => {
            const session = store.createSession();
            store.saveSession(session);

            store.addTranscript(session.id, 'Тест');

            const updated = store.getSession(session.id);
            expect(updated.transcript[0].timestamp).toBeDefined();
        });

        test('должен выбрасывать ошибку для несуществующей сессии', () => {
            expect(() => store.addTranscript('non-existent', 'text')).toThrow('Сессия не найдена');
        });
    });

    describe('addHint', () => {
        test('должен добавлять подсказку в сессию', () => {
            const session = store.createSession();
            store.saveSession(session);

            store.addHint(session.id, 'Уточните сроки');

            const updated = store.getSession(session.id);
            expect(updated.hints.length).toBe(1);
            expect(updated.hints[0].text).toBe('Уточните сроки');
        });

        test('должен выбрасывать ошибку для несуществующей сессии', () => {
            expect(() => store.addHint('non-existent', 'hint')).toThrow('Сессия не найдена');
        });
    });

    describe('updateMetadata', () => {
        test('должен обновлять метаданные', () => {
            const session = store.createSession();
            store.saveSession(session);

            store.updateMetadata(session.id, { provider: 'gemini', duration: 120 });

            const updated = store.getSession(session.id);
            expect(updated.metadata.provider).toBe('gemini');
            expect(updated.metadata.duration).toBe(120);
        });
    });

    describe('clearAll', () => {
        test('должен очищать все сессии', () => {
            for (let i = 0; i < 5; i++) {
                const session = store.createSession();
                store.saveSession(session);
            }

            store.clearAll();

            const sessions = store.getAllSessions();
            expect(sessions.length).toBe(0);
        });
    });

    describe('exportSession', () => {
        test('должен экспортировать сессию в текст', () => {
            const session = store.createSession();
            store.saveSession(session);
            store.addTranscript(session.id, 'Привет');
            store.addHint(session.id, 'Подсказка');

            const exported = store.exportSession(session.id);

            expect(exported).toContain('ТРАНСКРИПТ');
            expect(exported).toContain('ПОДСКАЗКИ');
            expect(exported).toContain('Привет');
            expect(exported).toContain('Подсказка');
        });

        test('должен возвращать null для несуществующей сессии', () => {
            const exported = store.exportSession('non-existent');
            expect(exported).toBeNull();
        });
    });
});

describe('MemoryStorage', () => {
    let storage;

    beforeEach(() => {
        storage = new MemoryStorage();
    });

    test('должен сохранять и получать данные', () => {
        storage.setItem('key', 'value');
        expect(storage.getItem('key')).toBe('value');
    });

    test('должен возвращать null для несуществующего ключа', () => {
        expect(storage.getItem('non-existent')).toBeNull();
    });

    test('должен удалять данные', () => {
        storage.setItem('key', 'value');
        storage.removeItem('key');
        expect(storage.getItem('key')).toBeNull();
    });

    test('должен очищать все данные', () => {
        storage.setItem('key1', 'value1');
        storage.setItem('key2', 'value2');
        storage.clear();
        expect(storage.getItem('key1')).toBeNull();
        expect(storage.getItem('key2')).toBeNull();
    });
});
