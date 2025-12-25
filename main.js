const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  desktopCapturer,
  Tray,
  Menu,
  nativeImage,
} = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
let Store;
let store;

let mainWindow = null;
let onboardingWindow = null;
let sttProcess = null;
let audioCaptureProcess = null;
let tray = null;
let stealthMode = false;
let stealthStrategy = 'content-protection';
let stealthCheckInterval = null;

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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopAllProcesses();
  });
}

function stopAllProcesses() {
  if (sttProcess) {
    sttProcess.kill();
    sttProcess = null;
  }
  if (audioCaptureProcess) {
    audioCaptureProcess.kill();
    audioCaptureProcess = null;
  }
}

function setupIPC() {
  // IPC обработчики
  ipcMain.handle('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.handle('window:close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('window:set-ignore-mouse', (event, ignore) => {
    if (mainWindow) {
      mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
    }
  });

  ipcMain.handle('stt:start', async () => {
    try {
      // Запуск Python STT сервера (используем venv если есть)
      const venvPython = path.join(__dirname, 'venv', 'Scripts', 'python.exe');
      const pythonPath = require('fs').existsSync(venvPython) ? venvPython : 'python';
      const scriptPath = path.join(__dirname, 'python', 'stt_server.py');

      sttProcess = spawn(pythonPath, [scriptPath], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      sttProcess.stdout.on('data', (data) => {
        console.log(`STT: ${data}`);
      });

      sttProcess.stderr.on('data', (data) => {
        console.error(`STT Error: ${data}`);
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stt:stop', async () => {
    stopAllProcesses();
    return { success: true };
  });

  ipcMain.handle('audio:start-capture', async () => {
    try {
      // Используем venv Python если есть
      const venvPython = path.join(__dirname, 'venv', 'Scripts', 'python.exe');
      const pythonPath = require('fs').existsSync(venvPython) ? venvPython : 'python';
      const scriptPath = path.join(__dirname, 'python', 'audio_capture.py');

      audioCaptureProcess = spawn(pythonPath, [scriptPath], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      audioCaptureProcess.stdout.on('data', (data) => {
        // Отправляем PCM данные в renderer
        if (mainWindow) {
          mainWindow.webContents.send('audio:pcm-data', data);
        }
      });

      audioCaptureProcess.stderr.on('data', (data) => {
        console.error(`Audio Capture Error: ${data}`);
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('audio:stop-capture', async () => {
    if (audioCaptureProcess) {
      audioCaptureProcess.kill();
      audioCaptureProcess = null;
    }
    return { success: true };
  });

  // Прозрачность окна
  ipcMain.handle('window:set-opacity', (event, opacity) => {
    if (mainWindow) {
      const value = Math.max(0.1, Math.min(1, opacity / 100));
      mainWindow.setOpacity(value);
    }
  });

  // Перемещение окна
  ipcMain.handle('window:move', (event, direction) => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    const step = 20;
    switch (direction) {
      case 'up':
        mainWindow.setPosition(x, y - step);
        break;
      case 'down':
        mainWindow.setPosition(x, y + step);
        break;
      case 'left':
        mainWindow.setPosition(x - step, y);
        break;
      case 'right':
        mainWindow.setPosition(x + step, y);
        break;
    }
  });

  // Показать/скрыть окно
  ipcMain.handle('window:toggle-visibility', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });

  // Получить позицию окна (для e2e тестов)
  ipcMain.handle('window:get-position', () => {
    if (!mainWindow) return null;
    return mainWindow.getPosition();
  });

  // ===== STEALTH MODE =====

  // Включить/выключить stealth режим вручную
  ipcMain.handle('stealth:toggle', () => {
    stealthMode = !stealthMode;
    if (stealthMode) {
      activateStealth();
    } else {
      deactivateStealth();
    }
    return stealthMode;
  });

  // Получить статус stealth режима
  ipcMain.handle('stealth:status', () => {
    return stealthMode;
  });

  // Установить режим stealth
  ipcMain.handle('stealth:set-mode', (event, mode) => {
    // mode: 'hide', 'tray', 'second-monitor', 'disabled'
    return setStealthMode(mode);
  });

  // Установить стратегию stealth
  ipcMain.handle('stealth:set-strategy', (event, strategy) => {
    stealthStrategy = strategy;
    console.log(`[Stealth] Стратегия установлена: ${strategy}`);
    return { strategy };
  });

  // Получить текущую стратегию
  ipcMain.handle('stealth:get-strategy', () => {
    return { strategy: stealthStrategy, active: stealthMode };
  });

  // Показать toast уведомление (для подсказок в stealth режиме)
  ipcMain.handle('stealth:show-toast', (event, text) => {
    console.log('[Stealth Toast]', text);
    return true;
  });

  // Проверить доступность второго монитора
  ipcMain.handle('stealth:has-second-monitor', () => {
    const displays = screen.getAllDisplays();
    return displays.length > 1;
  });

  // Начать мониторинг screen sharing
  ipcMain.handle('stealth:start-monitoring', () => {
    startScreenSharingMonitor();
    return true;
  });

  // Остановить мониторинг screen sharing
  ipcMain.handle('stealth:stop-monitoring', () => {
    stopScreenSharingMonitor();
    return true;
  });

  // Переместить на второй монитор
  ipcMain.handle('window:move-to-secondary', () => {
    moveToSecondaryMonitor();
  });

  // Получить список мониторов
  ipcMain.handle('window:get-displays', () => {
    return screen.getAllDisplays().map((d) => ({
      id: d.id,
      label: d.label || `Монитор ${d.id}`,
      bounds: d.bounds,
      primary: d.id === screen.getPrimaryDisplay().id,
    }));
  });

  // Переместить на конкретный монитор
  ipcMain.handle('window:move-to-display', (event, displayId) => {
    const displays = screen.getAllDisplays();
    const target = displays.find((d) => d.id === displayId);
    if (target && mainWindow) {
      const { x, y } = target.bounds;
      mainWindow.setPosition(x + 20, y + 20);
    }
  });

  // ===== VISION AI =====
  ipcMain.handle('vision:capture-screen', async () => {
    try {
      const { desktopCapturer } = require('electron');
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1280, height: 720 },
      });

      if (sources.length > 0) {
        const thumbnail = sources[0].thumbnail;
        const dataUrl = thumbnail.toDataURL();
        // Возвращаем base64 без префикса data:image/png;base64,
        return dataUrl.replace(/^data:image\/\w+;base64,/, '');
      }
      return null;
    } catch (e) {
      console.error('[Vision] Ошибка захвата экрана:', e);
      return null;
    }
  });
}

// ===== STEALTH FUNCTIONS =====

function activateStealth() {
  if (!mainWindow) return;

  // Включаем защиту контента - окно невидимо на записи экрана, но видимо локально
  mainWindow.setContentProtection(true);

  stealthMode = true;
  mainWindow.webContents.send('stealth:activated');
  console.log('[Stealth] Режим активирован - окно защищено от записи экрана');
}

function deactivateStealth() {
  if (!mainWindow) return;

  // Выключаем защиту контента - окно снова видно на записи
  mainWindow.setContentProtection(false);

  stealthMode = false;
  mainWindow.webContents.send('stealth:deactivated');
  console.log('[Stealth] Режим деактивирован - окно видно на записи');
}

function moveToSecondaryMonitor() {
  if (!mainWindow) return;

  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const secondary = displays.find((d) => d.id !== primaryDisplay.id);

  if (secondary) {
    const { x, y, width } = secondary.bounds;
    mainWindow.setPosition(x + width - 420, y + 20);
    console.log('[Stealth] Перемещено на вторичный монитор');
    return true;
  } else {
    console.log('[Stealth] Вторичный монитор не найден');
    return false;
  }
}

function startScreenSharingMonitor() {
  if (stealthCheckInterval) return;

  // Проверяем каждые 2 секунды
  stealthCheckInterval = setInterval(async () => {
    const isSharing = await checkScreenSharing();

    if (isSharing && !stealthMode) {
      console.log('[Stealth] Обнаружен screen sharing - активация stealth');
      stealthMode = true;
      activateStealth();

      // Уведомляем renderer
      if (mainWindow) {
        mainWindow.webContents.send('stealth:auto-activated');
      }
    }
  }, 2000);

  console.log('[Stealth] Мониторинг screen sharing запущен');
}

function stopScreenSharingMonitor() {
  if (stealthCheckInterval) {
    clearInterval(stealthCheckInterval);
    stealthCheckInterval = null;
    console.log('[Stealth] Мониторинг screen sharing остановлен');
  }
}

async function checkScreenSharing() {
  // Проверяем запущенные процессы screen sharing приложений
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      // Windows: проверяем процессы Zoom, Teams, Discord, Meet и т.д.
      exec(
        'tasklist /FI "IMAGENAME eq Zoom.exe" /FI "IMAGENAME eq Teams.exe" /FI "IMAGENAME eq Discord.exe" /FI "IMAGENAME eq chrome.exe"',
        (error, stdout) => {
          if (error) {
            resolve(false);
            return;
          }

          // Проверяем наличие процессов с активным screen sharing
          // Это упрощённая проверка - в реальности нужно проверять состояние sharing
          const hasScreenShareApp =
            stdout.includes('Zoom.exe') ||
            stdout.includes('Teams.exe') ||
            stdout.includes('Discord.exe');

          // Дополнительно проверяем через desktopCapturer
          desktopCapturer
            .getSources({ types: ['screen'] })
            .then((sources) => {
              // Если есть активные захваты экрана
              const activeCapture = sources.some((s) => s.name.includes('Sharing'));
              resolve(hasScreenShareApp || activeCapture);
            })
            .catch(() => resolve(hasScreenShareApp));
        }
      );
    } else {
      resolve(false);
    }
  });
}

function setStealthMode(mode) {
  // mode: 'hide', 'tray', 'second-monitor', 'disabled'
  switch (mode) {
    case 'hide':
      if (mainWindow) mainWindow.hide();
      break;
    case 'tray':
      activateStealth();
      break;
    case 'second-monitor':
      moveToSecondaryMonitor();
      break;
    case 'disabled':
      deactivateStealth();
      stealthMode = false;
      break;
  }
  return mode;
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
      preload: path.join(__dirname, 'renderer', 'preload-onboarding.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  onboardingWindow.loadFile(path.join(__dirname, 'renderer', 'onboarding.html'));

  onboardingWindow.on('closed', () => {
    onboardingWindow = null;
  });
}

function isOnboardingCompleted() {
  return store.get('onboardingCompleted', false);
}

function setupLocalShortcuts() {
  // Локальные шорткаты через меню - работают только при активном окне
  const template = [
    {
      label: 'Приложение',
      submenu: [
        {
          label: 'Запросить подсказку',
          accelerator: 'CommandOrControl+Return',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('shortcut:ask');
          },
        },
        {
          label: 'Скриншот',
          accelerator: 'CommandOrControl+Shift+S',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('shortcut:screenshot');
          },
        },
        { type: 'separator' },
        {
          label: 'Показать/скрыть транскрипт',
          accelerator: 'CommandOrControl+T',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('shortcut:toggle-transcript');
          },
        },
        {
          label: 'Stealth режим',
          accelerator: 'CommandOrControl+H',
          click: () => {
            if (mainWindow) {
              stealthMode = !stealthMode;
              if (stealthMode) activateStealth();
              else deactivateStealth();
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Предыдущая подсказка',
          accelerator: 'CommandOrControl+[',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('shortcut:prev-hint');
          },
        },
        {
          label: 'Следующая подсказка',
          accelerator: 'CommandOrControl+]',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('shortcut:next-hint');
          },
        },
        { type: 'separator' },
        {
          label: 'Mute/Unmute микрофон',
          accelerator: 'CommandOrControl+M',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('shortcut:toggle-mute');
          },
        },
        {
          label: 'Настройки',
          accelerator: 'CommandOrControl+,',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('shortcut:settings');
          },
        },
        { type: 'separator' },
        {
          label: 'Справка',
          accelerator: 'F1',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('shortcut:help');
          },
        },
        {
          label: 'Выход',
          accelerator: 'CommandOrControl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  Store = require('electron-store');
  store = new Store();
  setupIPC();

  // Onboarding IPC
  ipcMain.handle('onboarding:finish', (event, settings) => {
    store.set('onboardingCompleted', true);
    store.set('onboardingSettings', settings);
    if (onboardingWindow) onboardingWindow.close();
    createWindow();
    setupLocalShortcuts();
  });

  // Settings IPC
  ipcMain.handle('settings:get', (event, key) => store.get(key));
  ipcMain.handle('settings:set', (event, key, value) => store.set(key, value));
  ipcMain.handle('settings:getAll', () => store.store);
  ipcMain.handle('settings:reset', () => {
    store.clear();
    return true;
  });

  // Onboarding показывается при каждом запуске
  createOnboardingWindow();
});

app.on('window-all-closed', () => {
  stopAllProcesses();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createOnboardingWindow();
  }
});
