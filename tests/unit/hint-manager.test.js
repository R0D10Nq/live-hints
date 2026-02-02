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

  describe('checkHealth', () => {
    test('должен показывать статус при успешном ответе', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', model: 'test-model' }),
      });

      await hintManager.checkHealth();

      expect(mockApp.ui.showToast).toHaveBeenCalledWith(
        'LLM: ok, модель: test-model',
        'success'
      );
    });

    test('должен показывать ошибку при неуспешном ответе', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
      });

      await hintManager.checkHealth();

      expect(mockApp.ui.showError).toHaveBeenCalledWith('LLM сервер недоступен');
    });

    test('должен показывать ошибку при исключении', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Connection refused'));

      await hintManager.checkHealth();

      expect(mockApp.ui.showError).toHaveBeenCalledWith(
        expect.stringContaining('LLM сервер не отвечает')
      );
    });
  });

  describe('clearContext', () => {
    test('должен очищать контекст и хеш', () => {
      hintManager.transcriptContext = ['тест'];
      hintManager.lastContextHash = 'hash123';

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
      hintManager.setProfile('custom', 'мои инструкции');
      expect(hintManager.currentProfile).toBe('custom');
      expect(hintManager.customInstructions).toBe('мои инструкции');
    });

    test('кастомные инструкции по умолчанию пустые', () => {
      hintManager.setProfile('job_interview_ru');
      expect(hintManager.customInstructions).toBe('');
    });
  });

  describe('setParams', () => {
    test('должен устанавливать contextWindowSize', () => {
      hintManager.setParams({ contextWindowSize: 20 });
      expect(hintManager.contextWindowSize).toBe(20);
    });

    test('должен устанавливать maxContextChars', () => {
      hintManager.setParams({ maxContextChars: 5000 });
      expect(hintManager.maxContextChars).toBe(5000);
    });

    test('должен устанавливать maxTokens', () => {
      hintManager.setParams({ maxTokens: 1000 });
      expect(hintManager.maxTokens).toBe(1000);
    });

    test('должен устанавливать temperature', () => {
      hintManager.setParams({ temperature: 0.5 });
      expect(hintManager.temperature).toBe(0.5);
    });

    test('должен устанавливать несколько параметров одновременно', () => {
      hintManager.setParams({ maxTokens: 1000, temperature: 0.5 });
      expect(hintManager.maxTokens).toBe(1000);
      expect(hintManager.temperature).toBe(0.5);
    });

    test('должен игнорировать undefined параметры', () => {
      const originalTokens = hintManager.maxTokens;
      hintManager.setParams({ maxTokens: undefined, temperature: 0.5 });
      expect(hintManager.maxTokens).toBe(originalTokens);
      expect(hintManager.temperature).toBe(0.5);
    });
  });

  describe('getReadableError', () => {
    test('должен возвращать сообщение для AbortError', () => {
      const error = new Error('AbortError');
      error.name = 'AbortError';
      const result = hintManager.getReadableError(error);
      expect(result).toContain('Таймаут');
    });

    test('должен возвращать сообщение для сетевой ошибки', () => {
      const error = new Error('NetworkError: Failed to fetch');
      const result = hintManager.getReadableError(error);
      expect(result).toContain('сети');
    });

    test('должен возвращать сообщение для fetch ошибки', () => {
      const error = new Error('Failed to fetch');
      const result = hintManager.getReadableError(error);
      expect(result).toContain('недоступен');
    });

    test('должен возвращать сообщение для ECONNREFUSED', () => {
      const error = new Error('ECONNREFUSED');
      const result = hintManager.getReadableError(error);
      expect(result).toContain('не запущен');
    });

    test('должен возвращать дефолтное сообщение для неизвестной ошибки', () => {
      const error = new Error('Unknown error');
      const result = hintManager.getReadableError(error);
      expect(result).toBe('Ошибка: Unknown error');
    });

    test('должен возвращать дефолтное сообщение если нет message', () => {
      const error = {};
      const result = hintManager.getReadableError(error);
      expect(result).toBe('Ошибка: Неизвестная ошибка');
    });
  });

  describe('buildContext', () => {
    test('должен строить контекст из объектов с source', () => {
      hintManager.transcriptContext = [
        { text: 'Вопрос интервьюера', source: 'interviewer', timestamp: Date.now() },
        { text: 'Ответ кандидата', source: 'candidate', timestamp: Date.now() },
      ];
      hintManager.contextWindowSize = 10;
      hintManager.maxContextChars = 1000;

      const context = hintManager.buildContext();

      expect(context).toHaveLength(2);
      expect(context[0]).toContain('🎙️ Интервьюер');
      expect(context[0]).toContain('Вопрос интервьюера');
      expect(context[1]).toContain('🗣️ Ты');
      expect(context[1]).toContain('Ответ кандидата');
    });

    test('должен ограничивать контекст по maxContextChars', () => {
      hintManager.transcriptContext = [
        { text: 'Короткий текст', source: 'candidate', timestamp: Date.now() },
        { text: 'Очень длинный текст который не поместится в лимит символов', source: 'interviewer', timestamp: Date.now() },
      ];
      hintManager.maxContextChars = 30;

      const context = hintManager.buildContext();

      expect(context.length).toBeLessThanOrEqual(2);
    });

    test('должен поддерживать строки для обратной совместимости', () => {
      hintManager.transcriptContext = ['Простая строка'];

      const context = hintManager.buildContext();

      expect(context).toHaveLength(1);
      expect(context[0]).toBe('Простая строка');
    });
  });

  describe('buildSystemPrompt', () => {
    test('должен возвращать prompt для job_interview_ru', () => {
      hintManager.currentProfile = 'job_interview_ru';
      const prompt = hintManager.buildSystemPrompt();
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
    });

    test('должен возвращать custom инструкции для custom профиля', () => {
      hintManager.currentProfile = 'custom';
      hintManager.customInstructions = 'Мои кастомные инструкции';
      const prompt = hintManager.buildSystemPrompt();
      expect(prompt).toBe('Мои кастомные инструкции');
    });

    test('должен возвращать fallback для custom профиля без инструкций', () => {
      hintManager.currentProfile = 'custom';
      hintManager.customInstructions = '';
      const prompt = hintManager.buildSystemPrompt();
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
    });

    test('должен обрезать слишком длинные custom инструкции', () => {
      hintManager.currentProfile = 'custom';
      hintManager.customInstructions = 'a'.repeat(10000);
      const prompt = hintManager.buildSystemPrompt();
      expect(prompt.length).toBeLessThanOrEqual(5000);
    });
  });

  describe('setUserContext', () => {
    test('должен устанавливать контекст пользователя', () => {
      hintManager.setUserContext('Резюме пользователя');
      expect(hintManager.userContext).toBe('Резюме пользователя');
    });

    test('должен устанавливать пустую строку для falsy значений', () => {
      hintManager.setUserContext(null);
      expect(hintManager.userContext).toBe('');
    });
  });

  describe('sendDirectMessage', () => {
    test('должен вызывать requestHint для непустого сообщения', async () => {
      hintManager.requestHint = jest.fn().mockResolvedValue();
      await hintManager.sendDirectMessage('Помоги мне');
      expect(hintManager.requestHint).toHaveBeenCalled();
    });

    test('не должен вызывать requestHint для пустого сообщения', async () => {
      hintManager.requestHint = jest.fn().mockResolvedValue();
      await hintManager.sendDirectMessage('   ');
      expect(hintManager.requestHint).not.toHaveBeenCalled();
    });

    test('не должен вызывать requestHint для null', async () => {
      hintManager.requestHint = jest.fn().mockResolvedValue();
      await hintManager.sendDirectMessage(null);
      expect(hintManager.requestHint).not.toHaveBeenCalled();
    });
  });

  describe('requestHint', () => {
    test('не должен делать запрос при дубликате контекста', async () => {
      hintManager.transcriptContext = [{ text: 'тест', source: 'interviewer' }];
      hintManager.buildContext = jest.fn().mockReturnValue(['контекст']);
      hintManager.lastContextHash = 'контекст';
      global.fetch = jest.fn();

      await hintManager.requestHint('тест');

      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('не должен делать запрос если запрос уже в процессе', async () => {
      hintManager.hintRequestPending = true;
      global.fetch = jest.fn();

      await hintManager.requestHint('тест');

      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('должен обрабатывать ошибку ответа сервера', async () => {
      hintManager.transcriptContext = [];
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        text: jest.fn().mockResolvedValue('Server error'),
      });

      await hintManager.requestHint('тест');

      expect(mockApp.ui.showError).toHaveBeenCalled();
      expect(hintManager.hintRequestPending).toBe(false);
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
