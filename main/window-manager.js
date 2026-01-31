/**
 * Window Manager - Управление окнами приложения
 */

const { BrowserWindow, screen, Menu } = require('electron');
const path = require('path');

let mainWindow = null;
let onboardingWindow = null;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 600,
    x: Math.max(0, width - 1300),
    y: 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function createOnboardingWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  onboardingWindow = new BrowserWindow({
    width: 520,
    height: 640,
    x: Math.floor((width - 520) / 2),
    y: Math.floor((height - 640) / 2),
    frame: false,
    transparent: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'renderer', 'preload-onboarding.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  onboardingWindow.loadFile(path.join(__dirname, '..', 'renderer', 'onboarding.html'));

  onboardingWindow.on('closed', () => {
    onboardingWindow = null;
  });

  return onboardingWindow;
}

function setupLocalShortcuts(callbacks) {
  const template = [
    {
      label: 'Приложение',
      submenu: [
        {
          label: 'Запросить подсказку',
          accelerator: 'CommandOrControl+Return',
          click: () => callbacks.onAskHint && callbacks.onAskHint(),
        },
        {
          label: 'Скриншот',
          accelerator: 'CommandOrControl+Shift+S',
          click: () => callbacks.onScreenshot && callbacks.onScreenshot(),
        },
        { type: 'separator' },
        {
          label: 'Показать/скрыть транскрипт',
          accelerator: 'CommandOrControl+T',
          click: () => callbacks.onToggleTranscript && callbacks.onToggleTranscript(),
        },
        {
          label: 'Stealth режим',
          accelerator: 'CommandOrControl+H',
          click: () => callbacks.onToggleStealth && callbacks.onToggleStealth(),
        },
        { type: 'separator' },
        {
          label: 'Предыдущая подсказка',
          accelerator: 'CommandOrControl+[',
          click: () => callbacks.onPrevHint && callbacks.onPrevHint(),
        },
        {
          label: 'Следующая подсказка',
          accelerator: 'CommandOrControl+]',
          click: () => callbacks.onNextHint && callbacks.onNextHint(),
        },
        { type: 'separator' },
        {
          label: 'Mute/Unmute микрофон',
          accelerator: 'CommandOrControl+M',
          click: () => callbacks.onToggleMute && callbacks.onToggleMute(),
        },
        {
          label: 'Настройки',
          accelerator: 'CommandOrControl+,',
          click: () => callbacks.onSettings && callbacks.onSettings(),
        },
        { type: 'separator' },
        {
          label: 'Справка',
          accelerator: 'F1',
          click: () => callbacks.onHelp && callbacks.onHelp(),
        },
        {
          label: 'Выход',
          accelerator: 'CommandOrControl+Q',
          click: () => callbacks.onQuit && callbacks.onQuit(),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = {
  createWindow,
  createOnboardingWindow,
  setupLocalShortcuts,
  getMainWindow: () => mainWindow,
  getOnboardingWindow: () => onboardingWindow,
  setMainWindow: (w) => { mainWindow = w; },
  setOnboardingWindow: (w) => { onboardingWindow = w; },
};
