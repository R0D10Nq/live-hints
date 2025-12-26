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

  describe('endSession', () => {
    test('должен завершать сессию и вычислять метрики', () => {
      const session = store.createSession();
      store.saveSession(session);
      session.metrics.sttLatencies = [100, 200, 300];
      session.metrics.llmLatencies = [500, 600];
      session.metrics.cacheHits = 3;
      session.metrics.cacheMisses = 2;
      store.saveSession(session);

      const ended = store.endSession(session.id);

      expect(ended.endedAt).toBeDefined();
      expect(ended.metadata.avgSttLatency).toBe(200);
      expect(ended.metadata.avgLlmLatency).toBe(550);
      expect(ended.metadata.cacheHitRate).toBe(60);
    });

    test('должен возвращать null для несуществующей сессии', () => {
      const result = store.endSession('non-existent');
      expect(result).toBeNull();
    });

    test('должен вычислять длительность', () => {
      const session = store.createSession();
      store.saveSession(session);

      const ended = store.endSession(session.id);
      expect(ended.metadata.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('addEvent', () => {
    test('должен добавлять событие в сессию', () => {
      const session = store.createSession();
      store.saveSession(session);

      store.addEvent(session.id, 'error', { message: 'Test error' });

      const updated = store.getSession(session.id);
      expect(updated.events.length).toBe(1);
      expect(updated.events[0].type).toBe('error');
      expect(updated.events[0].data.message).toBe('Test error');
    });

    test('должен возвращать null для несуществующей сессии', () => {
      const result = store.addEvent('non-existent', 'error', {});
      expect(result).toBeNull();
    });

    test('должен ограничивать количество событий до 100', () => {
      const session = store.createSession();
      store.saveSession(session);

      for (let i = 0; i < 110; i++) {
        store.addEvent(session.id, 'test', { index: i });
      }

      const updated = store.getSession(session.id);
      expect(updated.events.length).toBe(100);
    });
  });

  describe('addTag', () => {
    test('должен добавлять тег к сессии', () => {
      const session = store.createSession();
      store.saveSession(session);

      store.addTag(session.id, 'important');

      const updated = store.getSession(session.id);
      expect(updated.tags).toContain('important');
    });

    test('не должен добавлять дубликат тега', () => {
      const session = store.createSession();
      store.saveSession(session);

      store.addTag(session.id, 'important');
      store.addTag(session.id, 'important');

      const updated = store.getSession(session.id);
      expect(updated.tags.filter((t) => t === 'important').length).toBe(1);
    });

    test('должен возвращать null для несуществующей сессии', () => {
      const result = store.addTag('non-existent', 'tag');
      expect(result).toBeNull();
    });
  });

  describe('removeTag', () => {
    test('должен удалять тег из сессии', () => {
      const session = store.createSession();
      store.saveSession(session);
      store.addTag(session.id, 'important');

      store.removeTag(session.id, 'important');

      const updated = store.getSession(session.id);
      expect(updated.tags).not.toContain('important');
    });

    test('должен возвращать null для несуществующей сессии', () => {
      const result = store.removeTag('non-existent', 'tag');
      expect(result).toBeNull();
    });
  });

  describe('renameSession', () => {
    test('должен переименовывать сессию', () => {
      const session = store.createSession();
      store.saveSession(session);

      store.renameSession(session.id, 'Новое название');

      const updated = store.getSession(session.id);
      expect(updated.name).toBe('Новое название');
    });

    test('должен возвращать null для несуществующей сессии', () => {
      const result = store.renameSession('non-existent', 'name');
      expect(result).toBeNull();
    });
  });

  describe('recordSttMetric', () => {
    test('должен записывать метрику STT', () => {
      const session = store.createSession();
      store.saveSession(session);

      store.recordSttMetric(session.id, 150);

      const updated = store.getSession(session.id);
      expect(updated.metrics.sttLatencies).toContain(150);
    });

    test('должен ограничивать количество метрик до 1000', () => {
      const session = store.createSession();
      store.saveSession(session);

      for (let i = 0; i < 1100; i++) {
        store.recordSttMetric(session.id, i);
      }

      const updated = store.getSession(session.id);
      expect(updated.metrics.sttLatencies.length).toBe(1000);
    });

    test('должен возвращать null для несуществующей сессии', () => {
      const result = store.recordSttMetric('non-existent', 100);
      expect(result).toBeNull();
    });
  });

  describe('recordLlmMetric', () => {
    test('должен записывать метрику LLM', () => {
      const session = store.createSession();
      store.saveSession(session);

      store.recordLlmMetric(session.id, 500, false, 'technical');

      const updated = store.getSession(session.id);
      expect(updated.metrics.llmLatencies).toContain(500);
      expect(updated.metrics.cacheMisses).toBe(1);
      expect(updated.metadata.questionTypes.technical).toBe(1);
    });

    test('должен увеличивать cacheHits если cached=true', () => {
      const session = store.createSession();
      store.saveSession(session);

      store.recordLlmMetric(session.id, 50, true, 'general');

      const updated = store.getSession(session.id);
      expect(updated.metrics.cacheHits).toBe(1);
    });

    test('должен возвращать null для несуществующей сессии', () => {
      const result = store.recordLlmMetric('non-existent', 100);
      expect(result).toBeNull();
    });
  });

  describe('filterSessions', () => {
    test('должен фильтровать по тегам', () => {
      const session1 = store.createSession();
      store.saveSession(session1);
      store.addTag(session1.id, 'important');

      const session2 = store.createSession();
      store.saveSession(session2);

      const filtered = store.filterSessions({ tags: ['important'] });
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe(session1.id);
    });

    test('должен фильтровать по дате от', () => {
      const session = store.createSession();
      store.saveSession(session);

      const filtered = store.filterSessions({ dateFrom: '2020-01-01' });
      expect(filtered.length).toBe(1);
    });

    test('должен фильтровать по дате до', () => {
      const session = store.createSession();
      store.saveSession(session);

      const filtered = store.filterSessions({ dateTo: '2030-01-01' });
      expect(filtered.length).toBe(1);
    });

    test('должен фильтровать по минимальной длительности', () => {
      const session = store.createSession();
      session.metadata.duration = 120;
      store.saveSession(session);

      const filtered = store.filterSessions({ minDuration: 60 });
      expect(filtered.length).toBe(1);

      const filtered2 = store.filterSessions({ minDuration: 200 });
      expect(filtered2.length).toBe(0);
    });

    test('должен фильтровать по поисковому запросу', () => {
      const session = store.createSession();
      session.name = 'Важная сессия';
      store.saveSession(session);
      store.addTranscript(session.id, 'Привет мир');

      const filtered = store.filterSessions({ search: 'важная' });
      expect(filtered.length).toBe(1);

      const filtered2 = store.filterSessions({ search: 'привет' });
      expect(filtered2.length).toBe(1);
    });
  });

  describe('getGlobalStats', () => {
    test('должен возвращать пустую статистику если нет сессий', () => {
      const stats = store.getGlobalStats();
      expect(stats.totalSessions).toBe(0);
      expect(stats.avgDuration).toBe(0);
    });

    test('должен агрегировать статистику по всем сессиям', () => {
      const session1 = store.createSession();
      session1.metadata.duration = 100;
      session1.metadata.cacheHitRate = 50;
      session1.metadata.questionTypes = { technical: 2, experience: 1, general: 3 };
      session1.tags = ['tag1', 'tag2'];
      session1.transcript = [{ text: 't1' }];
      session1.hints = [{ text: 'h1' }];
      store.saveSession(session1);

      const session2 = store.createSession();
      session2.metadata.duration = 200;
      session2.metadata.cacheHitRate = 80;
      session2.metadata.questionTypes = { technical: 1, experience: 0, general: 2 };
      session2.tags = ['tag1'];
      session2.transcript = [{ text: 't2' }, { text: 't3' }];
      session2.hints = [{ text: 'h2' }];
      store.saveSession(session2);

      const stats = store.getGlobalStats();
      expect(stats.totalSessions).toBe(2);
      expect(stats.totalDuration).toBe(300);
      expect(stats.avgDuration).toBe(150);
      expect(stats.totalTranscripts).toBe(3);
      expect(stats.totalHints).toBe(2);
      expect(stats.avgCacheHitRate).toBe(65);
      expect(stats.questionTypes.technical).toBe(3);
      expect(stats.topTags.tag1).toBe(2);
    });
  });

  describe('exportSessionJson', () => {
    test('должен возвращать сессию в JSON', () => {
      const session = store.createSession();
      store.saveSession(session);

      const json = store.exportSessionJson(session.id);
      expect(json).not.toBeNull();
      expect(json.id).toBe(session.id);
    });
  });

  describe('deleteSessions', () => {
    test('должен удалять несколько сессий', () => {
      const session1 = store.createSession();
      store.saveSession(session1);
      const session2 = store.createSession();
      store.saveSession(session2);
      const session3 = store.createSession();
      store.saveSession(session3);

      store.deleteSessions([session1.id, session2.id]);

      const all = store.getAllSessions();
      expect(all.length).toBe(1);
      expect(all[0].id).toBe(session3.id);
    });
  });

  describe('addTagToSessions', () => {
    test('должен добавлять тег к нескольким сессиям', () => {
      const session1 = store.createSession();
      store.saveSession(session1);
      const session2 = store.createSession();
      store.saveSession(session2);

      store.addTagToSessions([session1.id, session2.id], 'batch-tag');

      const updated1 = store.getSession(session1.id);
      const updated2 = store.getSession(session2.id);
      expect(updated1.tags).toContain('batch-tag');
      expect(updated2.tags).toContain('batch-tag');
    });
  });

  describe('updateMetadata для несуществующей сессии', () => {
    test('должен выбрасывать ошибку', () => {
      expect(() => store.updateMetadata('non-existent', {})).toThrow('Сессия не найдена');
    });
  });
});

describe('SessionStore ошибка парсинга', () => {
  test('должен возвращать пустой массив при ошибке парсинга JSON', () => {
    const badStorage = {
      getItem: () => 'invalid json {{{',
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    const store = new SessionStore(badStorage);
    const sessions = store.getAllSessions();
    expect(sessions).toEqual([]);
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
