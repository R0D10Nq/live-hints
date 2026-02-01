/**
 * Jest setup file
 * Глобальные настройки для всех тестов
 */

// Увеличиваем таймаут для медленных тестов
jest.setTimeout(30000);

// Мок для console чтобы не засорять вывод
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Мок для performance.now если недоступен
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
  };
}

// Мок для localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Мок для fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
);

// Мок для AbortController
global.AbortController = class AbortController {
  constructor() {
    this.signal = { aborted: false };
  }
  abort() {
    this.signal.aborted = true;
  }
};

// Мок для TextDecoder/TextEncoder
global.TextDecoder = class TextDecoder {
  decode(buffer) {
    if (buffer instanceof Uint8Array) {
      return String.fromCharCode.apply(null, buffer);
    }
    return '';
  }
};

global.TextEncoder = class TextEncoder {
  encode(str) {
    const arr = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      arr[i] = str.charCodeAt(i);
    }
    return arr;
  }
};

// Мок для navigator.clipboard
Object.defineProperty(global, 'navigator', {
  value: {
    clipboard: {
      writeText: jest.fn(() => Promise.resolve()),
      readText: jest.fn(() => Promise.resolve('')),
    },
    mediaDevices: {
      getUserMedia: jest.fn(() => Promise.resolve({ getTracks: () => [] })),
      getDisplayMedia: jest.fn(() => Promise.resolve({ getTracks: () => [] })),
      enumerateDevices: jest.fn(() => Promise.resolve([])),
    },
  },
  writable: true,
});

// Мок для URL
class MockURL {
  constructor(url) {
    this.url = url;
  }
  static createObjectURL(blob) {
    return 'blob:mock-url';
  }
  static revokeObjectURL(url) { }
}

global.URL = MockURL;

// Мок для Blob
global.Blob = class Blob {
  constructor(content, options) {
    this.content = content;
    this.type = options?.type || '';
    this.size = content ? content.reduce((acc, part) => acc + part.length, 0) : 0;
  }
};

// Мок для FileReader
global.FileReader = class FileReader {
  constructor() {
    this.result = null;
    this.onload = null;
    this.onerror = null;
  }
  readAsText(blob) {
    setTimeout(() => {
      this.result = blob.content ? blob.content.join('') : '';
      if (this.onload) this.onload({ target: this });
    }, 0);
  }
  readAsArrayBuffer(blob) {
    setTimeout(() => {
      this.result = new ArrayBuffer(0);
      if (this.onload) this.onload({ target: this });
    }, 0);
  }
};

// Очистка моков после каждого теста
afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
});

// Глобальный обработчик необработанных промисов
process.on('unhandledRejection', (reason, promise) => {
  // Игнорируем в тестах
});
