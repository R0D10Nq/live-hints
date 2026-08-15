const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Управление окном
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  setIgnoreMouse: (ignore) => ipcRenderer.invoke('window:set-ignore-mouse', ignore),

  // STT управление
  startSTT: () => ipcRenderer.invoke('stt:start'),
  stopSTT: () => ipcRenderer.invoke('stt:stop'),
  switchSTTMode: (mode) => ipcRenderer.invoke('stt:switch-mode', mode),

  // Аудио захват с поддержкой dual audio
  startAudioCapture: (options) => ipcRenderer.invoke('audio:start-capture', options),
  stopAudioCapture: () => ipcRenderer.invoke('audio:stop-capture'),

  // События от main process
  onPCMData: (callback) => {
    const handler = (event, data, source) => callback(data, source);
    ipcRenderer.on('audio:pcm-data', handler);
    return () => ipcRenderer.removeListener('audio:pcm-data', handler);
  },

  onTranscript: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('stt:transcript', handler);
    return () => ipcRenderer.removeListener('stt:transcript', handler);
  },

  onHint: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('llm:hint', handler);
    return () => ipcRenderer.removeListener('llm:hint', handler);
  },

  onStatusChange: (callback) => {
    const handler = (event, status) => callback(status);
    ipcRenderer.on('status:change', handler);
    return () => ipcRenderer.removeListener('status:change', handler);
  },

  onError: (callback) => {
    const handler = (event, error) => callback(error);
    ipcRenderer.on('error', handler);
    return () => ipcRenderer.removeListener('error', handler);
  },

  // Удаление слушателей
  removeAllListeners: (channel) => {
    const allowed = [
      'audio:pcm-data',
      'stt:transcript',
      'llm:hint',
      'status:change',
      'error',
      'stealth:activated',
      'stealth:deactivated',
      'stealth:auto-activated',
      'shortcut:ask',
      'shortcut:screenshot',
      'shortcut:toggle-transcript',
      'shortcut:prev-hint',
      'shortcut:next-hint',
      'shortcut:settings',
      'shortcut:toggle-mute',
      'shortcut:help',
      'shortcut:toggle-session',
    ];
    if (allowed.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },

  // Прозрачность окна
  setOpacity: (opacity) => ipcRenderer.invoke('window:set-opacity', opacity),

  // Перемещение окна
  moveWindow: (direction) => ipcRenderer.invoke('window:move', direction),

  // Показать/скрыть окно
  toggleVisibility: () => ipcRenderer.invoke('window:toggle-visibility'),

  // Получить позицию окна
  getWindowPosition: () => ipcRenderer.invoke('window:get-position'),

  // ===== STEALTH MODE =====
  stealthToggle: () => ipcRenderer.invoke('stealth:toggle'),
  stealthStatus: () => ipcRenderer.invoke('stealth:status'),
  stealthSetMode: (mode) => ipcRenderer.invoke('stealth:set-mode', mode),
  stealthSetStrategy: (strategy) => ipcRenderer.invoke('stealth:set-strategy', strategy),
  stealthGetStrategy: () => ipcRenderer.invoke('stealth:get-strategy'),
  stealthShowToast: (text) => ipcRenderer.invoke('stealth:show-toast', text),
  stealthHasSecondMonitor: () => ipcRenderer.invoke('stealth:has-second-monitor'),
  stealthStartMonitoring: () => ipcRenderer.invoke('stealth:start-monitoring'),
  stealthStopMonitoring: () => ipcRenderer.invoke('stealth:stop-monitoring'),

  // Stealth события
  onStealthActivated: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('stealth:activated', handler);
    return () => ipcRenderer.removeListener('stealth:activated', handler);
  },
  onStealthDeactivated: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('stealth:deactivated', handler);
    return () => ipcRenderer.removeListener('stealth:deactivated', handler);
  },
  onStealthAutoActivated: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('stealth:auto-activated', handler);
    return () => ipcRenderer.removeListener('stealth:auto-activated', handler);
  },

  // ===== MULTI-MONITOR =====
  getDisplays: () => ipcRenderer.invoke('window:get-displays'),
  moveToSecondary: () => ipcRenderer.invoke('window:move-to-secondary'),
  moveToDisplay: (displayId) => ipcRenderer.invoke('window:move-to-display', displayId),

  // ===== VISION AI =====
  captureScreen: () => ipcRenderer.invoke('vision:capture-screen'),

  // ===== SETTINGS =====
  settingsGet: (key) => ipcRenderer.invoke('settings:get', key),
  settingsSet: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  settingsGetAll: () => ipcRenderer.invoke('settings:getAll'),
  settingsReset: () => ipcRenderer.invoke('settings:reset'),

  // ===== ONBOARDING / FILES =====
  parseFile: (filePath, type) => ipcRenderer.invoke('file:parse', filePath, type),
  saveContextFile: (type, content) => ipcRenderer.invoke('file:save-context', type, content),
  finishOnboarding: (settings) => ipcRenderer.invoke('onboarding:finish', settings),

  // ===== SHORTCUTS =====
  onShortcutAsk: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('shortcut:ask', handler);
    return () => ipcRenderer.removeListener('shortcut:ask', handler);
  },
  onShortcutScreenshot: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('shortcut:screenshot', handler);
    return () => ipcRenderer.removeListener('shortcut:screenshot', handler);
  },
  onShortcutToggleTranscript: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('shortcut:toggle-transcript', handler);
    return () => ipcRenderer.removeListener('shortcut:toggle-transcript', handler);
  },
  onShortcutPrevHint: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('shortcut:prev-hint', handler);
    return () => ipcRenderer.removeListener('shortcut:prev-hint', handler);
  },
  onShortcutNextHint: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('shortcut:next-hint', handler);
    return () => ipcRenderer.removeListener('shortcut:next-hint', handler);
  },
  onShortcutSettings: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('shortcut:settings', handler);
    return () => ipcRenderer.removeListener('shortcut:settings', handler);
  },
  onShortcutToggleMute: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('shortcut:toggle-mute', handler);
    return () => ipcRenderer.removeListener('shortcut:toggle-mute', handler);
  },
  onShortcutHelp: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('shortcut:help', handler);
    return () => ipcRenderer.removeListener('shortcut:help', handler);
  },
  onShortcutToggleSession: (callback) => {
    const handler = (event, ...args) => callback(...args);
    ipcRenderer.on('shortcut:toggle-session', handler);
    return () => ipcRenderer.removeListener('shortcut:toggle-session', handler);
  },
});
