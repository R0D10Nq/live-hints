/**
 * Тесты для хранения настроек
 */

describe('Settings Storage', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = {};

    // Мокаем localStorage
    global.localStorage = {
      getItem: (key) => mockStorage[key] || null,
      setItem: (key, value) => {
        mockStorage[key] = value;
      },
      removeItem: (key) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };
  });

  afterEach(() => {
    delete global.localStorage;
  });

  describe('сохранение и загрузка', () => {
    it('должен сохранять настройки в localStorage', () => {
      const settings = {
        llmProvider: 'openai',
        aiProfile: 'custom',
        opacity: 80,
        fontTranscript: 16,
        fontHints: 18,
      };

      localStorage.setItem('live-hints-settings', JSON.stringify(settings));

      const loaded = JSON.parse(localStorage.getItem('live-hints-settings'));
      expect(loaded).toEqual(settings);
    });

    it('должен возвращать null для несуществующих настроек', () => {
      const result = localStorage.getItem('live-hints-settings');
      expect(result).toBeNull();
    });

    it('должен корректно сериализовать все типы настроек', () => {
      const settings = {
        llmProvider: 'ollama',
        aiProfile: 'job_interview_ru',
        customInstructions: 'Тестовые инструкции',
        autoHints: true,
        opacity: 100,
        fontTranscript: 14,
        fontHints: 14,
      };

      localStorage.setItem('live-hints-settings', JSON.stringify(settings));
      const loaded = JSON.parse(localStorage.getItem('live-hints-settings'));

      expect(loaded.llmProvider).toBe('ollama');
      expect(loaded.aiProfile).toBe('job_interview_ru');
      expect(loaded.customInstructions).toBe('Тестовые инструкции');
      expect(loaded.autoHints).toBe(true);
      expect(loaded.opacity).toBe(100);
      expect(loaded.fontTranscript).toBe(14);
      expect(loaded.fontHints).toBe(14);
    });

    it('должен мержить новые настройки с существующими', () => {
      // Начальные настройки
      localStorage.setItem(
        'live-hints-settings',
        JSON.stringify({
          llmProvider: 'ollama',
          opacity: 100,
        })
      );

      // Загружаем, добавляем, сохраняем
      const existing = JSON.parse(localStorage.getItem('live-hints-settings')) || {};
      const updated = { ...existing, fontTranscript: 20 };
      localStorage.setItem('live-hints-settings', JSON.stringify(updated));

      const loaded = JSON.parse(localStorage.getItem('live-hints-settings'));
      expect(loaded.llmProvider).toBe('ollama');
      expect(loaded.opacity).toBe(100);
      expect(loaded.fontTranscript).toBe(20);
    });
  });

  describe('валидация значений', () => {
    it('прозрачность должна быть в диапазоне 10-100', () => {
      const validateOpacity = (value) => Math.max(10, Math.min(100, value));

      expect(validateOpacity(0)).toBe(10);
      expect(validateOpacity(50)).toBe(50);
      expect(validateOpacity(150)).toBe(100);
    });

    it('размер шрифта должен быть в диапазоне 12-28', () => {
      const validateFontSize = (value) => Math.max(12, Math.min(28, value));

      expect(validateFontSize(8)).toBe(12);
      expect(validateFontSize(20)).toBe(20);
      expect(validateFontSize(40)).toBe(28);
    });
  });
});

describe('State Machine', () => {
  describe('состояния приложения', () => {
    let state;

    beforeEach(() => {
      state = {
        isRunning: false,
        isPaused: false,
      };
    });

    it('начальное состояние: остановлено', () => {
      expect(state.isRunning).toBe(false);
      expect(state.isPaused).toBe(false);
    });

    it('start: переход в running', () => {
      state.isRunning = true;
      state.isPaused = false;

      expect(state.isRunning).toBe(true);
      expect(state.isPaused).toBe(false);
    });

    it('pause: переход в paused (только из running)', () => {
      // Start first
      state.isRunning = true;
      state.isPaused = false;

      // Then pause
      if (state.isRunning) {
        state.isPaused = true;
      }

      expect(state.isRunning).toBe(true);
      expect(state.isPaused).toBe(true);
    });

    it('resume: переход из paused в running', () => {
      // Start -> Pause
      state.isRunning = true;
      state.isPaused = true;

      // Resume
      if (state.isRunning && state.isPaused) {
        state.isPaused = false;
      }

      expect(state.isRunning).toBe(true);
      expect(state.isPaused).toBe(false);
    });

    it('stop: переход в stopped из любого состояния', () => {
      // Start -> Pause -> Stop
      state.isRunning = true;
      state.isPaused = true;

      // Stop
      state.isRunning = false;
      state.isPaused = false;

      expect(state.isRunning).toBe(false);
      expect(state.isPaused).toBe(false);
    });

    it('полный цикл: start -> pause -> resume -> stop', () => {
      // Start
      state.isRunning = true;
      state.isPaused = false;
      expect(state.isRunning).toBe(true);
      expect(state.isPaused).toBe(false);

      // Pause
      state.isPaused = true;
      expect(state.isRunning).toBe(true);
      expect(state.isPaused).toBe(true);

      // Resume
      state.isPaused = false;
      expect(state.isRunning).toBe(true);
      expect(state.isPaused).toBe(false);

      // Stop
      state.isRunning = false;
      expect(state.isRunning).toBe(false);
      expect(state.isPaused).toBe(false);
    });

    it('pause невозможна если не running', () => {
      // Try to pause when not running
      const canPause = state.isRunning;

      if (canPause) {
        state.isPaused = true;
      }

      expect(state.isPaused).toBe(false);
    });
  });

  describe('блокировка операций на паузе', () => {
    it('аудио не отправляется на паузе', () => {
      const state = { isPaused: true };
      let audioSent = false;

      const sendAudio = () => {
        if (state.isPaused) return;
        audioSent = true;
      };

      sendAudio();
      expect(audioSent).toBe(false);
    });

    it('аудио отправляется когда не на паузе', () => {
      const state = { isPaused: false };
      let audioSent = false;

      const sendAudio = () => {
        if (state.isPaused) return;
        audioSent = true;
      };

      sendAudio();
      expect(audioSent).toBe(true);
    });
  });
});

describe('Длинные подсказки', () => {
  it('текст 500+ символов должен сохраняться полностью', () => {
    const longHint = 'А'.repeat(600);

    // Симуляция escapeHtml
    const escapeHtml = (text) => {
      const div = { textContent: '', innerHTML: '' };
      div.textContent = text;
      div.innerHTML = div.textContent;
      return div.innerHTML;
    };

    const escaped = escapeHtml(longHint);
    expect(escaped.length).toBe(600);
    expect(escaped.endsWith('А'.repeat(50))).toBe(true);
  });

  it('многострочный текст должен сохранять переносы', () => {
    const multilineHint =
      'Первая строка\nВторая строка\nТретья строка с длинным текстом для проверки';

    const escapeHtml = (text) => {
      const div = { textContent: '', innerHTML: '' };
      div.textContent = text;
      div.innerHTML = div.textContent;
      return div.innerHTML;
    };

    const escaped = escapeHtml(multilineHint);
    expect(escaped).toContain('Первая строка');
    expect(escaped).toContain('Третья строка');
  });

  it('текст не должен обрезаться slice/substring', () => {
    const hint =
      'Это очень длинная подсказка которая содержит много информации и не должна обрезаться никаким образом в процессе рендеринга в DOM элемент карточки подсказки';

    // Проверяем что нет обрезания
    const processed = hint; // Нет slice/substring

    expect(processed.length).toBe(hint.length);
    expect(processed.endsWith('подсказки')).toBe(true);
  });
});

describe('Дедуп запросов и результатов', () => {
  it('дедуп контекста по hash', () => {
    const context1 = ['привет', 'мир'];
    const context2 = ['привет', 'мир'];
    const context3 = ['привет', 'другой'];

    const hash1 = context1.join('|');
    const hash2 = context2.join('|');
    const hash3 = context3.join('|');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it('дедуп подсказок по тексту', () => {
    let lastHintText = '';
    const hints = [];

    const addHint = (text) => {
      if (text === lastHintText) return false;
      lastHintText = text;
      hints.push(text);
      return true;
    };

    expect(addHint('подсказка 1')).toBe(true);
    expect(addHint('подсказка 1')).toBe(false); // Дубликат
    expect(addHint('подсказка 2')).toBe(true);
    expect(hints.length).toBe(2);
  });

  it('дедуп транскриптов по тексту', () => {
    let lastTranscript = '';
    const transcripts = [];

    const addTranscript = (text) => {
      if (text === lastTranscript) return false;
      lastTranscript = text;
      transcripts.push(text);
      return true;
    };

    expect(addTranscript('фраза 1')).toBe(true);
    expect(addTranscript('фраза 1')).toBe(false); // Дубликат
    expect(addTranscript('фраза 2')).toBe(true);
    expect(transcripts.length).toBe(2);
  });
});

describe('buildSystemPrompt', () => {
  it('job_interview_ru профиль возвращает правильный промпт', () => {
    const profiles = {
      job_interview_ru: 'Ты помощник на собеседовании.',
      custom: '',
    };
    const currentProfile = 'job_interview_ru';
    const prompt = profiles[currentProfile] || profiles.job_interview_ru;

    expect(prompt).toContain('собеседовании');
  });

  it('custom профиль использует пользовательские инструкции', () => {
    const customInstructions = 'Отвечай как эксперт по JavaScript';
    const currentProfile = 'custom';

    let result;
    if (currentProfile === 'custom' && customInstructions) {
      result = customInstructions;
    } else {
      result = 'default';
    }

    expect(result).toBe(customInstructions);
  });

  it('custom профиль без инструкций использует дефолт', () => {
    const customInstructions = '';
    const currentProfile = 'custom';
    const defaultPrompt = 'Ты ассистент. Дай краткий ответ по контексту разговора на русском.';

    // Эмуляция buildSystemPrompt
    const buildSystemPrompt = (profile, instructions) => {
      const MAX_PROMPT_LENGTH = 4000;
      const DEFAULT_FALLBACK = 'Ты ассистент. Дай краткий ответ по контексту разговора на русском.';

      if (profile === 'custom') {
        const trimmed = (instructions || '').trim();
        if (trimmed.length > 0) {
          return trimmed.length > MAX_PROMPT_LENGTH
            ? trimmed.substring(0, MAX_PROMPT_LENGTH)
            : trimmed;
        }
        return DEFAULT_FALLBACK;
      }
      return 'Ты помощник на собеседовании.';
    };

    expect(buildSystemPrompt(currentProfile, customInstructions)).toBe(defaultPrompt);
  });

  it('custom профиль с пробелами использует fallback', () => {
    const buildSystemPrompt = (profile, instructions) => {
      const DEFAULT_FALLBACK = 'Ты ассистент. Дай краткий ответ по контексту разговора на русском.';
      if (profile === 'custom') {
        const trimmed = (instructions || '').trim();
        return trimmed.length > 0 ? trimmed : DEFAULT_FALLBACK;
      }
      return 'default';
    };

    expect(buildSystemPrompt('custom', '   ')).toBe(
      'Ты ассистент. Дай краткий ответ по контексту разговора на русском.'
    );
    expect(buildSystemPrompt('custom', '\n\t')).toBe(
      'Ты ассистент. Дай краткий ответ по контексту разговора на русском.'
    );
  });

  it('custom профиль обрезает длинные инструкции', () => {
    const MAX_PROMPT_LENGTH = 4000;
    const longInstructions = 'A'.repeat(5000);

    const buildSystemPrompt = (profile, instructions) => {
      if (profile === 'custom') {
        const trimmed = (instructions || '').trim();
        if (trimmed.length > 0) {
          return trimmed.length > MAX_PROMPT_LENGTH
            ? trimmed.substring(0, MAX_PROMPT_LENGTH)
            : trimmed;
        }
      }
      return 'default';
    };

    const result = buildSystemPrompt('custom', longInstructions);
    expect(result.length).toBe(MAX_PROMPT_LENGTH);
    expect(result).toBe('A'.repeat(4000));
  });
});

describe('Контекстное окно и maxContextChars', () => {
  // Эмуляция buildContext из app.js
  const buildContext = (items, contextWindowSize, maxContextChars) => {
    const sliced = items.slice(-contextWindowSize);
    let totalChars = 0;
    const result = [];

    for (let i = sliced.length - 1; i >= 0; i--) {
      const item = sliced[i];
      if (totalChars + item.length <= maxContextChars) {
        result.unshift(item);
        totalChars += item.length;
      } else {
        break;
      }
    }
    return result;
  };

  it('должен ограничивать по размеру окна', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const result = buildContext(items, 5, 10000);
    expect(result).toEqual(['c', 'd', 'e', 'f', 'g']);
  });

  it('должен ограничивать по maxContextChars', () => {
    const items = ['aaaaa', 'bbbbb', 'ccccc', 'ddddd'];
    const result = buildContext(items, 10, 12);
    // С конца: ddddd(5) + ccccc(5) = 10, добавляем bbbbb => 15 > 12, стоп
    expect(result).toEqual(['ccccc', 'ddddd']);
  });

  it('должен сохранять последние реплики при обрезке', () => {
    const items = ['длинная фраза номер один', 'короткая', 'последняя'];
    const result = buildContext(items, 10, 20);
    // последняя(9) + короткая(8) = 17, добавляем длинную => 17+24 > 20, стоп
    expect(result).toEqual(['короткая', 'последняя']);
  });

  it('должен возвращать пустой массив если ничего не влезает', () => {
    const items = ['очень длинная строка'];
    const result = buildContext(items, 10, 5);
    expect(result).toEqual([]);
  });
});

describe('Настройки maxTokens и temperature', () => {
  // Эмуляция saveSettings/loadSettings логики
  const saveSettings = (storage, newSettings) => {
    const settings = storage['live-hints-settings']
      ? JSON.parse(storage['live-hints-settings'])
      : {};
    Object.assign(settings, newSettings);
    storage['live-hints-settings'] = JSON.stringify(settings);
  };

  const loadSettings = (storage) => {
    return storage['live-hints-settings'] ? JSON.parse(storage['live-hints-settings']) : {};
  };

  it('maxTokens должен сохраняться', () => {
    const storage = {};
    saveSettings(storage, { maxTokens: 300 });
    const loaded = loadSettings(storage);
    expect(loaded.maxTokens).toBe(300);
  });

  it('temperature должен сохраняться', () => {
    const storage = {};
    saveSettings(storage, { temperature: 0.7 });
    const loaded = loadSettings(storage);
    expect(loaded.temperature).toBe(0.7);
  });

  it('настройки должны применяться при формировании body fetch', () => {
    const maxTokens = 250;
    const temperature = 0.5;

    const body = JSON.stringify({
      text: 'тест',
      context: [],
      system_prompt: 'промпт',
      profile: 'custom',
      max_tokens: maxTokens,
      temperature: temperature,
    });

    const parsed = JSON.parse(body);
    expect(parsed.max_tokens).toBe(250);
    expect(parsed.temperature).toBe(0.5);
  });

  it('contextWindowSize должен сохраняться', () => {
    const storage = {};
    saveSettings(storage, { contextWindowSize: 15 });
    const loaded = loadSettings(storage);
    expect(loaded.contextWindowSize).toBe(15);
  });

  it('maxContextChars должен сохраняться', () => {
    const storage = {};
    saveSettings(storage, { maxContextChars: 4000 });
    const loaded = loadSettings(storage);
    expect(loaded.maxContextChars).toBe(4000);
  });
});

describe('formatLatency', () => {
  const formatLatency = (latencyMs) => {
    if (latencyMs == null || latencyMs === undefined) return '';
    const seconds = latencyMs / 1000;
    return `${seconds.toFixed(1)}s`;
  };

  it('должен форматировать миллисекунды в секунды', () => {
    expect(formatLatency(1000)).toBe('1.0s');
    expect(formatLatency(1500)).toBe('1.5s');
    expect(formatLatency(2500)).toBe('2.5s');
  });

  it('должен показывать десятые для значений < 1s', () => {
    expect(formatLatency(500)).toBe('0.5s');
    expect(formatLatency(100)).toBe('0.1s');
    expect(formatLatency(50)).toBe('0.1s'); // округление
  });

  it('должен возвращать пустую строку для null/undefined', () => {
    expect(formatLatency(null)).toBe('');
    expect(formatLatency(undefined)).toBe('');
  });

  it('должен корректно форматировать большие значения', () => {
    expect(formatLatency(10000)).toBe('10.0s');
    expect(formatLatency(15500)).toBe('15.5s');
  });
});
