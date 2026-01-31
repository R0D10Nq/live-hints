const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
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
    ipcRenderer.on('audio:pcm-data', (event, data, source) => callback(data, source));
  },

  onTranscript: (callback) => {
    ipcRenderer.on('stt:transcript', (event, data) => callback(data));
  },

  onHint: (callback) => {
    ipcRenderer.on('llm:hint', (event, data) => callback(data));
  },

  onStatusChange: (callback) => {
    ipcRenderer.on('status:change', (event, status) => callback(status));
  },

  onError: (callback) => {
    ipcRenderer.on('error', (event, error) => callback(error));
  },

  // Удаление слушателей
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
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
  onStealthActivated: (callback) => ipcRenderer.on('stealth:activated', callback),
  onStealthDeactivated: (callback) => ipcRenderer.on('stealth:deactivated', callback),
  onStealthAutoActivated: (callback) => ipcRenderer.on('stealth:auto-activated', callback),

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
  onShortcutAsk: (callback) => ipcRenderer.on('shortcut:ask', callback),
  onShortcutScreenshot: (callback) => ipcRenderer.on('shortcut:screenshot', callback),
  onShortcutToggleTranscript: (callback) => ipcRenderer.on('shortcut:toggle-transcript', callback),
  onShortcutPrevHint: (callback) => ipcRenderer.on('shortcut:prev-hint', callback),
  onShortcutNextHint: (callback) => ipcRenderer.on('shortcut:next-hint', callback),
  onShortcutSettings: (callback) => ipcRenderer.on('shortcut:settings', callback),
  onShortcutToggleMute: (callback) => ipcRenderer.on('shortcut:toggle-mute', callback),
  onShortcutHelp: (callback) => ipcRenderer.on('shortcut:help', callback),
  onShortcutToggleSession: (callback) => ipcRenderer.on('shortcut:toggle-session', callback),
});
