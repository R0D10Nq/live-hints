/**
 * Main Entry Point - Live Hints Electron Application
 * Refactored: modular architecture
 */

const { app, BrowserWindow } = require('electron');

const windowManager = require('./main/window-manager');
const stealthManager = require('./main/stealth-manager');
const processManager = require('./main/process-manager');
const { setupIPC } = require('./main/ipc-handlers');

let Store;
let store;

function onStealthToggle() {
  const isStealth = !stealthManager.isStealthMode();
  stealthManager.setStealthModeState(isStealth);
  if (isStealth) {
    stealthManager.activateStealth();
  } else {
    stealthManager.deactivateStealth();
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

  const onboardingWin = windowManager.createOnboardingWindow();
  windowManager.setOnboardingWindow(onboardingWin);

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
  processManager.stopAllProcesses();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    windowManager.createOnboardingWindow();
  }
});
