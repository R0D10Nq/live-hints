/**
 * @jest-environment jsdom
 *
 * Unit тесты для UIController
 */

// Моки для модулей UI
jest.mock('../../renderer/modules/constants.js', () => ({
  STATUS_CONFIG: {
    IDLE: { text: 'Готов', class: 'status-idle' },
    RECORDING: { text: 'Запись', class: 'status-recording' },
    PAUSED: { text: 'Пауза', class: 'status-paused' },
  },
  TIMEOUTS: { TOAST_DURATION: 3000 },
  SERVERS: { STT: 'ws://localhost:8765', LLM: 'http://localhost:8766' },
  PROFILES: { JOB_INTERVIEW_RU: 'job_interview_ru', CUSTOM: 'custom' },
  DEFAULT_PROFILE: 'job_interview_ru',
  DEFAULT_MODEL: 'phi4:latest',
  STT_MODEL: 'distil-large-v3',
  STT_DEVICE: 'cuda',
  COMPUTE_TYPE: 'float16',
  DEFAULT_TEMPERATURE: 0.3,
  DEFAULT_MAX_TOKENS: 500,
  DEFAULT_CONTEXT_WINDOW: 10,
  DEFAULT_MAX_CONTEXT_CHARS: 4000,
  SYSTEM_PROMPTS: {
    job_interview_ru: 'Ты помощник на собеседовании',
  },
}));

jest.mock('../../renderer/modules/utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  LOG_LEVELS: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 },
}));

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
  click: jest.fn(),
  setAttribute: jest.fn(),
  getAttribute: jest.fn(),
  disabled: false,
  checked: false,
  value: '',
});

// Мок document
document.getElementById = jest.fn(() => createMockElement());
document.querySelector = jest.fn(() => createMockElement());
document.querySelectorAll = jest.fn(() => []);
document.createElement = jest.fn(() => createMockElement());

// Мок requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 0));

// Мок navigator.clipboard
global.navigator.clipboard = {
  writeText: jest.fn(() => Promise.resolve()),
};

// Моки для UI подмодулей
jest.mock('../../renderer/modules/ui/ui-elements.js', () => ({
  cacheElements: jest.fn(() => ({
    // Header controls
    btnToggle: createMockElement(),
    btnMinimize: createMockElement(),
    btnClose: createMockElement(),
    btnAsk: createMockElement(),
    btnScreenshot: createMockElement(),
    btnSettings: createMockElement(),
    btnHistory: createMockElement(),
    btnHelp: createMockElement(),
    statusIndicator: createMockElement(),
    // Transcript sidebar
    transcriptSidebar: createMockElement(),
    transcriptFeed: createMockElement(),
    btnToggleSidebar: createMockElement(),
    btnExpandSidebar: createMockElement(),
    btnClearTranscript: createMockElement(),
    // Hints area
    hintsFeed: createMockElement(),
    hintsCounter: createMockElement(),
    btnPrevHint: createMockElement(),
    btnNextHint: createMockElement(),
    btnCopyHint: createMockElement(),
    btnClearHints: createMockElement(),
    streamingHint: createMockElement(),
    streamingText: createMockElement(),
    // Settings panel
    settingsPanel: createMockElement(),
    btnCloseSettings: createMockElement(),
    btnBasicMode: createMockElement(),
    btnAdvancedMode: createMockElement(),
    basicSettings: createMockElement(),
    advancedSettings: createMockElement(),
    llmProvider: createMockElement(),
    aiProfile: createMockElement(),
    // History modal
    historyModal: createMockElement(),
    sessionsList: createMockElement(),
    btnCloseHistory: createMockElement(),
    sessionViewModal: createMockElement(),
    sessionViewTitle: createMockElement(),
    btnDismissError: createMockElement(),
  })),
}));

jest.mock('../../renderer/modules/ui/ui-utils.js', () => ({
  UIUtils: jest.fn().mockImplementation(() => ({
    showToast: jest.fn(),
    hideError: jest.fn(),
    showError: jest.fn(),
    formatDate: jest.fn((date) => date.toLocaleString()),
  })),
}));

jest.mock('../../renderer/modules/ui/ui-hints.js', () => ({
  UIHints: jest.fn().mockImplementation(() => ({
    showNextHint: jest.fn(),
    showPrevHint: jest.fn(),
    copyCurrentHint: jest.fn(),
    clear: jest.fn(),
  })),
}));

jest.mock('../../renderer/modules/ui/ui-transcript.js', () => ({
  UITranscript: jest.fn().mockImplementation(() => ({
    toggle: jest.fn(),
    clear: jest.fn(),
    restoreState: jest.fn(),
  })),
}));

jest.mock('../../renderer/modules/ui/ui-modals.js', () => ({
  UIModals: jest.fn().mockImplementation(() => ({
    showHelp: jest.fn(),
    hideHelp: jest.fn(),
    hideHistory: jest.fn(),
    hideSessionView: jest.fn(),
  })),
}));

import { UIController } from '../../renderer/modules/ui-controller.js';

describe('UIController', () => {
  let uiController;
  let mockApp;

  beforeEach(() => {
    jest.clearAllMocks();
    mockApp = {
      debugMode: false,
      lastContextHash: '',
      saveSettings: jest.fn(),
    };
    uiController = new UIController(mockApp);
  });

  describe('constructor', () => {
    test('должен инициализировать с дефолтными значениями', () => {
      expect(uiController.app).toBe(mockApp);
      expect(uiController.elements).toEqual({});
      expect(uiController.compactMode).toBe(false);
      expect(uiController.focusMode).toBe(false);
      expect(uiController.hideTranscripts).toBe(false);
    });
  });

  describe('setup', () => {
    test('должен кэшировать элементы и инициализировать подмодули', () => {
      const { cacheElements } = require('../../renderer/modules/ui/ui-elements.js');
      uiController.setup();
      expect(cacheElements).toHaveBeenCalled();
      expect(uiController.utils).toBeDefined();
      expect(uiController.hintsUI).toBeDefined();
      expect(uiController.transcriptUI).toBeDefined();
      expect(uiController.modals).toBeDefined();
    });
  });

  describe('toggleSettingsPanel', () => {
    test('должен переключать класс hidden у панели настроек', () => {
      uiController.setup();
      uiController.elements.settingsPanel = createMockElement();
      uiController.toggleSettingsPanel();
      expect(uiController.elements.settingsPanel.classList.toggle).toHaveBeenCalledWith('hidden');
    });

    test('не должен вызывать ошибку если элемент не найден', () => {
      uiController.setup();
      uiController.elements.settingsPanel = null;
      expect(() => uiController.toggleSettingsPanel()).not.toThrow();
    });
  });

  describe('setSettingsMode', () => {
    test('должен устанавливать базовый режим', () => {
      uiController.setup();
      uiController.setSettingsMode('basic');
      expect(uiController.elements.btnBasicMode.classList.add).toHaveBeenCalledWith('active');
      expect(uiController.elements.btnAdvancedMode.classList.remove).toHaveBeenCalledWith('active');
    });

    test('должен устанавливать расширенный режим', () => {
      uiController.setup();
      uiController.setSettingsMode('advanced');
      expect(uiController.elements.btnBasicMode.classList.remove).toHaveBeenCalledWith('active');
      expect(uiController.elements.btnAdvancedMode.classList.add).toHaveBeenCalledWith('active');
    });
  });

  describe('toggleCompactMode', () => {
    test('должен переключать компактный режим', () => {
      uiController.setup();
      uiController.toggleCompactMode();
      expect(uiController.compactMode).toBe(true);
    });

    test('должен выключать компактный режим при повторном вызове', () => {
      uiController.setup();
      uiController.compactMode = true;
      uiController.toggleCompactMode();
      expect(uiController.compactMode).toBe(false);
    });
  });

  describe('toggleFocusMode', () => {
    test('должен переключать режим фокусировки', () => {
      uiController.setup();
      uiController.toggleFocusMode();
      expect(uiController.focusMode).toBe(true);
    });
  });

  describe('toggleTranscripts', () => {
    test('должен переключать видимость транскриптов', () => {
      uiController.setup();
      uiController.toggleTranscripts();
      expect(uiController.hideTranscripts).toBe(true);
    });
  });
});
