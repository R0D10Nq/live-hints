/**
 * @jest-environment jsdom
 */

import { EventEmitter } from 'events';
import { AppModels } from '../../renderer/modules/app/app-models.js';
import { HintManager } from '../../renderer/modules/hint-manager.js';
import { UIController } from '../../renderer/modules/ui-controller.js';
import { UIHints } from '../../renderer/modules/ui/ui-hints.js';
import { UIModals } from '../../renderer/modules/ui/ui-modals.js';
import { UITranscript } from '../../renderer/modules/ui/ui-transcript.js';
import { UIUtils } from '../../renderer/modules/ui/ui-utils.js';
import {
  HintComponent,
  ToastComponent,
  TranscriptComponent,
} from '../../renderer/modules/ui-new/components.js';
import { StateManager } from '../../renderer/modules/ui-new/state-manager.js';

const mockIpcRegistry = new Map();
const mockBrowserWindows = [];
let mockBuiltMenuTemplate = null;

jest.mock('../../renderer/modules/ui-new/animation-engine.js', () => ({
  animations: {
    addHoverEffect: jest.fn(),
    entrance: jest.fn(() => Promise.resolve()),
    fadeOut: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock(
  'electron',
  () => ({
    app: {
      isPackaged: false,
      getPath: jest.fn(() => 'C:\\temp\\live-hints-test-userdata'),
      quit: jest.fn(),
      relaunch: jest.fn(),
      exit: jest.fn(),
    },
    ipcMain: {
      handle: jest.fn((channel, fn) => {
        mockIpcRegistry.set(channel, fn);
      }),
    },
    screen: {
      getAllDisplays: jest.fn(() => [
        { id: 1, label: 'Main', bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
        { id: 2, label: '', bounds: { x: 1920, y: 0, width: 1920, height: 1080 } },
      ]),
      getPrimaryDisplay: jest.fn(() => ({
        id: 1,
        workAreaSize: { width: 1920, height: 1040 },
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      })),
    },
    desktopCapturer: {
      getSources: jest.fn(async () => [
        {
          name: 'Screen 1 - Sharing',
          thumbnail: { toDataURL: () => 'data:image/png;base64,aGVsbG8=' },
        },
      ]),
    },
    BrowserWindow: jest.fn().mockImplementation((opts) => {
      const listeners = {};
      const win = {
        opts,
        loadFile: jest.fn(),
        setAlwaysOnTop: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        focus: jest.fn(),
        moveTop: jest.fn(),
        minimize: jest.fn(),
        close: jest.fn(),
        setIgnoreMouseEvents: jest.fn(),
        setOpacity: jest.fn(),
        getPosition: jest.fn(() => [100, 200]),
        setPosition: jest.fn(),
        isVisible: jest.fn(() => true),
        setContentProtection: jest.fn(),
        webContents: { send: jest.fn() },
        on: jest.fn((evt, cb) => {
          listeners[evt] = cb;
        }),
        emitEvent: (evt) => listeners[evt] && listeners[evt](),
      };
      mockBrowserWindows.push(win);
      return win;
    }),
    Menu: {
      buildFromTemplate: jest.fn((tpl) => {
        mockBuiltMenuTemplate = tpl;
        return tpl;
      }),
      setApplicationMenu: jest.fn(),
    },
  }),
  { virtual: true }
);

jest.mock('pdf-parse', () => jest.fn(async () => ({ text: 'PDF текст' })), { virtual: true });
jest.mock('mammoth', () => ({ extractRawText: jest.fn(async () => ({ value: 'DOCX текст' })) }), {
  virtual: true,
});

describe('Покрытие модулей Main и Renderer (>= 85%)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIpcRegistry.clear();
    document.body.innerHTML = '';
  });

  test('StateManager полностью покрывает управление состоянием, подписки, подсказки и транскрипты', () => {
    const sm = new StateManager();
    const events = [];
    const unsub = sm.subscribe('session.isActive', (val, oldVal) => {
      events.push({ val, oldVal });
    });
    const parentEvents = [];
    sm.subscribe('session', (val) => parentEvents.push(val));

    sm.startSession();
    expect(sm.get('session.isActive')).toBe(true);
    expect(sm.get('ui.status')).toBe('recording');
    expect(events.length).toBe(1);
    expect(parentEvents.length).toBeGreaterThan(0);

    sm.pauseSession();
    expect(sm.get('session.isPaused')).toBe(true);
    expect(sm.get('ui.status')).toBe('paused');

    sm.resumeSession();
    expect(sm.get('session.isPaused')).toBe(false);

    sm.stopSession();
    expect(sm.get('session.isActive')).toBe(false);
    expect(sm.get('ui.status')).toBe('idle');

    unsub();
    sm.set('deep.nested.key', 42);
    expect(sm.get('deep.nested.key')).toBe(42);
    expect(sm.get('nonexistent.path.key')).toBeUndefined();

    expect(sm.getCurrentHint()).toBeNull();
    sm.addHint({ text: 'Первая подсказка' });
    sm.addHint({ text: 'Вторая подсказка' });
    expect(sm.get('session.hintCount')).toBe(2);
    expect(sm.getCurrentHint().text).toBe('Вторая подсказка');

    sm.prevHint();
    expect(sm.get('ui.currentHintIndex')).toBe(0);
    sm.nextHint();
    expect(sm.get('ui.currentHintIndex')).toBe(1);
    sm.setCurrentHint(0);
    expect(sm.get('ui.currentHintIndex')).toBe(0);
    sm.clearHints();
    expect(sm.get('session.hintCount')).toBe(0);

    sm.addTranscript('Тестовая фраза');
    expect(sm.get('session.transcriptCount')).toBe(1);
    sm.clearTranscripts();
    expect(sm.get('session.transcriptCount')).toBe(0);

    expect(sm.toggleSidebar()).toBe(false);
    sm.openSettings();
    expect(sm.get('ui.settingsOpen')).toBe(true);
    sm.closeSettings();
    expect(sm.get('ui.settingsOpen')).toBe(false);
    sm.setStatus('processing');
    expect(sm.get('ui.status')).toBe('processing');

    window.electron = {
      settingsSet: jest.fn(() => Promise.reject(new Error('save error'))),
    };
    sm.updateSetting('model', 'qwen2.5:7b');
    sm.applySetting('opacity', 85);
    expect(sm.get('settings.opacity')).toBe(85);

    sm.reset();
    expect(sm.get('ui.status')).toBe('idle');
  });

  test('WindowManager и StealthManager покрывают создание окон, хоткеи и защиту экрана', async () => {
    const windowManager = require('../../main/window-manager');
    const stealthManager = require('../../main/stealth-manager');
    const childProcess = require('child_process');

    const mainWin = windowManager.createWindow();
    expect(windowManager.getMainWindow()).toBe(mainWin);
    mainWin.emitEvent('closed');
    expect(windowManager.getMainWindow()).toBeNull();

    const onbWin = windowManager.createOnboardingWindow();
    expect(windowManager.getOnboardingWindow()).toBe(onbWin);
    onbWin.emitEvent('closed');
    expect(windowManager.getOnboardingWindow()).toBeNull();

    const cbs = {
      onAskHint: jest.fn(),
      onScreenshot: jest.fn(),
      onToggleTranscript: jest.fn(),
      onToggleStealth: jest.fn(),
      onPrevHint: jest.fn(),
      onNextHint: jest.fn(),
      onToggleMute: jest.fn(),
      onSettings: jest.fn(),
      onHelp: jest.fn(),
      onQuit: jest.fn(),
    };
    windowManager.setupLocalShortcuts(cbs);
    for (const item of mockBuiltMenuTemplate[0].submenu) {
      if (item.click) item.click();
    }
    expect(cbs.onAskHint).toHaveBeenCalled();
    expect(cbs.onQuit).toHaveBeenCalled();

    const win2 = windowManager.createWindow();
    stealthManager.setMainWindow(win2);
    stealthManager.activateStealth();
    expect(stealthManager.isStealthMode()).toBe(true);
    stealthManager.deactivateStealth();
    expect(stealthManager.isStealthMode()).toBe(false);

    expect(stealthManager.moveToSecondaryMonitor()).toBe(true);
    expect(stealthManager.setStealthMode('hide')).toBe('hide');
    expect(stealthManager.setStealthMode('tray')).toBe('tray');
    expect(stealthManager.setStealthMode('second-monitor')).toBe('second-monitor');
    expect(stealthManager.setStealthMode('disabled')).toBe('disabled');

    stealthManager.setStealthStrategy('custom');
    expect(stealthManager.getStealthStrategy()).toBe('custom');

    const execSpy = jest
      .spyOn(childProcess, 'exec')
      .mockImplementation((cmd, cb) => cb(null, 'Zoom.exe'));
    const sharing = await stealthManager.checkScreenSharing();
    expect(sharing).toBe(true);
    execSpy.mockRestore();

    stealthManager.startScreenSharingMonitor();
    stealthManager.stopScreenSharingMonitor();
  });

  test('setupIPC и validateSetting обрабатывают все каналы IPC', async () => {
    const { setupIPC, validateSetting } = require('../../main/ipc-handlers');
    const windowManager = require('../../main/window-manager');
    const stealthManager = require('../../main/stealth-manager');

    expect(() => validateSetting('unknown', 1)).toThrow();
    expect(() => validateSetting('opacity', 'bad')).toThrow(TypeError);
    expect(() => validateSetting('opacity', 10)).toThrow(RangeError);
    expect(() => validateSetting('opacity', 80)).not.toThrow();

    const win = windowManager.createWindow();
    const onb = windowManager.createOnboardingWindow();
    stealthManager.setMainWindow(win);

    const fakeAudioProc = new EventEmitter();
    const fakeMicProc = new EventEmitter();

    const pm = {
      startLLMProcess: jest.fn(async () => {}),
      startSTTProcess: jest.fn(async () => {}),
      stopAllProcesses: jest.fn(),
      stopSTTProcess: jest.fn(),
      startAudioCaptureProcess: jest.fn(() => ({
        audioCaptureProcess: fakeAudioProc,
        micCaptureProcess: fakeMicProc,
      })),
      stopAudioCaptureProcesses: jest.fn(),
    };
    const store = {
      store: { model: 'qwen3:8b' },
      get: jest.fn((k) => (k === 'model' ? 'qwen3:8b' : null)),
      set: jest.fn(),
      clear: jest.fn(),
    };

    setupIPC({
      windowManager,
      stealthManager,
      processManager: pm,
      store,
      onStealthToggle: jest.fn(),
      onFinishOnboarding: jest.fn(),
    });

    await mockIpcRegistry.get('window:minimize')();
    await mockIpcRegistry.get('window:set-ignore-mouse')({}, true);
    await mockIpcRegistry.get('window:set-opacity')({}, 80);
    await mockIpcRegistry.get('window:set-always-on-top')({}, true);
    for (const dir of ['up', 'down', 'left', 'right']) {
      await mockIpcRegistry.get('window:move')({}, dir);
    }
    await mockIpcRegistry.get('window:toggle-visibility')();
    win.isVisible.mockReturnValueOnce(false);
    await mockIpcRegistry.get('window:toggle-visibility')();
    expect(await mockIpcRegistry.get('window:get-position')()).toEqual([100, 200]);
    expect((await mockIpcRegistry.get('window:get-displays')()).length).toBe(2);
    await mockIpcRegistry.get('window:move-to-display')({}, 2);

    expect(await mockIpcRegistry.get('runtime:start')({}, { dualAudio: true })).toEqual({
      success: true,
    });
    expect(await mockIpcRegistry.get('runtime:stop')()).toEqual({ success: true });
    expect(await mockIpcRegistry.get('llm:start')()).toEqual({ success: true });
    expect(await mockIpcRegistry.get('stt:start')({}, { dualAudio: true })).toEqual({
      success: true,
    });
    expect(await mockIpcRegistry.get('stt:stop')()).toEqual({ success: true });
    expect(await mockIpcRegistry.get('stt:switch-mode')({}, 'microphone')).toEqual({
      success: true,
      mode: 'microphone',
    });

    const capRes = await mockIpcRegistry.get('audio:start-capture')({}, { dualAudio: true });
    expect(capRes.success).toBe(true);
    fakeAudioProc.emit('exit', 1);
    fakeMicProc.emit('exit', 2);
    expect(win.webContents.send).toHaveBeenCalledWith('audio:error', {
      source: 'system',
      code: 1,
    });
    await mockIpcRegistry.get('audio:stop-capture')();

    await mockIpcRegistry.get('stealth:toggle')();
    await mockIpcRegistry.get('stealth:status')();
    await mockIpcRegistry.get('stealth:set-mode')({}, 'tray');
    await mockIpcRegistry.get('stealth:set-strategy')({}, 'content-protection');
    await mockIpcRegistry.get('stealth:get-strategy')();
    await mockIpcRegistry.get('stealth:show-toast')({}, 'Тост');
    expect(await mockIpcRegistry.get('stealth:has-second-monitor')()).toBe(true);
    await mockIpcRegistry.get('stealth:start-monitoring')();
    await mockIpcRegistry.get('stealth:stop-monitoring')();
    await mockIpcRegistry.get('window:move-to-secondary')();

    expect(await mockIpcRegistry.get('vision:capture-screen')()).toBe('aGVsbG8=');
    const onbRes = await mockIpcRegistry.get('onboarding:finish')({}, { profile: 'interview' });
    expect(onbRes.success).toBe(true);

    expect(await mockIpcRegistry.get('file:parse-buffer')({}, Buffer.from('привет'), 'txt')).toBe(
      'привет'
    );
    expect(await mockIpcRegistry.get('file:parse-buffer')({}, Buffer.from('pdf'), 'pdf')).toBe(
      'PDF текст'
    );
    expect(await mockIpcRegistry.get('file:parse-buffer')({}, Buffer.from('docx'), 'docx')).toBe(
      'DOCX текст'
    );
    await expect(
      mockIpcRegistry.get('file:parse-buffer')({}, Buffer.from('x'), 'exe')
    ).rejects.toThrow();

    expect(await mockIpcRegistry.get('settings:get')({}, 'model')).toBe('qwen3:8b');
    expect(await mockIpcRegistry.get('settings:set')({}, 'opacity', 90)).toBe(true);
    expect(await mockIpcRegistry.get('settings:getAll')()).toEqual({ model: 'qwen3:8b' });
    await mockIpcRegistry.get('settings:reset')();

    expect(await mockIpcRegistry.get('file:save-context')({}, 'resume', 'Моё резюме')).toEqual({
      success: true,
    });
    await expect(mockIpcRegistry.get('file:save-context')({}, 'resume', 123)).rejects.toThrow(
      TypeError
    );
    await expect(
      mockIpcRegistry.get('file:save-context')({}, 'invalid_type', 'abc')
    ).rejects.toThrow();

    windowManager.setOnboardingWindow(onb);
    await mockIpcRegistry.get('window:close')();
  });

  test('ProcessManager проверяет запуск процессов, порты и аудио-захват', async () => {
    const net = require('net');
    const childProcess = require('child_process');
    const pm = require('../../main/process-manager');

    expect(typeof pm.getRuntimeRoot()).toBe('string');
    expect(pm.getRuntimeEnv().PYTHONUTF8).toBe('1');

    const proc = { pid: 99999, exitCode: null, killed: false, kill: jest.fn() };
    expect(pm.isRunning(proc)).toBe(true);
    pm.stopProcess(proc);

    // Мокаем net.createConnection для assertPortAvailable (ECONNREFUSED) и waitForPort (connect)
    let connectMode = 'refused';
    const netSpy = jest.spyOn(net, 'createConnection').mockImplementation(() => {
      const sock = new EventEmitter();
      sock.setTimeout = jest.fn();
      sock.destroy = jest.fn();
      setTimeout(() => {
        if (connectMode === 'refused') {
          const err = new Error('refused');
          err.code = 'ECONNREFUSED';
          sock.emit('error', err);
        } else if (connectMode === 'connect') {
          sock.emit('connect');
        }
      }, 5);
      return sock;
    });

    await expect(pm.assertPortAvailable(19999)).resolves.toBeUndefined();
    connectMode = 'connect';
    await expect(pm.assertPortAvailable(19999)).rejects.toThrow('уже занят');
    await expect(pm.waitForPort(19999, '127.0.0.1', 500)).resolves.toBeUndefined();

    // Мокаем spawn и проверяем startSTTProcess, startLLMProcess и startAudioCaptureProcess
    let callIdx = 0;
    netSpy.mockImplementation(() => {
      const sock = new EventEmitter();
      sock.setTimeout = jest.fn();
      sock.destroy = jest.fn();
      setTimeout(() => {
        if (callIdx++ % 2 === 0) {
          const err = new Error('refused');
          err.code = 'ECONNREFUSED';
          sock.emit('error', err);
        } else {
          sock.emit('connect');
        }
      }, 5);
      return sock;
    });

    const spawnSpy = jest.spyOn(childProcess, 'spawn').mockImplementation(() => {
      const p = new EventEmitter();
      p.pid = 4321;
      p.exitCode = null;
      p.killed = false;
      p.kill = jest.fn();
      p.stdout = new EventEmitter();
      p.stderr = new EventEmitter();
      return p;
    });

    pm.stopAllProcesses();
    const sttP = await pm.startSTTProcess('auto', 8765);
    sttP.stdout.emit('data', 'ready');
    sttP.stderr.emit('data', 'warn');
    expect(pm.getSttProcess()).toBe(sttP);

    const llmP = await pm.startLLMProcess(8766);
    llmP.stdout.emit('data', 'llm ready');
    llmP.stderr.emit('data', 'llm warn');
    expect(pm.getLLMProcess()).toBe(llmP);

    // Реальный режим захвата аудио с dualAudio
    process.env.LIVE_HINTS_REAL_AUDIO = '1';
    const capReal = pm.startAudioCaptureProcess({ dualAudio: true, micDeviceIndex: 1 });
    expect(capReal.audioCaptureProcess).toBeTruthy();
    expect(capReal.micCaptureProcess).toBeTruthy();
    delete process.env.LIVE_HINTS_REAL_AUDIO;

    pm.stopAllProcesses();
    spawnSpy.mockRestore();
    netSpy.mockRestore();
  });

  test('UIUtils, UITranscript, UIModals и UIHints полностью покрывают рендеринг и действия', async () => {
    document.body.innerHTML = `
      <div id="error-toast" class="hidden"><span id="error-message"></span></div>
      <div id="transcript-sidebar" class="expanded"></div>
      <button id="btn-toggle-sidebar"></button>
      <button id="btn-expand-sidebar" class="hidden"></button>
      <div id="transcript-feed"><p class="placeholder">Ожидание</p></div>
      <div id="hints-feed"><p class="placeholder">Подсказки</p></div>
      <div id="hints-empty-state"></div>
      <div id="hints-loading-state" class="hidden"></div>
      <span id="hints-counter"></span>
      <button id="btn-prev-hint"></button>
      <button id="btn-next-hint"></button>
      <div id="help-modal" class="hidden"></div>
      <div id="history-modal" class="hidden"></div>
      <div id="sessions-list"></div>
      <div id="session-view-modal" class="hidden">
        <div id="session-view-title"></div>
        <div id="session-transcript"></div>
        <div id="session-hints"></div>
      </div>
    `;

    const elements = {
      errorToast: document.getElementById('error-toast'),
      errorMessage: document.getElementById('error-message'),
      transcriptSidebar: document.getElementById('transcript-sidebar'),
      btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
      btnExpandSidebar: document.getElementById('btn-expand-sidebar'),
      transcriptFeed: document.getElementById('transcript-feed'),
      hintsFeed: document.getElementById('hints-feed'),
      hintsCounter: document.getElementById('hints-counter'),
      btnPrevHint: document.getElementById('btn-prev-hint'),
      btnNextHint: document.getElementById('btn-next-hint'),
      helpModal: document.getElementById('help-modal'),
      historyModal: document.getElementById('history-modal'),
      sessionsList: document.getElementById('sessions-list'),
      sessionViewModal: document.getElementById('session-view-modal'),
      sessionViewTitle: document.getElementById('session-view-title'),
      sessionTranscript: document.getElementById('session-transcript'),
      sessionHints: document.getElementById('session-hints'),
    };

    const utils = new UIUtils(elements);
    utils.showToast('Готово', 'success');
    utils.showError('Ошибка');
    utils.hideError();
    expect(utils.formatTime(Date.now())).toBeTruthy();
    expect(utils.formatLatency(null)).toBe('');
    expect(utils.formatLatency(1200)).toBe('1.2s');
    const md = utils.renderMarkdown('**Жирный** *курсив* `код`\n- пункт 1\n1. шаг');
    expect(md).toContain('<strong>Жирный</strong>');

    const app = {
      audio: { dualAudioEnabled: true },
      transcriptContext: [],
      lastContextHash: '',
      sessions: {
        getAll: jest.fn(() => [
          {
            id: 's1',
            name: 'Тестовая сессия',
            date: Date.now(),
            transcript: 'Вопрос 1\nВопрос 2',
            hints: 'Ответ 1',
            tags: ['Python'],
          },
        ]),
        getById: jest.fn(() => ({
          id: 's1',
          name: 'Тестовая сессия',
          date: Date.now(),
          transcript: 'Вопрос 1',
          hints: 'Ответ 1',
        })),
        calculateDuration: jest.fn(() => '5 мин'),
        formatDateFull: jest.fn(() => '28.10.2026'),
        formatDate: jest.fn(() => '28.10'),
        exportSession: jest.fn(),
        delete: jest.fn(() => true),
      },
    };

    const tr = new UITranscript(elements, utils, app);
    tr.toggle(); // expanded -> compact
    tr.toggle(); // compact -> collapsed
    tr.toggle(); // collapsed -> expanded
    localStorage.setItem('transcriptState', 'compact');
    tr.restoreState();
    tr.addItem('Первый вопрос', Date.now(), 'interviewer');
    tr.addItem('Первый вопрос', Date.now(), 'interviewer'); // дубликат
    tr.addItem('Мой ответ', Date.now(), 'candidate');
    expect(tr.getText()).toContain('Интервьюер: Первый вопрос');
    tr.clear();

    const modals = new UIModals(elements, utils, app);
    modals.showHelp();
    modals.hideHelp();
    modals.showHistory();
    elements.sessionsList.querySelector('.btn-session-view').click();
    elements.sessionsList.querySelector('.btn-session-export').click();
    elements.sessionsList.querySelector('.btn-session-delete').click();
    modals.hideSessionView();
    modals.hideHistory();

    Object.assign(navigator, {
      clipboard: { writeText: jest.fn(async () => {}) },
    });

    const hints = new UIHints(elements, utils);
    hints.showLoading();
    hints.hideLoading();
    const streamEl = hints.createStreamingElement();
    hints.updateStreamingHint(streamEl, 'Потоковый **ответ**');
    hints.finalizeStreamingHint(streamEl, 'Потоковый **ответ**', {
      latencyMs: 250,
      cached: false,
      questionType: 'technical',
    });
    const streamEl2 = hints.createStreamingElement();
    hints.finalizeStreamingHint(streamEl2, 'Второй ответ', {
      latencyMs: 100,
      cached: true,
      questionType: 'experience',
    });
    hints.showPrevHint();
    hints.showNextHint();
    hints.goToLastHint();
    hints.copyCurrentHint();
    hints.addHintItem('Лента 1', Date.now(), 300);
    hints.addHintItem('Лента 1', Date.now(), 300);
    expect(hints.getHintsText()).toContain('Потоковый');
    hints.clear();
  });

  test('UIController покрывает все делегирующие методы, кнопки статуса и метрики', async () => {
    document.body.innerHTML = `
      <div class="main-content"></div>
      <div id="status-indicator"></div>
      <button id="btn-toggle"><span class="btn-icon"></span><span class="btn-label"></span></button>
      <button id="btn-pause"><span class="btn-icon"></span><span class="btn-label"></span></button>
      <button id="btn-ask"></button>
      <button id="btn-toggle-transcripts"></button>
      <div id="metrics-panel" class="hidden">
        <span id="metrics-stt-latency"></span>
        <span id="metrics-llm-latency"></span>
      </div>
    `;

    const app = { saveSettings: jest.fn() };
    const ui = new UIController(app);
    ui.setup();

    ui.updateStatus('listening');
    ui.updateStatus('unknown');
    ui.updateToggleButton(true);
    ui.updateToggleButton(false);
    ui.updatePauseButton(true);
    ui.updatePauseButton(false);

    ui.utils = {
      showToast: jest.fn(),
      showError: jest.fn(),
      hideError: jest.fn(),
      formatTime: jest.fn(() => '12:00'),
      formatLatency: jest.fn(() => '0.5s'),
      escapeHtml: jest.fn((t) => t),
      renderMarkdown: jest.fn((t) => t),
    };
    ui.transcriptUI = {
      addItem: jest.fn(),
      toggle: jest.fn(),
      restoreState: jest.fn(),
      clear: jest.fn(),
      getText: jest.fn(() => 'tr'),
      lastTranscriptText: 'last tr',
    };
    ui.hintsUI = {
      addHintItem: jest.fn(),
      showLoading: jest.fn(),
      hideLoading: jest.fn(),
      showEmptyState: jest.fn(),
      hideEmptyState: jest.fn(),
      createStreamingElement: jest.fn(() => ({})),
      updateStreamingHint: jest.fn(),
      finalizeStreamingHint: jest.fn(),
      showPrevHint: jest.fn(),
      showNextHint: jest.fn(),
      goToLastHint: jest.fn(),
      updatePaginationButtons: jest.fn(),
      clear: jest.fn(),
      getHintsText: jest.fn(() => 'hints'),
      hints: ['h1'],
      currentHintIndex: 0,
      lastHintText: 'Последняя подсказка',
    };
    ui.modals = {
      showHistory: jest.fn(),
      hideHistory: jest.fn(),
      showSessionView: jest.fn(),
      hideSessionView: jest.fn(),
      showHelp: jest.fn(),
      hideHelp: jest.fn(),
      renderSessionsList: jest.fn(),
    };

    ui.showToast('ok', 'info');
    ui.showError('err');
    ui.hideError();
    ui.addTranscriptItem('t', 'now', 'interviewer');
    ui.addHintItem('h', 'now', 100);
    ui.showHintLoading();
    ui.hideHintLoading();
    ui.showHintsEmptyState();
    ui.hideHintsEmptyState();
    ui.createStreamingHintElement();
    ui.updateStreamingHint({}, 'x');
    ui.finalizeStreamingHint({}, 'x', {});
    ui.showPrevHint();
    ui.showNextHint();
    ui.goToLastHint();
    ui.updatePaginationButtons();
    ui.showHistoryModal();
    ui.hideHistoryModal();
    ui.showSessionView('1');
    ui.hideSessionView();
    ui.showHelpModal();
    ui.hideHelpModal();
    ui.renderSessionsList();
    ui.toggleTranscriptSidebar();
    ui.toggleTranscriptsVisibility();
    ui.restoreTranscriptState();
    ui.clearFeeds();
    ui.clearHints();
    ui.clearTranscript();
    expect(ui.getTranscriptText()).toBe('tr');
    expect(ui.getHintsText()).toBe('hints');

    ui.hints = ['h2'];
    expect(ui.hints).toEqual(['h2']);
    ui.currentHintIndex = 1;
    expect(ui.currentHintIndex).toBe(1);
    expect(ui.lastTranscriptText).toBe('last tr');
    expect(ui.lastHintText).toBe('Последняя подсказка');

    Object.assign(navigator, {
      clipboard: { writeText: jest.fn(async () => {}) },
    });
    await ui.copyLastHint();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Последняя подсказка');

    ui.hintsUI.lastHintText = '';
    await ui.copyLastHint();

    ui.toggleMetricsPanel(true);
    ui.toggleMetricsPanel(false);
    ui.updateMetricsPanel({ stt_latency_ms: 45, llm_server_latency_ms: 210 });
    expect(ui.formatTime('now')).toBe('12:00');
    expect(ui.formatLatency(500)).toBe('0.5s');
    expect(ui.escapeHtml('a')).toBe('a');
    expect(ui.renderMarkdown('b')).toBe('b');
  });

  test('HintManager обрабатывает потоковые SSE ответы, ошибки, прямой ввод и извлечение вопросов', async () => {
    document.body.innerHTML = `
      <input id="direct-message-input" value="Уточни про GIL" />
      <button id="btn-send-direct"></button>
    `;

    const ui = {
      showHintLoading: jest.fn(),
      hideHintLoading: jest.fn(),
      showError: jest.fn(),
      showToast: jest.fn(),
      createStreamingHintElement: jest.fn(() => document.createElement('div')),
      updateStreamingHint: jest.fn(),
      finalizeStreamingHint: jest.fn(),
      updateMetricsPanel: jest.fn(),
    };
    const app = {
      isRunning: true,
      isPaused: false,
      debugMode: true,
      ui,
      transcriptContext: [
        'Интервьюер: Что такое декоратор?',
        { source: 'interviewer', text: 'Как работает GIL в Python?' },
      ],
    };

    const hm = new HintManager(app);
    hm.setParams({
      contextWindowSize: 5,
      maxContextChars: 2000,
      maxTokens: 300,
      temperature: 0.4,
    });
    hm.setUserContext('Python Senior Developer');

    const encoder = new TextEncoder();
    const ssePayloads = [
      'data: {"chunk": "GIL — это "}\n\n',
      'data: {"chunk": "мьютекс интерпретатора"}\n\n',
      'data: {"done": true, "latency_ms": 150, "cached": false, "question_type": "technical"}\n\n',
    ];
    let idx = 0;
    global.fetch = jest.fn(async () => ({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            if (idx < ssePayloads.length) {
              return { done: false, value: encoder.encode(ssePayloads[idx++]) };
            }
            return { done: true, value: undefined };
          },
        }),
      },
    }));

    await hm.manualRequestHint();
    expect(ui.finalizeStreamingHint).toHaveBeenCalled();

    hm.transcriptContext = ['Интервьюер: Расскажи про asyncio'];
    expect(hm.getLastInterviewerQuestion()).toBe('Расскажи про asyncio');
    expect(hm.getLastTranscriptText()).toBe('Интервьюер: Расскажи про asyncio');

    hm.setupDirectMessage();
    document.getElementById('btn-send-direct').click();
    await new Promise((r) => setTimeout(r, 20));

    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'Server Error',
    }));
    hm.lastHintRequestText = '';
    hm.lastHintRequestAt = 0;
    await hm.requestHint('Новый вопрос после ошибки 12345');
    expect(ui.showError).toHaveBeenCalledWith('LLM ошибка 500');
  });

  test('AppModels и компоненты нового UI покрывают все сценарии', async () => {
    document.body.innerHTML = `
      <select id="ollama-model"></select>
      <div id="ollama-model-help"></div>
      <button id="btn-refresh-models"></button>
      <button class="profile-btn" data-profile="job_interview_ru"></button>
      <div id="hints-container"></div>
      <div id="hints-counter"></div>
      <button id="btn-prev-hint"></button>
      <button id="btn-next-hint"></button>
      <div id="transcript-container"></div>
      <div id="toast-container"></div>
    `;

    const app = {
      hints: { currentModel: '' },
      ui: { showToast: jest.fn() },
    };
    const models = new AppModels(app);

    global.fetch = jest.fn(async (url) => {
      if (String(url).endsWith('/models')) {
        return { ok: true, json: async () => ({ models: [], current: 'custom:model' }) };
      }
      return { ok: true, json: async () => ({ status: 'ok' }) };
    });

    models.setup();
    await models.loadModels({ ensureServer: true, silent: false });
    await models.setProfile('job_interview_ru');

    const evt = new KeyboardEvent('keydown', { key: '1', ctrlKey: true });
    document.dispatchEvent(evt);

    global.fetch = jest.fn(async () => {
      throw new Error('offline');
    });
    await models.loadModels({ silent: false });
    await models.setModel('qwen2.5:7b');
    await models.setProfile('job_interview_ru');

    const hintComp = new HintComponent(document.getElementById('hints-container'));
    hintComp.displayHint({ text: 'Подсказка', timestamp: Date.now() }, 0, 2);
    hintComp.showEmptyState();
    hintComp.showLoadingState();
    hintComp.updateCounter(0, 2);
    hintComp.updateNavigation(0, 2);

    const trComp = new TranscriptComponent(document.getElementById('transcript-container'));
    trComp.addEntry('Привет');
    expect(trComp.escapeHtml('<b>&</b>')).toBe('&lt;b&gt;&amp;&lt;/b&gt;');
    trComp.clear();

    const toastComp = new ToastComponent(document.getElementById('toast-container'));
    const t1 = toastComp.success('Успех', 50);
    toastComp.error('Ошибка', 50);
    toastComp.warning('Внимание', 50);
    toastComp.info('Инфо', 50);
    await toastComp.remove(t1);
  });
});
