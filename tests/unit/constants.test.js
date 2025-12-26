/**
 * Unit тесты для констант
 */

// Копия констант для тестирования
const SERVERS = {
  LLM: 'http://localhost:8766',
  STT: 'ws://localhost:8765',
};

const TIMEOUTS = {
  LLM_REQUEST: 60000,
  STT_RECONNECT: 5000,
  TOAST_DURATION: 3000,
  HINT_DEBOUNCE: 2000,
};

const CONTEXT = {
  WINDOW_SIZE_DEFAULT: 10,
  WINDOW_SIZE_MIN: 1,
  WINDOW_SIZE_MAX: 50,
  MAX_CHARS_DEFAULT: 3000,
  MAX_CHARS_MIN: 500,
  MAX_CHARS_MAX: 10000,
};

const LLM = {
  MAX_TOKENS_DEFAULT: 500,
  MAX_TOKENS_MIN: 50,
  MAX_TOKENS_MAX: 2000,
  TEMPERATURE_DEFAULT: 0.8,
  TEMPERATURE_MIN: 0.0,
  TEMPERATURE_MAX: 1.0,
};

const STORAGE = {
  MAX_SESSIONS: 50,
  MAX_PROMPT_LENGTH: 5000,
};

const UI = {
  COMPACT_THRESHOLD: 800,
  SCROLL_BEHAVIOR: 'smooth',
};

const SYSTEM_PROMPTS = {
  job_interview_ru: 'Промпт для интервью на русском',
  job_interview_en: 'Interview prompt in English',
  technical_ru: 'Технический промпт',
  custom: '',
  default_fallback: 'Дефолтный промпт',
};

describe('SERVERS', () => {
  test('LLM сервер должен использовать порт 8766', () => {
    expect(SERVERS.LLM).toBe('http://localhost:8766');
  });

  test('STT сервер должен использовать WebSocket на порту 8765', () => {
    expect(SERVERS.STT).toBe('ws://localhost:8765');
  });
});

describe('TIMEOUTS', () => {
  test('LLM_REQUEST должен быть 60 секунд', () => {
    expect(TIMEOUTS.LLM_REQUEST).toBe(60000);
  });

  test('STT_RECONNECT должен быть 5 секунд', () => {
    expect(TIMEOUTS.STT_RECONNECT).toBe(5000);
  });

  test('TOAST_DURATION должен быть 3 секунды', () => {
    expect(TIMEOUTS.TOAST_DURATION).toBe(3000);
  });

  test('HINT_DEBOUNCE должен быть 2 секунды', () => {
    expect(TIMEOUTS.HINT_DEBOUNCE).toBe(2000);
  });

  test('все таймауты должны быть положительными числами', () => {
    Object.values(TIMEOUTS).forEach((value) => {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThan(0);
    });
  });
});

describe('CONTEXT', () => {
  test('WINDOW_SIZE_DEFAULT должен быть 10', () => {
    expect(CONTEXT.WINDOW_SIZE_DEFAULT).toBe(10);
  });

  test('WINDOW_SIZE_MIN должен быть меньше WINDOW_SIZE_MAX', () => {
    expect(CONTEXT.WINDOW_SIZE_MIN).toBeLessThan(CONTEXT.WINDOW_SIZE_MAX);
  });

  test('WINDOW_SIZE_DEFAULT должен быть в диапазоне MIN-MAX', () => {
    expect(CONTEXT.WINDOW_SIZE_DEFAULT).toBeGreaterThanOrEqual(CONTEXT.WINDOW_SIZE_MIN);
    expect(CONTEXT.WINDOW_SIZE_DEFAULT).toBeLessThanOrEqual(CONTEXT.WINDOW_SIZE_MAX);
  });

  test('MAX_CHARS_DEFAULT должен быть 3000', () => {
    expect(CONTEXT.MAX_CHARS_DEFAULT).toBe(3000);
  });

  test('MAX_CHARS_DEFAULT должен быть в диапазоне MIN-MAX', () => {
    expect(CONTEXT.MAX_CHARS_DEFAULT).toBeGreaterThanOrEqual(CONTEXT.MAX_CHARS_MIN);
    expect(CONTEXT.MAX_CHARS_DEFAULT).toBeLessThanOrEqual(CONTEXT.MAX_CHARS_MAX);
  });
});

describe('LLM', () => {
  test('MAX_TOKENS_DEFAULT должен быть 500', () => {
    expect(LLM.MAX_TOKENS_DEFAULT).toBe(500);
  });

  test('MAX_TOKENS_DEFAULT должен быть в диапазоне MIN-MAX', () => {
    expect(LLM.MAX_TOKENS_DEFAULT).toBeGreaterThanOrEqual(LLM.MAX_TOKENS_MIN);
    expect(LLM.MAX_TOKENS_DEFAULT).toBeLessThanOrEqual(LLM.MAX_TOKENS_MAX);
  });

  test('TEMPERATURE_DEFAULT должен быть 0.8', () => {
    expect(LLM.TEMPERATURE_DEFAULT).toBe(0.8);
  });

  test('TEMPERATURE должен быть в диапазоне 0.0-1.0', () => {
    expect(LLM.TEMPERATURE_MIN).toBe(0.0);
    expect(LLM.TEMPERATURE_MAX).toBe(1.0);
  });

  test('TEMPERATURE_DEFAULT должен быть в диапазоне MIN-MAX', () => {
    expect(LLM.TEMPERATURE_DEFAULT).toBeGreaterThanOrEqual(LLM.TEMPERATURE_MIN);
    expect(LLM.TEMPERATURE_DEFAULT).toBeLessThanOrEqual(LLM.TEMPERATURE_MAX);
  });
});

describe('STORAGE', () => {
  test('MAX_SESSIONS должен быть 50', () => {
    expect(STORAGE.MAX_SESSIONS).toBe(50);
  });

  test('MAX_PROMPT_LENGTH должен быть 5000', () => {
    expect(STORAGE.MAX_PROMPT_LENGTH).toBe(5000);
  });

  test('все значения должны быть положительными числами', () => {
    Object.values(STORAGE).forEach((value) => {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThan(0);
    });
  });
});

describe('UI', () => {
  test('COMPACT_THRESHOLD должен быть 800', () => {
    expect(UI.COMPACT_THRESHOLD).toBe(800);
  });

  test('SCROLL_BEHAVIOR должен быть smooth', () => {
    expect(UI.SCROLL_BEHAVIOR).toBe('smooth');
  });
});

describe('SYSTEM_PROMPTS', () => {
  test('должен содержать промпт для job_interview_ru', () => {
    expect(SYSTEM_PROMPTS.job_interview_ru).toBeTruthy();
  });

  test('должен содержать промпт для job_interview_en', () => {
    expect(SYSTEM_PROMPTS.job_interview_en).toBeTruthy();
  });

  test('должен содержать промпт для technical_ru', () => {
    expect(SYSTEM_PROMPTS.technical_ru).toBeTruthy();
  });

  test('custom должен быть пустой строкой', () => {
    expect(SYSTEM_PROMPTS.custom).toBe('');
  });

  test('должен содержать default_fallback', () => {
    expect(SYSTEM_PROMPTS.default_fallback).toBeTruthy();
  });

  test('все промпты должны быть строками', () => {
    Object.values(SYSTEM_PROMPTS).forEach((value) => {
      expect(typeof value).toBe('string');
    });
  });
});
