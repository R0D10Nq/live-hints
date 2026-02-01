/**
 * @jest-environment jsdom
 *
 * Интеграционные тесты для Live Hints
 * Тестируют взаимодействие между модулями
 */

import { SessionManager } from '../../renderer/modules/session-manager.js';
import { HintManager } from '../../renderer/modules/hint-manager.js';

// Мок для модулей ES6
jest.mock('../../renderer/modules/constants.js', () => ({
  SERVERS: { LLM: 'http://localhost:8766' },
  TIMEOUTS: { LLM_REQUEST: 60000 },
  CONTEXT: { WINDOW_SIZE_DEFAULT: 10, MAX_CHARS_DEFAULT: 3000 },
  LLM: { MAX_TOKENS_DEFAULT: 500, TEMPERATURE_DEFAULT: 0.8 },
  STORAGE: { MAX_PROMPT_LENGTH: 5000 },
  SYSTEM_PROMPTS: {
    job_interview_ru: 'Системный промпт для интервью',
    default_fallback: 'Дефолтный промпт',
  },
}));

// Мок для logger
jest.mock('../../renderer/modules/utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  LOG_LEVELS: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 },
}));

describe('Интеграционные тесты Live Hints', () => {
  let mockApp;
  let originalConfirm;

  beforeEach(() => {
    // Сохраняем оригинальный confirm
    originalConfirm = global.confirm;
    global.confirm = jest.fn();

    localStorage.clear();
    jest.clearAllMocks();

    mockApp = {
      debugMode: false,
      isRunning: true,
      ui: {
        showHintLoading: jest.fn(),
        hideHintLoading: jest.fn(),
        showError: jest.fn(),
        showToast: jest.fn(),
        createStreamingHintElement: jest.fn(() => document.createElement('div')),
        updateStreamingHint: jest.fn(),
        finalizeStreamingHint: jest.fn(),
        updateMetricsPanel: jest.fn(),
        getTranscriptText: jest.fn(() => 'Тестовый транскрипт'),
        getHintsText: jest.fn(() => 'Тестовые подсказки'),
        renderSessionsList: jest.fn(),
        lastHintText: '',
      },
    };
  });

  afterEach(() => {
    // Восстанавливаем оригинальный confirm
    global.confirm = originalConfirm;
  });

  describe('Сценарий: Создание и экспорт сессии', () => {
    test('должен создать, сохранить и экспортировать сессию', async () => {
      // Arrange
      const sessionManager = new SessionManager(mockApp);
      const blobSpy = jest.spyOn(global, 'Blob').mockImplementation((content) => ({
        content,
        type: 'application/json',
      }));

      // Act - Создание сессии
      const sessionId = sessionManager.create();
      expect(sessionId).toBeTruthy();
      expect(sessionManager.currentSessionId).toBe(sessionId);

      // Act - Сохранение сессии
      sessionManager.save();
      expect(sessionManager.currentSessionId).toBeNull();

      // Assert - Сессия сохранена
      const sessions = sessionManager.getAll();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe(sessionId);

      // Assert - Экспорт сессии
      sessionManager.exportSession(sessionId);
      expect(mockApp.ui.showToast).toHaveBeenCalledWith(
        'Сессия экспортирована',
        'success'
      );

      blobSpy.mockRestore();
    });
  });

  describe('Сценарий: Импорт и проверка сессий', () => {
    test('должен импортировать и найти сессию по ID', async () => {
      // Arrange
      const sessionManager = new SessionManager(mockApp);
      const sessions = [
        { id: 'session_1', date: '2024-01-01T10:00:00Z', transcript: 'Тест 1' },
        { id: 'session_2', date: '2024-01-02T10:00:00Z', transcript: 'Тест 2' },
      ];
      const fileContent = JSON.stringify({ sessions });
      const file = new Blob([fileContent], { type: 'application/json' });
      file.text = jest.fn().mockResolvedValue(fileContent);

      // Act - Импорт
      await sessionManager.importSessions(file);

      // Assert
      expect(mockApp.ui.showToast).toHaveBeenCalledWith(
        'Импортировано 2 новых сессий',
        'success'
      );

      // Act - Поиск сессии
      const foundSession = sessionManager.getById('session_1');
      expect(foundSession).toBeDefined();
      expect(foundSession.transcript).toBe('Тест 1');
    });

    test('должен пропускать дубликаты при импорте', async () => {
      // Arrange
      const sessionManager = new SessionManager(mockApp);
      const existingSessions = [{ id: 'session_1', date: '2024-01-01T10:00:00Z' }];
      localStorage.setItem('live-hints-sessions', JSON.stringify(existingSessions));

      const newSessions = [
        { id: 'session_1', date: '2024-01-01T10:00:00Z' }, // Дубликат
        { id: 'session_2', date: '2024-01-02T10:00:00Z' }, // Новая
      ];
      const fileContent = JSON.stringify({ sessions: newSessions });
      const file = new Blob([fileContent], { type: 'application/json' });
      file.text = jest.fn().mockResolvedValue(fileContent);

      // Act
      await sessionManager.importSessions(file);

      // Assert - Импортирована только 1 новая сессия
      expect(mockApp.ui.showToast).toHaveBeenCalledWith(
        'Импортировано 1 новых сессий',
        'success'
      );

      const allSessions = sessionManager.getAll();
      expect(allSessions).toHaveLength(2);
    });
  });

  describe('Сценарий: Управление сессиями', () => {
    test('должен удалить сессию после подтверждения', () => {
      // Arrange
      const sessionManager = new SessionManager(mockApp);
      const sessions = [{ id: 'session_1' }, { id: 'session_2' }];
      localStorage.setItem('live-hints-sessions', JSON.stringify(sessions));

      global.confirm.mockReturnValueOnce(true);

      // Act
      const result = sessionManager.delete('session_1');

      // Assert
      expect(result).toBe(true);
      expect(sessionManager.getAll()).toHaveLength(1);
      expect(sessionManager.getById('session_1')).toBeUndefined();
    });

    test('должен удалить все сессии', () => {
      // Arrange
      const sessionManager = new SessionManager(mockApp);
      const sessions = [{ id: 'session_1' }, { id: 'session_2' }];
      localStorage.setItem('live-hints-sessions', JSON.stringify(sessions));

      global.confirm.mockReturnValueOnce(true);

      // Act
      sessionManager.deleteAllSessions();

      // Assert
      expect(sessionManager.getAll()).toHaveLength(0);
      expect(mockApp.ui.showToast).toHaveBeenCalledWith(
        'Все сессии удалены',
        'info'
      );
    });
  });

  describe('Сценарий: Расчет длительности сессий', () => {
    test('должен правильно рассчитать длительность сессии', () => {
      // Arrange
      const sessionManager = new SessionManager(mockApp);

      // Act & Assert - Короткая сессия
      const shortSession = {
        date: '2024-01-01T10:00:00Z',
        endedAt: '2024-01-01T10:00:30Z',
      };
      expect(sessionManager.calculateDuration(shortSession)).toBe('< 1 мин');

      // Act & Assert - Сессия в минутах
      const mediumSession = {
        date: '2024-01-01T10:00:00Z',
        endedAt: '2024-01-01T10:30:00Z',
      };
      expect(sessionManager.calculateDuration(mediumSession)).toBe('30 мин');

      // Act & Assert - Длинная сессия
      const longSession = {
        date: '2024-01-01T10:00:00Z',
        endedAt: '2024-01-01T11:30:00Z',
      };
      expect(sessionManager.calculateDuration(longSession)).toBe('1 ч 30 мин');
    });
  });
});
