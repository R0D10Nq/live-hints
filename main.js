/**
 * Main Entry Point - Live Hints Electron Application
 * Refactored: modular architecture
 */

const { app } = require('electron');

// Single-instance guard: предотвращает запуск нескольких копий приложения одновременно
if (!app.requestSingleInstanceLock()) {
  console.log('[Main] Другой экземпляр уже запущен, выходим.');
  app.quit();
  process.exit(0);
}

const windowManager = require('./main/window-manager');
const stealthManager = require('./main/stealth-manager');
const processManager = require('./main/process-manager');
const { setupIPC } = require('./main/ipc-handlers');

let Store;
let store;

function onStealthToggle() {
  if (stealthManager.isStealthMode()) {
    stealthManager.deactivateStealth();
  } else {
    stealthManager.activateStealth();
  }
}

function onFinishOnboarding() {
  const mainWin = windowManager.getMainWindow();
  stealthManager.setMainWindow(mainWin);
  windowManager.setupLocalShortcuts({
    onAskHint: () => mainWin?.webContents?.send('shortcut:ask'),
    onScreenshot: () => mainWin?.webContents?.send('shortcut:screenshot'),
    onToggleTranscript: () => mainWin?.webContents?.send('shortcut:toggle-transcript'),
    onToggleStealth: () => onStealthToggle(),
    onPrevHint: () => mainWin?.webContents?.send('shortcut:prev-hint'),
    onNextHint: () => mainWin?.webContents?.send('shortcut:next-hint'),
    onToggleMute: () => mainWin?.webContents?.send('shortcut:toggle-mute'),
    onSettings: () => mainWin?.webContents?.send('shortcut:settings'),
    onHelp: () => mainWin?.webContents?.send('shortcut:help'),
    onQuit: () => app.quit(),
  });
}

app.whenReady().then(() => {
  Store = require('electron-store');
  store = new Store();

  const onboardingCompleted = store.get('onboardingCompleted');
  const isTest = process.env.NODE_ENV === 'test';
  console.log('[Main] NODE_ENV:', process.env.NODE_ENV);
  console.log('[Main] Onboarding completed:', onboardingCompleted);
  console.log('[Main] Is Test:', isTest);

  if (onboardingCompleted || isTest) {
    const mainWin = windowManager.createWindow();
    windowManager.setMainWindow(mainWin);
    onFinishOnboarding();
  } else {
    const onboardingWin = windowManager.createOnboardingWindow();
    windowManager.setOnboardingWindow(onboardingWin);

    onboardingWin.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('[Onboarding] Ошибка загрузки:', errorCode, errorDescription);
    });

    onboardingWin.webContents.on('console-message', (event, level, message) => {
      console.log('[Onboarding Console]', message);
    });
  }

  setupIPC({
    windowManager,
    stealthManager,
    processManager,
    store,
    onStealthToggle,
    onFinishOnboarding,
  });
});

app.on('window-all-closed', () => {
  stealthManager.stopScreenSharingMonitor();
  processManager.stopAllProcesses();
  app.quit();
});

app.on('second-instance', () => {
  const mainWin = windowManager.getMainWindow();
  const onboardingWin = windowManager.getOnboardingWindow();
  const targetWin = mainWin || onboardingWin;
  if (targetWin) {
    if (targetWin.isMinimized()) targetWin.restore();
    targetWin.show();
    targetWin.focus();
  } else {
    console.log('[Main] Второй экземпляр: окна отсутствуют');
  }
});
