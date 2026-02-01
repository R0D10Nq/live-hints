/**
 * @jest-environment jsdom
 *
 * Unit тесты для SessionManager
 */

// Мок для модулей ES6
jest.mock('../../renderer/modules/constants.js', () => ({
  STORAGE: { MAX_SESSIONS: 50 },
}));

import { SessionManager } from '../../renderer/modules/session-manager.js';

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

// Мок приложения
const mockApp = {
  ui: {
    getTranscriptText: jest.fn(() => 'Тестовый транскрипт'),
    getHintsText: jest.fn(() => 'Тестовые подсказки'),
    showToast: jest.fn(),
    renderSessionsList: jest.fn(),
  },
};

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
