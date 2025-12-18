/**
 * SessionStore - Хранилище сессий
 * Управляет историей транскриптов и подсказок
 */

const { v4: uuidv4 } = require('uuid');

class SessionStore {
    constructor(storage = null) {
        // Позволяет инжектить storage для тестов
        this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : new MemoryStorage());
        this.storageKey = 'live-hints-sessions';
        this.maxSessions = 50;
    }

    /**
     * Создаёт новую сессию
     * @returns {Object} Новая сессия
     */
    createSession() {
        const session = {
            id: uuidv4(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            transcript: [],
            hints: [],
            metadata: {
                provider: 'ollama',
                duration: 0
            }
        };
        return session;
    }

    /**
     * Сохраняет сессию
     * @param {Object} session - Сессия для сохранения
     */
    saveSession(session) {
        if (!session || !session.id) {
            throw new Error('Невалидная сессия');
        }

        const sessions = this.getAllSessions();
        const existingIndex = sessions.findIndex(s => s.id === session.id);

        session.updatedAt = new Date().toISOString();

        if (existingIndex >= 0) {
            sessions[existingIndex] = session;
        } else {
            sessions.unshift(session);
        }

        // Ограничиваем количество сессий
        while (sessions.length > this.maxSessions) {
            sessions.pop();
        }

        this.storage.setItem(this.storageKey, JSON.stringify(sessions));
        return session;
    }

    /**
     * Получает сессию по ID
     * @param {string} sessionId - ID сессии
     * @returns {Object|null} Сессия или null
     */
    getSession(sessionId) {
        const sessions = this.getAllSessions();
        return sessions.find(s => s.id === sessionId) || null;
    }

    /**
     * Получает все сессии
     * @returns {Array} Массив сессий
     */
    getAllSessions() {
        try {
            const data = this.storage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    /**
     * Удаляет сессию
     * @param {string} sessionId - ID сессии
     * @returns {boolean} Успешность удаления
     */
    deleteSession(sessionId) {
        const sessions = this.getAllSessions();
        const filteredSessions = sessions.filter(s => s.id !== sessionId);

        if (filteredSessions.length === sessions.length) {
            return false;
        }

        this.storage.setItem(this.storageKey, JSON.stringify(filteredSessions));
        return true;
    }

    /**
     * Добавляет транскрипт в сессию
     * @param {string} sessionId - ID сессии
     * @param {string} text - Текст транскрипта
     * @param {string} timestamp - Временная метка
     */
    addTranscript(sessionId, text, timestamp = null) {
        const session = this.getSession(sessionId);
        if (!session) {
            throw new Error('Сессия не найдена');
        }

        session.transcript.push({
            text,
            timestamp: timestamp || new Date().toISOString()
        });

        this.saveSession(session);
        return session;
    }

    /**
     * Добавляет подсказку в сессию
     * @param {string} sessionId - ID сессии
     * @param {string} text - Текст подсказки
     * @param {string} timestamp - Временная метка
     */
    addHint(sessionId, text, timestamp = null) {
        const session = this.getSession(sessionId);
        if (!session) {
            throw new Error('Сессия не найдена');
        }

        session.hints.push({
            text,
            timestamp: timestamp || new Date().toISOString()
        });

        this.saveSession(session);
        return session;
    }

    /**
     * Обновляет метаданные сессии
     * @param {string} sessionId - ID сессии
     * @param {Object} metadata - Метаданные
     */
    updateMetadata(sessionId, metadata) {
        const session = this.getSession(sessionId);
        if (!session) {
            throw new Error('Сессия не найдена');
        }

        session.metadata = { ...session.metadata, ...metadata };
        this.saveSession(session);
        return session;
    }

    /**
     * Очищает все сессии
     */
    clearAll() {
        this.storage.setItem(this.storageKey, JSON.stringify([]));
    }

    /**
     * Экспортирует сессию в текстовый формат
     * @param {string} sessionId - ID сессии
     * @returns {string} Текстовое представление сессии
     */
    exportSession(sessionId) {
        const session = this.getSession(sessionId);
        if (!session) {
            return null;
        }

        let output = `=== Сессия от ${new Date(session.createdAt).toLocaleString('ru-RU')} ===\n\n`;

        output += '--- ТРАНСКРИПТ ---\n';
        for (const item of session.transcript) {
            const time = new Date(item.timestamp).toLocaleTimeString('ru-RU');
            output += `[${time}] ${item.text}\n`;
        }

        output += '\n--- ПОДСКАЗКИ ---\n';
        for (const item of session.hints) {
            const time = new Date(item.timestamp).toLocaleTimeString('ru-RU');
            output += `[${time}] ${item.text}\n`;
        }

        return output;
    }
}

/**
 * In-memory storage для Node.js окружения
 */
class MemoryStorage {
    constructor() {
        this.data = new Map();
    }

    getItem(key) {
        return this.data.get(key) || null;
    }

    setItem(key, value) {
        this.data.set(key, value);
    }

    removeItem(key) {
        this.data.delete(key);
    }

    clear() {
        this.data.clear();
    }
}

module.exports = { SessionStore, MemoryStorage };
