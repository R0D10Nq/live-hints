/**
 * SessionStore - Хранилище сессий
 * Управляет историей транскриптов и подсказок
 */

const { v4: uuidv4 } = require('uuid');

class SessionStore {
  constructor(storage = null) {
    // Позволяет инжектить storage для тестов
    this.storage =
      storage || (typeof localStorage !== 'undefined' ? localStorage : new MemoryStorage());
    this.storageKey = 'live-hints-sessions';
    this.maxSessions = 50;
  }

  /**
   * Создаёт новую сессию с полной детализацией
   * @returns {Object} Новая сессия
   */
  createSession() {
    const session = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      endedAt: null,
      name: `Сессия ${new Date().toLocaleDateString('ru-RU')}`,
      transcript: [],
      hints: [],
      events: [],
      tags: [],
      metadata: {
        provider: 'ollama',
        model: 'default',
        duration: 0,
        transcriptCount: 0,
        hintCount: 0,
        avgSttLatency: 0,
        avgLlmLatency: 0,
        cacheHitRate: 0,
        questionTypes: { technical: 0, experience: 0, general: 0 },
        errors: [],
      },
      metrics: {
        sttLatencies: [],
        llmLatencies: [],
        cacheHits: 0,
        cacheMisses: 0,
      },
    };
    return session;
  }

  /**
   * Завершает сессию
   * @param {string} sessionId - ID сессии
   */
  endSession(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    session.endedAt = new Date().toISOString();

    // Вычисляем длительность
    const start = new Date(session.createdAt);
    const end = new Date(session.endedAt);
    session.metadata.duration = Math.round((end - start) / 1000);

    // Вычисляем средние метрики
    if (session.metrics.sttLatencies.length > 0) {
      session.metadata.avgSttLatency = Math.round(
        session.metrics.sttLatencies.reduce((a, b) => a + b, 0) /
          session.metrics.sttLatencies.length
      );
    }
    if (session.metrics.llmLatencies.length > 0) {
      session.metadata.avgLlmLatency = Math.round(
        session.metrics.llmLatencies.reduce((a, b) => a + b, 0) /
          session.metrics.llmLatencies.length
      );
    }

    // Cache hit rate
    const totalCache = session.metrics.cacheHits + session.metrics.cacheMisses;
    if (totalCache > 0) {
      session.metadata.cacheHitRate = Math.round((session.metrics.cacheHits / totalCache) * 100);
    }

    session.metadata.transcriptCount = session.transcript.length;
    session.metadata.hintCount = session.hints.length;

    this.saveSession(session);
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
    const existingIndex = sessions.findIndex((s) => s.id === session.id);

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
    return sessions.find((s) => s.id === sessionId) || null;
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
    const filteredSessions = sessions.filter((s) => s.id !== sessionId);

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
      timestamp: timestamp || new Date().toISOString(),
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
      timestamp: timestamp || new Date().toISOString(),
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
   * Добавляет событие в сессию
   * @param {string} sessionId - ID сессии
   * @param {string} type - Тип события (error, settings_change, hotkey, etc.)
   * @param {Object} data - Данные события
   */
  addEvent(sessionId, type, data = {}) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    session.events = session.events || [];
    session.events.push({
      type,
      data,
      timestamp: new Date().toISOString(),
    });

    // Ограничиваем количество событий
    if (session.events.length > 100) {
      session.events = session.events.slice(-100);
    }

    this.saveSession(session);
    return session;
  }

  /**
   * Добавляет тег к сессии
   * @param {string} sessionId - ID сессии
   * @param {string} tag - Тег
   */
  addTag(sessionId, tag) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    session.tags = session.tags || [];
    if (!session.tags.includes(tag)) {
      session.tags.push(tag);
    }

    this.saveSession(session);
    return session;
  }

  /**
   * Удаляет тег из сессии
   * @param {string} sessionId - ID сессии
   * @param {string} tag - Тег
   */
  removeTag(sessionId, tag) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    session.tags = (session.tags || []).filter((t) => t !== tag);
    this.saveSession(session);
    return session;
  }

  /**
   * Обновляет название сессии
   * @param {string} sessionId - ID сессии
   * @param {string} name - Новое название
   */
  renameSession(sessionId, name) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    session.name = name;
    this.saveSession(session);
    return session;
  }

  /**
   * Записывает метрику STT
   * @param {string} sessionId - ID сессии
   * @param {number} latencyMs - Латентность в мс
   */
  recordSttMetric(sessionId, latencyMs) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    session.metrics = session.metrics || {
      sttLatencies: [],
      llmLatencies: [],
      cacheHits: 0,
      cacheMisses: 0,
    };
    session.metrics.sttLatencies.push(latencyMs);

    // Ограничиваем размер
    if (session.metrics.sttLatencies.length > 1000) {
      session.metrics.sttLatencies = session.metrics.sttLatencies.slice(-1000);
    }

    this.saveSession(session);
    return session;
  }

  /**
   * Записывает метрику LLM
   * @param {string} sessionId - ID сессии
   * @param {number} latencyMs - Латентность в мс
   * @param {boolean} cached - Из кэша ли
   * @param {string} questionType - Тип вопроса
   */
  recordLlmMetric(sessionId, latencyMs, cached = false, questionType = 'general') {
    const session = this.getSession(sessionId);
    if (!session) return null;

    session.metrics = session.metrics || {
      sttLatencies: [],
      llmLatencies: [],
      cacheHits: 0,
      cacheMisses: 0,
    };
    session.metrics.llmLatencies.push(latencyMs);

    if (cached) {
      session.metrics.cacheHits++;
    } else {
      session.metrics.cacheMisses++;
    }

    // Обновляем счётчик типов вопросов
    session.metadata.questionTypes = session.metadata.questionTypes || {
      technical: 0,
      experience: 0,
      general: 0,
    };
    if (session.metadata.questionTypes[questionType] !== undefined) {
      session.metadata.questionTypes[questionType]++;
    }

    this.saveSession(session);
    return session;
  }

  /**
   * Фильтрует сессии
   * @param {Object} filters - Фильтры { tags, dateFrom, dateTo, minDuration }
   * @returns {Array} Отфильтрованные сессии
   */
  filterSessions(filters = {}) {
    let sessions = this.getAllSessions();

    if (filters.tags && filters.tags.length > 0) {
      sessions = sessions.filter((s) => filters.tags.some((tag) => (s.tags || []).includes(tag)));
    }

    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      sessions = sessions.filter((s) => new Date(s.createdAt) >= from);
    }

    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      sessions = sessions.filter((s) => new Date(s.createdAt) <= to);
    }

    if (filters.minDuration) {
      sessions = sessions.filter((s) => (s.metadata?.duration || 0) >= filters.minDuration);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      sessions = sessions.filter(
        (s) =>
          (s.name || '').toLowerCase().includes(searchLower) ||
          s.transcript.some((t) => t.text.toLowerCase().includes(searchLower))
      );
    }

    return sessions;
  }

  /**
   * Получает агрегированную статистику по всем сессиям
   * @returns {Object} Статистика
   */
  getGlobalStats() {
    const sessions = this.getAllSessions();

    const stats = {
      totalSessions: sessions.length,
      totalDuration: 0,
      avgDuration: 0,
      totalTranscripts: 0,
      totalHints: 0,
      avgCacheHitRate: 0,
      questionTypes: { technical: 0, experience: 0, general: 0 },
      topTags: {},
    };

    for (const session of sessions) {
      stats.totalDuration += session.metadata?.duration || 0;
      stats.totalTranscripts += session.transcript?.length || 0;
      stats.totalHints += session.hints?.length || 0;
      stats.avgCacheHitRate += session.metadata?.cacheHitRate || 0;

      // Типы вопросов
      if (session.metadata?.questionTypes) {
        stats.questionTypes.technical += session.metadata.questionTypes.technical || 0;
        stats.questionTypes.experience += session.metadata.questionTypes.experience || 0;
        stats.questionTypes.general += session.metadata.questionTypes.general || 0;
      }

      // Теги
      for (const tag of session.tags || []) {
        stats.topTags[tag] = (stats.topTags[tag] || 0) + 1;
      }
    }

    if (sessions.length > 0) {
      stats.avgDuration = Math.round(stats.totalDuration / sessions.length);
      stats.avgCacheHitRate = Math.round(stats.avgCacheHitRate / sessions.length);
    }

    return stats;
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

    let output = `=== ${session.name || 'Сессия'} ===\n`;
    output += `Дата: ${new Date(session.createdAt).toLocaleString('ru-RU')}\n`;
    output += `Длительность: ${session.metadata?.duration || 0} сек\n`;
    output += `Теги: ${(session.tags || []).join(', ') || 'нет'}\n\n`;

    output += '--- ТРАНСКРИПТ ---\n';
    for (const item of session.transcript) {
      const time = new Date(item.timestamp).toLocaleTimeString('ru-RU');
      const source = item.source === 'candidate' ? '🗣️ Ты' : '🎙️ Интервьюер';
      output += `[${time}] ${source}: ${item.text}\n`;
    }

    output += '\n--- ПОДСКАЗКИ ---\n';
    for (const item of session.hints) {
      const time = new Date(item.timestamp).toLocaleTimeString('ru-RU');
      output += `[${time}] ${item.text}\n`;
    }

    output += '\n--- МЕТРИКИ ---\n';
    output += `Транскриптов: ${session.transcript.length}\n`;
    output += `Подсказок: ${session.hints.length}\n`;
    output += `Средняя латентность STT: ${session.metadata?.avgSttLatency || 0}ms\n`;
    output += `Средняя латентность LLM: ${session.metadata?.avgLlmLatency || 0}ms\n`;
    output += `Cache Hit Rate: ${session.metadata?.cacheHitRate || 0}%\n`;

    return output;
  }

  /**
   * Экспортирует сессию в JSON
   * @param {string} sessionId - ID сессии
   * @returns {Object} JSON объект сессии
   */
  exportSessionJson(sessionId) {
    return this.getSession(sessionId);
  }

  /**
   * Массовое удаление сессий
   * @param {Array} sessionIds - Массив ID сессий
   */
  deleteSessions(sessionIds) {
    const sessions = this.getAllSessions();
    const filtered = sessions.filter((s) => !sessionIds.includes(s.id));
    this.storage.setItem(this.storageKey, JSON.stringify(filtered));
    return sessionIds.length - (sessions.length - filtered.length);
  }

  /**
   * Массовое добавление тегов
   * @param {Array} sessionIds - Массив ID сессий
   * @param {string} tag - Тег
   */
  addTagToSessions(sessionIds, tag) {
    for (const id of sessionIds) {
      this.addTag(id, tag);
    }
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
