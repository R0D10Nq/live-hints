/**
 * Window Manager - Управление окнами приложения
 */

const { BrowserWindow, screen, Menu } = require('electron');
const path = require('path');

let mainWindow = null;
let onboardingWindow = null;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    title: 'Live Hints',
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
  mainWindow.setAlwaysOnTop(true);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function createOnboardingWindow() {
  onboardingWindow = new BrowserWindow({
    title: 'Live Hints — Настройка',
    width: 760,
    height: 860,
    minWidth: 600,
    minHeight: 700,
    center: true,
    frame: true,
    transparent: false,
    backgroundColor: '#0f1117',
    resizable: true,
    alwaysOnTop: true,
    show: true,
    skipTaskbar: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'renderer', 'preload-onboarding.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  onboardingWindow.loadFile(path.join(__dirname, '..', 'renderer', 'onboarding.html'));

  onboardingWindow.show();
  onboardingWindow.focus();
  onboardingWindow.moveTop();
  onboardingWindow.setAlwaysOnTop(true);

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
  setMainWindow: (w) => {
    mainWindow = w;
  },
  setOnboardingWindow: (w) => {
    onboardingWindow = w;
  },
};
