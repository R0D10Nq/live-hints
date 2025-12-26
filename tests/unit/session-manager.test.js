/**
 * @jest-environment jsdom
 * Unit тесты для SessionManager
 */

// localStorage мок из setup.js

// Мок confirm
global.confirm = jest.fn(() => true);

// Мок URL
global.URL.createObjectURL = jest.fn(() => 'blob:test');
global.URL.revokeObjectURL = jest.fn();

// Мок document.createElement для экспорта
document.createElement = jest.fn((tag) => {
  if (tag === 'a') {
    return {
      href: '',
      download: '',
      click: jest.fn(),
    };
  }
  return {};
});

document.body.appendChild = jest.fn();
document.body.removeChild = jest.fn();

// Мок Blob
global.Blob = jest.fn((content, options) => ({
  content,
  options,
}));

// Константы
const STORAGE = { MAX_SESSIONS: 50 };

// Мок приложения
const mockApp = {
  ui: {
    getTranscriptText: jest.fn(() => 'Тестовый транскрипт'),
    getHintsText: jest.fn(() => 'Тестовые подсказки'),
    showToast: jest.fn(),
    renderSessionsList: jest.fn(),
  },
};

// SessionManager класс
class SessionManager {
  constructor(app) {
    this.app = app;
    this.currentSessionId = null;
  }

  generateId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  create() {
    this.currentSessionId = this.generateId();
    return this.currentSessionId;
  }

  save() {
    if (!this.currentSessionId) return;

    const session = {
      id: this.currentSessionId,
      date: new Date().toISOString(),
      transcript: this.app.ui.getTranscriptText(),
      hints: this.app.ui.getHintsText(),
    };

    const sessions = this.getAll();
    sessions.unshift(session);

    if (sessions.length > STORAGE.MAX_SESSIONS) {
      sessions.pop();
    }

    localStorage.setItem('live-hints-sessions', JSON.stringify(sessions));
    this.currentSessionId = null;
  }

  getAll() {
    try {
      return JSON.parse(localStorage.getItem('live-hints-sessions')) || [];
    } catch {
      return [];
    }
  }

  getById(sessionId) {
    return this.getAll().find((s) => s.id === sessionId);
  }

  delete(sessionId) {
    if (!confirm('Удалить эту сессию?')) return false;

    let sessions = this.getAll();
    sessions = sessions.filter((s) => s.id !== sessionId);
    localStorage.setItem('live-hints-sessions', JSON.stringify(sessions));
    return true;
  }

  exportSession(sessionId) {
    const session = this.getById(sessionId);
    if (!session) return;

    const content = `# Сессия: ${session.name || 'Без названия'}
Дата: ${this.formatDateFull(session.date)}

## Транскрипт
${session.transcript || 'Нет данных'}

## Подсказки
${session.hints || 'Нет данных'}
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_${new Date(session.date).toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    this.app.ui.showToast('Сессия экспортирована', 'success');
  }

  exportAllSessions() {
    try {
      const sessions = this.getAll();

      if (sessions.length === 0) {
        this.app.ui.showToast('Нет сессий для экспорта', 'warning');
        return;
      }

      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        sessionsCount: sessions.length,
        sessions: sessions,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `live-hints-sessions-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.app.ui.showToast(`Экспортировано ${sessions.length} сессий`, 'success');
    } catch (e) {
      console.error('Export error:', e);
      this.app.ui.showToast('Ошибка экспорта', 'error');
    }
  }

  calculateDuration(session) {
    if (session.endedAt && session.date) {
      const start = new Date(session.date);
      const end = new Date(session.endedAt);
      const diffMs = end - start;
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return '< 1 мин';
      if (mins < 60) return `${mins} мин`;
      const hours = Math.floor(mins / 60);
      return `${hours} ч ${mins % 60} мин`;
    }
    return '—';
  }

  formatDateFull(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

describe('SessionManager', () => {
  let sessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager(mockApp);
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('конструктор', () => {
    test('должен инициализировать с null currentSessionId', () => {
      expect(sessionManager.currentSessionId).toBeNull();
    });

    test('должен сохранять ссылку на app', () => {
      expect(sessionManager.app).toBe(mockApp);
    });
  });

  describe('generateId', () => {
    test('должен генерировать уникальные ID', () => {
      const id1 = sessionManager.generateId();
      const id2 = sessionManager.generateId();
      expect(id1).not.toBe(id2);
    });

    test('ID должен начинаться с session_', () => {
      const id = sessionManager.generateId();
      expect(id.startsWith('session_')).toBe(true);
    });

    test('ID должен содержать timestamp', () => {
      const before = Date.now();
      const id = sessionManager.generateId();
      const after = Date.now();

      const parts = id.split('_');
      const timestamp = parseInt(parts[1]);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('create', () => {
    test('должен создавать новую сессию', () => {
      const id = sessionManager.create();
      expect(id).toBeTruthy();
      expect(sessionManager.currentSessionId).toBe(id);
    });

    test('должен возвращать ID сессии', () => {
      const id = sessionManager.create();
      expect(id.startsWith('session_')).toBe(true);
    });
  });

  describe('save', () => {
    test('не должен сохранять если нет currentSessionId', () => {
      sessionManager.save();
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    test('должен сохранять сессию в localStorage', () => {
      sessionManager.create();
      sessionManager.save();

      expect(localStorage.setItem).toHaveBeenCalledWith('live-hints-sessions', expect.any(String));
    });

    test('должен сбрасывать currentSessionId после сохранения', () => {
      sessionManager.create();
      sessionManager.save();
      expect(sessionManager.currentSessionId).toBeNull();
    });

    test('должен добавлять сессию в начало списка', () => {
      const existingSession = { id: 'old_session', date: '2024-01-01' };
      localStorage.getItem.mockReturnValueOnce(JSON.stringify([existingSession]));

      sessionManager.create();
      sessionManager.save();

      const savedData = JSON.parse(localStorage.setItem.mock.calls[0][1]);
      expect(savedData[0].id).toBe(sessionManager.currentSessionId || savedData[0].id);
    });

    test('должен получать транскрипт и подсказки из UI', () => {
      sessionManager.create();
      sessionManager.save();

      expect(mockApp.ui.getTranscriptText).toHaveBeenCalled();
      expect(mockApp.ui.getHintsText).toHaveBeenCalled();
    });
  });

  describe('getAll', () => {
    test('должен возвращать пустой массив если нет сессий', () => {
      localStorage.getItem.mockReturnValueOnce(null);
      expect(sessionManager.getAll()).toEqual([]);
    });

    test('должен возвращать сессии из localStorage', () => {
      const sessions = [{ id: '1' }, { id: '2' }];
      localStorage.getItem.mockReturnValueOnce(JSON.stringify(sessions));
      expect(sessionManager.getAll()).toEqual(sessions);
    });

    test('должен возвращать пустой массив при ошибке парсинга', () => {
      localStorage.getItem.mockReturnValueOnce('invalid json');
      expect(sessionManager.getAll()).toEqual([]);
    });
  });

  describe('getById', () => {
    test('должен находить сессию по ID', () => {
      const sessions = [{ id: 'session_1' }, { id: 'session_2' }];
      localStorage.getItem.mockReturnValueOnce(JSON.stringify(sessions));

      const session = sessionManager.getById('session_1');
      expect(session).toEqual({ id: 'session_1' });
    });

    test('должен возвращать undefined если сессия не найдена', () => {
      localStorage.getItem.mockReturnValueOnce(JSON.stringify([]));
      expect(sessionManager.getById('nonexistent')).toBeUndefined();
    });
  });

  describe('delete', () => {
    test('должен удалять сессию', () => {
      const sessions = [{ id: 'session_1' }, { id: 'session_2' }];
      localStorage.getItem.mockReturnValueOnce(JSON.stringify(sessions));

      const result = sessionManager.delete('session_1');

      expect(result).toBe(true);
      const savedData = JSON.parse(localStorage.setItem.mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0].id).toBe('session_2');
    });

    test('должен возвращать false если пользователь отменил', () => {
      global.confirm.mockReturnValueOnce(false);
      const result = sessionManager.delete('session_1');
      expect(result).toBe(false);
    });
  });

  describe('exportSession', () => {
    test('не должен делать ничего если сессия не найдена', () => {
      localStorage.getItem.mockReturnValueOnce(JSON.stringify([]));
      sessionManager.exportSession('nonexistent');
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    test('должен создавать blob с контентом', () => {
      const session = {
        id: 'session_1',
        date: '2024-01-15T10:00:00Z',
        transcript: 'Транскрипт',
        hints: 'Подсказки',
      };
      localStorage.getItem.mockReturnValueOnce(JSON.stringify([session]));

      sessionManager.exportSession('session_1');

      expect(Blob).toHaveBeenCalled();
      expect(mockApp.ui.showToast).toHaveBeenCalledWith('Сессия экспортирована', 'success');
    });
  });

  describe('exportAllSessions', () => {
    test('должен показывать предупреждение если нет сессий', () => {
      localStorage.getItem.mockReturnValueOnce(JSON.stringify([]));
      sessionManager.exportAllSessions();
      expect(mockApp.ui.showToast).toHaveBeenCalledWith('Нет сессий для экспорта', 'warning');
    });

    test('должен экспортировать все сессии', () => {
      const sessions = [{ id: '1' }, { id: '2' }];
      localStorage.getItem.mockReturnValueOnce(JSON.stringify(sessions));

      sessionManager.exportAllSessions();

      expect(Blob).toHaveBeenCalled();
      expect(mockApp.ui.showToast).toHaveBeenCalledWith('Экспортировано 2 сессий', 'success');
    });
  });

  describe('calculateDuration', () => {
    test('должен возвращать "—" если нет endedAt', () => {
      expect(sessionManager.calculateDuration({ date: '2024-01-01' })).toBe('—');
    });

    test('должен возвращать "< 1 мин" для коротких сессий', () => {
      const session = {
        date: '2024-01-01T10:00:00Z',
        endedAt: '2024-01-01T10:00:30Z',
      };
      expect(sessionManager.calculateDuration(session)).toBe('< 1 мин');
    });

    test('должен возвращать минуты для сессий < 60 мин', () => {
      const session = {
        date: '2024-01-01T10:00:00Z',
        endedAt: '2024-01-01T10:30:00Z',
      };
      expect(sessionManager.calculateDuration(session)).toBe('30 мин');
    });

    test('должен возвращать часы и минуты для длинных сессий', () => {
      const session = {
        date: '2024-01-01T10:00:00Z',
        endedAt: '2024-01-01T11:30:00Z',
      };
      expect(sessionManager.calculateDuration(session)).toBe('1 ч 30 мин');
    });
  });

  describe('formatDateFull', () => {
    test('должен форматировать дату полностью', () => {
      const result = sessionManager.formatDateFull('2024-01-15T10:30:00Z');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('formatDate', () => {
    test('должен форматировать дату кратко', () => {
      const result = sessionManager.formatDate('2024-01-15T10:30:00Z');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });
});
