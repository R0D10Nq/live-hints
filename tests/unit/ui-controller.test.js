/**
 * @jest-environment jsdom
 *
 * Unit тесты для UIController
 */

// Мок DOM элементов
const createMockElement = (innerHTML = '') => ({
  innerHTML,
  textContent: '',
  classList: {
    add: jest.fn(),
    remove: jest.fn(),
    toggle: jest.fn(),
    contains: jest.fn(() => false),
  },
  style: {},
  querySelector: jest.fn(() => null),
  querySelectorAll: jest.fn(() => []),
  appendChild: jest.fn(),
  removeChild: jest.fn(),
  remove: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  scrollTo: jest.fn(),
  focus: jest.fn(),
  disabled: false,
  checked: false,
  value: '',
});

// Мок document
const mockElements = {
  transcriptFeed: createMockElement(),
  hintsFeed: createMockElement(),
  statusText: createMockElement(),
  statusDot: createMockElement(),
  btnToggle: createMockElement(),
  btnPause: createMockElement(),
  errorToast: createMockElement(),
  errorMessage: createMockElement(),
  paginationCounter: createMockElement(),
  btnPrevHint: createMockElement(),
  btnNextHint: createMockElement(),
};

document.getElementById = jest.fn((id) => {
  const mapping = {
    'transcript-feed': mockElements.transcriptFeed,
    'hints-feed': mockElements.hintsFeed,
    'status-text': mockElements.statusText,
    'status-dot': mockElements.statusDot,
    'btn-toggle': mockElements.btnToggle,
    'btn-pause': mockElements.btnPause,
    'error-toast': mockElements.errorToast,
    'error-message': mockElements.errorMessage,
    'pagination-counter': mockElements.paginationCounter,
    'btn-prev-hint': mockElements.btnPrevHint,
    'btn-next-hint': mockElements.btnNextHint,
  };
  return mapping[id] || null;
});

document.querySelector = jest.fn(() => createMockElement());
document.querySelectorAll = jest.fn(() => []);
document.createElement = jest.fn(() => createMockElement());

// Мок requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 0));

// Мок navigator.clipboard
global.navigator.clipboard = {
  writeText: jest.fn(() => Promise.resolve()),
};

// Константы
const TIMEOUTS = { TOAST_DURATION: 3000 };

// Мок приложения
const mockApp = {
  debugMode: false,
  lastContextHash: '',
};

// UIController класс (упрощенная версия для тестов)
class UIController {
  constructor(app) {
    this.app = app;
    this.hints = [];
    this.currentHintIndex = 0;
    this.lastTranscriptText = '';
    this.lastHintText = '';
    this.elements = {
      transcriptFeed: document.getElementById('transcript-feed'),
      hintsFeed: document.getElementById('hints-feed'),
      statusText: document.getElementById('status-text'),
      statusDot: document.getElementById('status-dot'),
      btnToggle: document.getElementById('btn-toggle'),
      btnPause: document.getElementById('btn-pause'),
      errorToast: document.getElementById('error-toast'),
      errorMessage: document.getElementById('error-message'),
      paginationCounter: document.getElementById('pagination-counter'),
      btnPrevHint: document.getElementById('btn-prev-hint'),
      btnNextHint: document.getElementById('btn-next-hint'),
    };
  }

  updateStatus(status) {
    const statusMap = {
      idle: { text: 'Готов', class: 'idle' },
      listening: { text: 'Слушаю...', class: 'listening' },
      processing: { text: 'Обработка...', class: 'processing' },
      error: { text: 'Ошибка', class: 'error' },
    };
    const info = statusMap[status] || statusMap.idle;
    if (this.elements.statusText) {
      this.elements.statusText.textContent = info.text;
    }
  }

  clearFeeds() {
    if (this.elements.transcriptFeed) {
      this.elements.transcriptFeed.innerHTML = '';
    }
    if (this.elements.hintsFeed) {
      this.elements.hintsFeed.innerHTML = '';
    }
    this.lastTranscriptText = '';
    this.lastHintText = '';
    this.hints = [];
    this.currentHintIndex = 0;
    this.updatePaginationButtons();
  }

  updatePaginationButtons() {
    const prevBtn = this.elements.btnPrevHint;
    const nextBtn = this.elements.btnNextHint;
    const counter = this.elements.paginationCounter;

    if (prevBtn) {
      prevBtn.disabled = this.currentHintIndex <= 0;
    }
    if (nextBtn) {
      nextBtn.disabled = this.currentHintIndex >= this.hints.length - 1;
    }
    if (counter) {
      if (this.hints.length > 0) {
        counter.textContent = `${this.currentHintIndex + 1} / ${this.hints.length}`;
      } else {
        counter.textContent = '0 / 0';
      }
    }
  }

  showPrevHint() {
    if (this.currentHintIndex > 0) {
      this.currentHintIndex--;
      this.displayCurrentHint('slide-right');
    }
  }

  showNextHint() {
    if (this.currentHintIndex < this.hints.length - 1) {
      this.currentHintIndex++;
      this.displayCurrentHint('slide-left');
    }
  }

  goToLastHint() {
    if (this.hints.length > 0) {
      this.currentHintIndex = this.hints.length - 1;
      this.displayCurrentHint('slide-left');
    }
  }

  displayCurrentHint(animation = null) {
    const feed = this.elements.hintsFeed;
    if (!feed || this.hints.length === 0) {
      return;
    }

    feed.innerHTML = '';
    const hint = this.hints[this.currentHintIndex];

    const card = document.createElement('div');
    card.className = `hint-card hint-page${animation ? ` ${animation}` : ''}`;
    card.innerHTML = `<div class="hint-content">${hint.text}</div>`;

    feed.appendChild(card);
    this.updatePaginationButtons();
  }

  finalizeStreamingHint(element, text, options = {}) {
    if (!element) return;

    const { latencyMs, cached, questionType } = options;

    this.hints.push({
      text: text,
      timestamp: new Date().toISOString(),
      latencyMs: latencyMs,
      cached: cached,
      questionType: questionType,
    });

    element.remove();

    this.currentHintIndex = this.hints.length - 1;
    this.displayCurrentHint('slide-left');
  }

  getTranscriptText() {
    const items = this.elements.transcriptFeed?.querySelectorAll('.feed-item-text');
    return items
      ? Array.from(items)
        .map((el) => el.textContent)
        .join('\n')
      : '';
  }

  getHintsText() {
    if (this.hints && this.hints.length > 0) {
      return this.hints.map((hint, index) => `[${index + 1}] ${hint.text}`).join('\n\n');
    }
    const items = this.elements.hintsFeed?.querySelectorAll('.feed-item-text, .hint-content');
    return items
      ? Array.from(items)
        .map((el) => el.textContent)
        .join('\n')
      : '';
  }

  showToast(message, type = 'info') {
    if (this.elements.errorMessage) {
      this.elements.errorMessage.textContent = message;
    }
  }

  showError(message) {
    this.showToast(message, 'error');
  }

  copyHintToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('Скопировано', 'success');
    });
  }
}

describe('UIController', () => {
  let uiController;

  beforeEach(() => {
    uiController = new UIController(mockApp);
    jest.clearAllMocks();
  });

  describe('конструктор', () => {
    test('должен инициализировать hints как пустой массив', () => {
      expect(uiController.hints).toEqual([]);
    });

    test('должен инициализировать currentHintIndex как 0', () => {
      expect(uiController.currentHintIndex).toBe(0);
    });

    test('должен инициализировать lastTranscriptText как пустую строку', () => {
      expect(uiController.lastTranscriptText).toBe('');
    });

    test('должен инициализировать lastHintText как пустую строку', () => {
      expect(uiController.lastHintText).toBe('');
    });

    test('должен получать DOM элементы', () => {
      expect(uiController.elements.transcriptFeed).toBeDefined();
      expect(uiController.elements.hintsFeed).toBeDefined();
    });
  });

  describe('updateStatus', () => {
    test('должен обновлять текст статуса для idle', () => {
      uiController.updateStatus('idle');
      expect(uiController.elements.statusText.textContent).toBe('Готов');
    });

    test('должен обновлять текст статуса для listening', () => {
      uiController.updateStatus('listening');
      expect(uiController.elements.statusText.textContent).toBe('Слушаю...');
    });

    test('должен обновлять текст статуса для processing', () => {
      uiController.updateStatus('processing');
      expect(uiController.elements.statusText.textContent).toBe('Обработка...');
    });

    test('должен обновлять текст статуса для error', () => {
      uiController.updateStatus('error');
      expect(uiController.elements.statusText.textContent).toBe('Ошибка');
    });

    test('должен использовать idle для неизвестного статуса', () => {
      uiController.updateStatus('unknown');
      expect(uiController.elements.statusText.textContent).toBe('Готов');
    });
  });

  describe('clearFeeds', () => {
    test('должен очищать innerHTML фидов', () => {
      uiController.clearFeeds();
      expect(uiController.elements.transcriptFeed.innerHTML).toBe('');
      expect(uiController.elements.hintsFeed.innerHTML).toBe('');
    });

    test('должен сбрасывать lastTranscriptText', () => {
      uiController.lastTranscriptText = 'текст';
      uiController.clearFeeds();
      expect(uiController.lastTranscriptText).toBe('');
    });

    test('должен сбрасывать lastHintText', () => {
      uiController.lastHintText = 'подсказка';
      uiController.clearFeeds();
      expect(uiController.lastHintText).toBe('');
    });

    test('должен очищать массив hints', () => {
      uiController.hints = [{ text: 'подсказка' }];
      uiController.clearFeeds();
      expect(uiController.hints).toEqual([]);
    });

    test('должен сбрасывать currentHintIndex', () => {
      uiController.currentHintIndex = 5;
      uiController.clearFeeds();
      expect(uiController.currentHintIndex).toBe(0);
    });
  });

  describe('updatePaginationButtons', () => {
    test('должен отключать prev кнопку на первой странице', () => {
      uiController.hints = [{ text: '1' }, { text: '2' }];
      uiController.currentHintIndex = 0;
      uiController.updatePaginationButtons();
      expect(uiController.elements.btnPrevHint.disabled).toBe(true);
    });

    test('должен включать prev кнопку не на первой странице', () => {
      uiController.hints = [{ text: '1' }, { text: '2' }];
      uiController.currentHintIndex = 1;
      uiController.updatePaginationButtons();
      expect(uiController.elements.btnPrevHint.disabled).toBe(false);
    });

    test('должен отключать next кнопку на последней странице', () => {
      uiController.hints = [{ text: '1' }, { text: '2' }];
      uiController.currentHintIndex = 1;
      uiController.updatePaginationButtons();
      expect(uiController.elements.btnNextHint.disabled).toBe(true);
    });

    test('должен обновлять счётчик страниц', () => {
      uiController.hints = [{ text: '1' }, { text: '2' }, { text: '3' }];
      uiController.currentHintIndex = 1;
      uiController.updatePaginationButtons();
      expect(uiController.elements.paginationCounter.textContent).toBe('2 / 3');
    });

    test('должен показывать 0 / 0 если нет подсказок', () => {
      uiController.hints = [];
      uiController.updatePaginationButtons();
      expect(uiController.elements.paginationCounter.textContent).toBe('0 / 0');
    });
  });

  describe('showPrevHint', () => {
    test('должен уменьшать currentHintIndex', () => {
      uiController.hints = [{ text: '1' }, { text: '2' }];
      uiController.currentHintIndex = 1;
      uiController.showPrevHint();
      expect(uiController.currentHintIndex).toBe(0);
    });

    test('не должен уменьшать ниже 0', () => {
      uiController.hints = [{ text: '1' }, { text: '2' }];
      uiController.currentHintIndex = 0;
      uiController.showPrevHint();
      expect(uiController.currentHintIndex).toBe(0);
    });
  });

  describe('showNextHint', () => {
    test('должен увеличивать currentHintIndex', () => {
      uiController.hints = [{ text: '1' }, { text: '2' }];
      uiController.currentHintIndex = 0;
      uiController.showNextHint();
      expect(uiController.currentHintIndex).toBe(1);
    });

    test('не должен увеличивать выше максимума', () => {
      uiController.hints = [{ text: '1' }, { text: '2' }];
      uiController.currentHintIndex = 1;
      uiController.showNextHint();
      expect(uiController.currentHintIndex).toBe(1);
    });
  });

  describe('goToLastHint', () => {
    test('должен переходить к последней подсказке', () => {
      uiController.hints = [{ text: '1' }, { text: '2' }, { text: '3' }];
      uiController.currentHintIndex = 0;
      uiController.goToLastHint();
      expect(uiController.currentHintIndex).toBe(2);
    });

    test('не должен ничего делать если нет подсказок', () => {
      uiController.hints = [];
      uiController.currentHintIndex = 0;
      uiController.goToLastHint();
      expect(uiController.currentHintIndex).toBe(0);
    });
  });

  describe('finalizeStreamingHint', () => {
    test('должен добавлять подсказку в массив', () => {
      const element = createMockElement();
      uiController.finalizeStreamingHint(element, 'Новая подсказка', {
        latencyMs: 100,
        cached: false,
        questionType: 'technical',
      });

      expect(uiController.hints).toHaveLength(1);
      expect(uiController.hints[0].text).toBe('Новая подсказка');
      expect(uiController.hints[0].latencyMs).toBe(100);
      expect(uiController.hints[0].cached).toBe(false);
      expect(uiController.hints[0].questionType).toBe('technical');
    });

    test('должен удалять element', () => {
      const element = createMockElement();
      uiController.finalizeStreamingHint(element, 'Текст');
      expect(element.remove).toHaveBeenCalled();
    });

    test('должен переходить к последней подсказке', () => {
      uiController.hints = [{ text: '1' }];
      const element = createMockElement();
      uiController.finalizeStreamingHint(element, '2');
      expect(uiController.currentHintIndex).toBe(1);
    });

    test('не должен делать ничего если element null', () => {
      uiController.finalizeStreamingHint(null, 'Текст');
      expect(uiController.hints).toHaveLength(0);
    });
  });

  describe('getHintsText', () => {
    test('должен возвращать текст из массива hints', () => {
      uiController.hints = [{ text: 'Подсказка 1' }, { text: 'Подсказка 2' }];
      const result = uiController.getHintsText();
      expect(result).toBe('[1] Подсказка 1\n\n[2] Подсказка 2');
    });

    test('должен возвращать пустую строку если нет подсказок', () => {
      uiController.hints = [];
      const result = uiController.getHintsText();
      expect(result).toBe('');
    });
  });

  describe('showToast', () => {
    test('должен устанавливать текст сообщения', () => {
      uiController.showToast('Тестовое сообщение');
      expect(uiController.elements.errorMessage.textContent).toBe('Тестовое сообщение');
    });
  });

  describe('showError', () => {
    test('должен вызывать showToast с типом error', () => {
      const spy = jest.spyOn(uiController, 'showToast');
      uiController.showError('Ошибка');
      expect(spy).toHaveBeenCalledWith('Ошибка', 'error');
    });
  });

  describe('copyHintToClipboard', () => {
    test('должен копировать текст в буфер обмена', async () => {
      await uiController.copyHintToClipboard('Текст для копирования');
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Текст для копирования');
    });

    test('не должен копировать пустой текст', () => {
      uiController.copyHintToClipboard('');
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });

    test('не должен копировать null', () => {
      uiController.copyHintToClipboard(null);
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });
  });
});
