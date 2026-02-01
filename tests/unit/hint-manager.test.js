/**
 * @jest-environment jsdom
 *
 * Unit тесты для HintManager
 */

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

import { HintManager } from '../../renderer/modules/hint-manager.js';

// Моки
const mockApp = {
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
    lastHintText: '',
  },
};

describe('HintManager', () => {
  let hintManager;

  beforeEach(() => {
    hintManager = new HintManager(mockApp);
    jest.clearAllMocks();
  });

  describe('конструктор', () => {
    test('должен инициализировать с дефолтными значениями', () => {
      expect(hintManager.hintRequestPending).toBe(false);
      expect(hintManager.transcriptContext).toEqual([]);
      expect(hintManager.lastContextHash).toBe('');
      expect(hintManager.contextWindowSize).toBe(10);
      expect(hintManager.maxContextChars).toBe(3000);
      expect(hintManager.maxTokens).toBe(500);
      expect(hintManager.temperature).toBe(0.8);
      expect(hintManager.currentProfile).toBe('job_interview_ru');
      expect(hintManager.customInstructions).toBe('');
      expect(hintManager.currentModel).toBeNull();
      expect(hintManager.userContext).toBe('');
    });

    test('должен инициализировать метрики', () => {
      expect(hintManager.metrics).toEqual({
        t_hint_request_start: null,
        t_hint_response: null,
        t_hint_done: null,
        stt_latency_ms: null,
        llm_client_latency_ms: null,
        llm_server_latency_ms: null,
      });
    });
  });

  describe('buildContext', () => {
    test('должен возвращать пустой массив если нет контекста', () => {
      expect(hintManager.buildContext()).toEqual([]);
    });

    test('должен возвращать весь контекст если он меньше лимита', () => {
      hintManager.transcriptContext = ['текст 1', 'текст 2', 'текст 3'];
      const result = hintManager.buildContext();
      expect(result).toEqual(['текст 1', 'текст 2', 'текст 3']);
    });

    test('должен обрезать контекст по размеру окна', () => {
      hintManager.contextWindowSize = 2;
      hintManager.transcriptContext = ['текст 1', 'текст 2', 'текст 3', 'текст 4'];
      const result = hintManager.buildContext();
      expect(result).toEqual(['текст 3', 'текст 4']);
    });

    test('должен обрезать по максимальному количеству символов', () => {
      hintManager.maxContextChars = 20;
      hintManager.transcriptContext = ['длинный текст номер один', 'короткий'];
      const result = hintManager.buildContext();
      expect(result).toEqual(['короткий']);
    });

    test('должен собирать контекст с конца', () => {
      hintManager.maxContextChars = 30;
      hintManager.transcriptContext = ['первый', 'второй', 'третий'];
      const result = hintManager.buildContext();
      expect(result).toContain('третий');
    });
  });

  describe('buildSystemPrompt', () => {
    test('должен возвращать промпт для текущего профиля', () => {
      hintManager.currentProfile = 'job_interview_ru';
      const result = hintManager.buildSystemPrompt();
      expect(result).toBe('Системный промпт для интервью');
    });

    test('должен возвращать кастомный промпт', () => {
      hintManager.currentProfile = 'custom';
      hintManager.customInstructions = 'Мой кастомный промпт';
      const result = hintManager.buildSystemPrompt();
      expect(result).toBe('Мой кастомный промпт');
    });

    test('должен обрезать слишком длинный кастомный промпт', () => {
      hintManager.currentProfile = 'custom';
      hintManager.customInstructions = 'a'.repeat(10000);
      const result = hintManager.buildSystemPrompt();
      expect(result.length).toBe(5000);
    });

    test('должен возвращать fallback если кастомный промпт пустой', () => {
      hintManager.currentProfile = 'custom';
      hintManager.customInstructions = '';
      const result = hintManager.buildSystemPrompt();
      expect(result).toBe('Дефолтный промпт');
    });

    test('должен возвращать fallback если кастомный промпт только пробелы', () => {
      hintManager.currentProfile = 'custom';
      hintManager.customInstructions = '   ';
      const result = hintManager.buildSystemPrompt();
      expect(result).toBe('Дефолтный промпт');
    });

    test('должен возвращать дефолтный промпт для неизвестного профиля', () => {
      hintManager.currentProfile = 'unknown_profile';
      const result = hintManager.buildSystemPrompt();
      expect(result).toBe('Системный промпт для интервью');
    });
  });

  describe('getReadableError', () => {
    test('должен обрабатывать AbortError', () => {
      const error = new Error('');
      error.name = 'AbortError';
      expect(hintManager.getReadableError(error)).toBe('Таймаут запроса к LLM (60 сек)');
    });

    test('должен обрабатывать ошибку fetch', () => {
      const error = new Error('Failed to fetch');
      expect(hintManager.getReadableError(error)).toContain('LLM сервер недоступен');
    });

    test('должен обрабатывать NetworkError', () => {
      const error = new Error('NetworkError when attempting to fetch');
      expect(hintManager.getReadableError(error)).toBe('Ошибка сети. Проверьте подключение.');
    });

    test('должен обрабатывать ECONNREFUSED', () => {
      const error = new Error('connect ECONNREFUSED');
      expect(hintManager.getReadableError(error)).toContain('LLM сервер не запущен');
    });

    test('должен возвращать общую ошибку для неизвестных типов', () => {
      const error = new Error('Какая-то ошибка');
      expect(hintManager.getReadableError(error)).toBe('Ошибка: Какая-то ошибка');
    });

    test('должен обрабатывать ошибку без сообщения', () => {
      const error = new Error();
      expect(hintManager.getReadableError(error)).toBe('Ошибка: Неизвестная ошибка');
    });
  });

  describe('clearContext', () => {
    test('должен очищать контекст', () => {
      hintManager.transcriptContext = ['текст 1', 'текст 2'];
      hintManager.lastContextHash = 'some_hash';

      hintManager.clearContext();

      expect(hintManager.transcriptContext).toEqual([]);
      expect(hintManager.lastContextHash).toBe('');
    });
  });

  describe('setProfile', () => {
    test('должен устанавливать профиль', () => {
      hintManager.setProfile('custom');
      expect(hintManager.currentProfile).toBe('custom');
    });

    test('должен устанавливать профиль и кастомные инструкции', () => {
      hintManager.setProfile('custom', 'Мои инструкции');
      expect(hintManager.currentProfile).toBe('custom');
      expect(hintManager.customInstructions).toBe('Мои инструкции');
    });

    test('кастомные инструкции по умолчанию пустые', () => {
      hintManager.setProfile('job_interview_ru');
      expect(hintManager.customInstructions).toBe('');
    });
  });

  describe('setParams', () => {
    test('должен устанавливать contextWindowSize', () => {
      hintManager.setParams({ contextWindowSize: 5 });
      expect(hintManager.contextWindowSize).toBe(5);
    });

    test('должен устанавливать maxContextChars', () => {
      hintManager.setParams({ maxContextChars: 1000 });
      expect(hintManager.maxContextChars).toBe(1000);
    });

    test('должен устанавливать maxTokens', () => {
      hintManager.setParams({ maxTokens: 200 });
      expect(hintManager.maxTokens).toBe(200);
    });

    test('должен устанавливать temperature', () => {
      hintManager.setParams({ temperature: 0.5 });
      expect(hintManager.temperature).toBe(0.5);
    });

    test('должен устанавливать несколько параметров одновременно', () => {
      hintManager.setParams({
        contextWindowSize: 15,
        maxContextChars: 5000,
        maxTokens: 300,
        temperature: 0.3,
      });
      expect(hintManager.contextWindowSize).toBe(15);
      expect(hintManager.maxContextChars).toBe(5000);
      expect(hintManager.maxTokens).toBe(300);
      expect(hintManager.temperature).toBe(0.3);
    });

    test('должен игнорировать undefined параметры', () => {
      const original = hintManager.maxTokens;
      hintManager.setParams({ maxTokens: undefined });
      expect(hintManager.maxTokens).toBe(original);
    });
  });

  describe('setUserContext', () => {
    test('должен устанавливать контекст пользователя', () => {
      hintManager.setUserContext('Мое резюме');
      expect(hintManager.userContext).toBe('Мое резюме');
    });

    test('должен устанавливать пустую строку для null', () => {
      hintManager.setUserContext(null);
      expect(hintManager.userContext).toBe('');
    });

    test('должен устанавливать пустую строку для undefined', () => {
      hintManager.setUserContext(undefined);
      expect(hintManager.userContext).toBe('');
    });
  });

  describe('getLastInterviewerQuestion', () => {
    test('должен возвращать последний вопрос интервьюера', () => {
      hintManager.transcriptContext = [
        { text: 'первый вопрос', source: 'interviewer' },
        { text: 'ответ кандидата', source: 'candidate' },
        { text: 'второй вопрос', source: 'interviewer' },
      ];
      expect(hintManager.getLastInterviewerQuestion()).toBe('второй вопрос');
    });

    test('должен возвращать null если нет вопросов интервьюера', () => {
      hintManager.transcriptContext = [
        { text: 'ответ кандидата', source: 'candidate' },
      ];
      expect(hintManager.getLastInterviewerQuestion()).toBeNull();
    });

    test('должен возвращать null для пустого контекста', () => {
      expect(hintManager.getLastInterviewerQuestion()).toBeNull();
    });
  });

  describe('getLastTranscriptText', () => {
    test('должен возвращать последний текст транскрипта', () => {
      hintManager.transcriptContext = [
        { text: 'первый', source: 'interviewer' },
        { text: 'второй', source: 'candidate' },
      ];
      expect(hintManager.getLastTranscriptText()).toBe('второй');
    });

    test('должен возвращать пустую строку для пустого контекста', () => {
      expect(hintManager.getLastTranscriptText()).toBe('');
    });
  });

  describe('manualRequestHint', () => {
    test('не должен запрашивать подсказку если нет транскрипта', async () => {
      hintManager.app.isRunning = true;
      await hintManager.manualRequestHint();
      expect(mockApp.ui.showError).toHaveBeenCalledWith(
        'Нет транскрипта для анализа. Дождитесь речи.'
      );
    });

    test('не должен запрашивать подсказку если приложение не запущено', async () => {
      hintManager.app.isRunning = false;
      hintManager.transcriptContext = ['текст'];
      await hintManager.manualRequestHint();
      expect(mockApp.ui.showError).toHaveBeenCalledWith(
        'Нет транскрипта для анализа. Дождитесь речи.'
      );
    });
  });
});

describe('HintManager метрики', () => {
  let hintManager;

  beforeEach(() => {
    hintManager = new HintManager(mockApp);
  });

  test('метрики должны быть null при инициализации', () => {
    Object.values(hintManager.metrics).forEach((value) => {
      expect(value).toBeNull();
    });
  });
});
