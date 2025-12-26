/**
 * Unit тесты для утилит
 */

// Утилиты для тестирования
const utils = {
  formatTime(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  },

  formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },

  truncateText(text, maxLength = 100) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  },

  debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  throttle(fn, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  },

  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  },

  parseJson(str, defaultValue = null) {
    try {
      return JSON.parse(str);
    } catch {
      return defaultValue;
    }
  },

  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};

describe('formatTime', () => {
  test('должен форматировать миллисекунды', () => {
    expect(utils.formatTime(500)).toBe('500ms');
  });

  test('должен форматировать секунды', () => {
    expect(utils.formatTime(2500)).toBe('2.5s');
  });

  test('должен форматировать минуты', () => {
    expect(utils.formatTime(125000)).toBe('2m 5s');
  });

  test('должен обрабатывать 0', () => {
    expect(utils.formatTime(0)).toBe('0ms');
  });

  test('должен обрабатывать ровно 1 секунду', () => {
    expect(utils.formatTime(1000)).toBe('1.0s');
  });

  test('должен обрабатывать ровно 1 минуту', () => {
    expect(utils.formatTime(60000)).toBe('1m 0s');
  });
});

describe('formatBytes', () => {
  test('должен форматировать байты', () => {
    expect(utils.formatBytes(500)).toBe('500 B');
  });

  test('должен форматировать килобайты', () => {
    expect(utils.formatBytes(2048)).toBe('2.0 KB');
  });

  test('должен форматировать мегабайты', () => {
    expect(utils.formatBytes(1048576)).toBe('1.0 MB');
  });

  test('должен обрабатывать 0', () => {
    expect(utils.formatBytes(0)).toBe('0 B');
  });

  test('должен обрабатывать большие размеры', () => {
    expect(utils.formatBytes(5242880)).toBe('5.0 MB');
  });
});

describe('truncateText', () => {
  test('должен возвращать текст без изменений если короче лимита', () => {
    expect(utils.truncateText('короткий', 100)).toBe('короткий');
  });

  test('должен обрезать длинный текст', () => {
    const longText = 'a'.repeat(150);
    const result = utils.truncateText(longText, 100);
    expect(result.length).toBe(100);
    expect(result.endsWith('...')).toBe(true);
  });

  test('должен возвращать пустую строку для null', () => {
    expect(utils.truncateText(null)).toBe('');
  });

  test('должен возвращать пустую строку для undefined', () => {
    expect(utils.truncateText(undefined)).toBe('');
  });

  test('должен использовать дефолтный maxLength', () => {
    const longText = 'a'.repeat(150);
    const result = utils.truncateText(longText);
    expect(result.length).toBe(100);
  });

  test('должен обрабатывать текст равный maxLength', () => {
    const text = 'a'.repeat(100);
    expect(utils.truncateText(text, 100)).toBe(text);
  });
});

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('должен откладывать вызов функции', () => {
    const fn = jest.fn();
    const debounced = utils.debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('должен сбрасывать таймер при повторном вызове', () => {
    const fn = jest.fn();
    const debounced = utils.debounce(fn, 100);

    debounced();
    jest.advanceTimersByTime(50);
    debounced();
    jest.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('должен передавать аргументы', () => {
    const fn = jest.fn();
    const debounced = utils.debounce(fn, 100);

    debounced('arg1', 'arg2');
    jest.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});

describe('throttle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('должен вызывать функцию сразу', () => {
    const fn = jest.fn();
    const throttled = utils.throttle(fn, 100);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('должен игнорировать повторные вызовы в пределах лимита', () => {
    const fn = jest.fn();
    const throttled = utils.throttle(fn, 100);

    throttled();
    throttled();
    throttled();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('должен разрешать вызов после истечения лимита', () => {
    const fn = jest.fn();
    const throttled = utils.throttle(fn, 100);

    throttled();
    jest.advanceTimersByTime(100);
    throttled();

    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('hashString', () => {
  test('должен возвращать одинаковый хэш для одинаковых строк', () => {
    const hash1 = utils.hashString('тест');
    const hash2 = utils.hashString('тест');
    expect(hash1).toBe(hash2);
  });

  test('должен возвращать разные хэши для разных строк', () => {
    const hash1 = utils.hashString('тест1');
    const hash2 = utils.hashString('тест2');
    expect(hash1).not.toBe(hash2);
  });

  test('должен возвращать строку', () => {
    const hash = utils.hashString('тест');
    expect(typeof hash).toBe('string');
  });

  test('должен обрабатывать пустую строку', () => {
    const hash = utils.hashString('');
    expect(hash).toBe('0');
  });
});

describe('isValidUrl', () => {
  test('должен возвращать true для валидного http URL', () => {
    expect(utils.isValidUrl('http://example.com')).toBe(true);
  });

  test('должен возвращать true для валидного https URL', () => {
    expect(utils.isValidUrl('https://example.com')).toBe(true);
  });

  test('должен возвращать true для localhost', () => {
    expect(utils.isValidUrl('http://localhost:8080')).toBe(true);
  });

  test('должен возвращать true для WebSocket URL', () => {
    expect(utils.isValidUrl('ws://localhost:8765')).toBe(true);
  });

  test('должен возвращать false для невалидного URL', () => {
    expect(utils.isValidUrl('not a url')).toBe(false);
  });

  test('должен возвращать false для пустой строки', () => {
    expect(utils.isValidUrl('')).toBe(false);
  });
});

describe('escapeHtml', () => {
  test('должен экранировать &', () => {
    expect(utils.escapeHtml('A & B')).toBe('A &amp; B');
  });

  test('должен экранировать <', () => {
    expect(utils.escapeHtml('<tag>')).toBe('&lt;tag&gt;');
  });

  test('должен экранировать "', () => {
    expect(utils.escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  test("должен экранировать '", () => {
    expect(utils.escapeHtml("it's")).toBe('it&#039;s');
  });

  test('должен экранировать несколько символов', () => {
    expect(utils.escapeHtml('<script>alert("XSS")</script>')).toBe(
      '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
    );
  });

  test('должен не менять текст без спецсимволов', () => {
    expect(utils.escapeHtml('обычный текст')).toBe('обычный текст');
  });
});

describe('parseJson', () => {
  test('должен парсить валидный JSON', () => {
    const result = utils.parseJson('{"key": "value"}');
    expect(result).toEqual({ key: 'value' });
  });

  test('должен возвращать defaultValue для невалидного JSON', () => {
    const result = utils.parseJson('invalid', { default: true });
    expect(result).toEqual({ default: true });
  });

  test('должен возвращать null по умолчанию для невалидного JSON', () => {
    const result = utils.parseJson('invalid');
    expect(result).toBeNull();
  });

  test('должен парсить массивы', () => {
    const result = utils.parseJson('[1, 2, 3]');
    expect(result).toEqual([1, 2, 3]);
  });

  test('должен парсить примитивы', () => {
    expect(utils.parseJson('123')).toBe(123);
    expect(utils.parseJson('"string"')).toBe('string');
    expect(utils.parseJson('true')).toBe(true);
    expect(utils.parseJson('null')).toBeNull();
  });
});

describe('generateId', () => {
  test('должен возвращать строку', () => {
    const id = utils.generateId();
    expect(typeof id).toBe('string');
  });

  test('должен генерировать уникальные ID', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(utils.generateId());
    }
    expect(ids.size).toBe(100);
  });

  test('должен содержать underscore', () => {
    const id = utils.generateId();
    expect(id).toContain('_');
  });
});

describe('sleep', () => {
  test('должен возвращать Promise', () => {
    const result = utils.sleep(100);
    expect(result).toBeInstanceOf(Promise);
  });

  test('должен разрешаться после указанного времени', async () => {
    jest.useFakeTimers();

    const promise = utils.sleep(100);
    jest.advanceTimersByTime(100);

    await expect(promise).resolves.toBeUndefined();

    jest.useRealTimers();
  });
});
