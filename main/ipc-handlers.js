/**
 * IPC Handlers - Обработчики IPC сообщений
 */

const { ipcMain, screen } = require('electron');

const MAX_IMPORTED_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CONTEXT_CHARS = 1_000_000;
const ALLOWED_FILE_TYPES = new Set(['pdf', 'docx', 'txt', 'md']);
const ALLOWED_SETTINGS = new Map([
  ['provider', 'string'],
  ['profile', 'string'],
  ['autoHints', 'boolean'],
  ['dualAudio', 'boolean'],
  ['alwaysOnTop', 'boolean'],
  ['compactMode', 'boolean'],
  ['theme', 'string'],
  ['opacity', 'number'],
]);

function validateSetting(key, value) {
  const expectedType = ALLOWED_SETTINGS.get(key);
  if (!expectedType) {
    throw new Error(`Настройка ${key} не разрешена`);
  }
  if (typeof value !== expectedType) {
    throw new TypeError(`Настройка ${key} должна иметь тип ${expectedType}`);
  }
  if (key === 'opacity' && (value < 50 || value > 100)) {
    throw new RangeError('Прозрачность должна быть в диапазоне от 50 до 100');
  }
}

function setupIPC(handlers) {
  const { windowManager, stealthManager, processManager, store, onStealthToggle } = handlers;

  // Window controls
  ipcMain.handle('window:minimize', () => {
    const win = windowManager.getMainWindow();
    if (win) win.minimize();
  });

  ipcMain.handle('window:close', () => {
    const mainWin = windowManager.getMainWindow();
    const onboardingWin = windowManager.getOnboardingWindow();
    if (mainWin) mainWin.close();
    if (onboardingWin) {
      onboardingWin.close();
      require('electron').app.quit();
    }
  });

  ipcMain.handle('window:set-ignore-mouse', (event, ignore) => {
    const win = windowManager.getMainWindow();
    if (win) win.setIgnoreMouseEvents(ignore, { forward: true });
  });

  ipcMain.handle('window:set-opacity', (event, opacity) => {
    const win = windowManager.getMainWindow();
    if (win) {
      const value = Math.max(0.1, Math.min(1, opacity / 100));
      win.setOpacity(value);
    }
  });

  ipcMain.handle('window:set-always-on-top', (event, alwaysOnTop) => {
    const win = windowManager.getMainWindow();
    if (win) win.setAlwaysOnTop(alwaysOnTop);
  });

  ipcMain.handle('window:move', (event, direction) => {
    const win = windowManager.getMainWindow();
    if (!win) return;
    const [x, y] = win.getPosition();
    const step = 20;
    switch (direction) {
      case 'up':
        win.setPosition(x, y - step);
        break;
      case 'down':
        win.setPosition(x, y + step);
        break;
      case 'left':
        win.setPosition(x - step, y);
        break;
      case 'right':
        win.setPosition(x + step, y);
        break;
    }
  });

  ipcMain.handle('window:toggle-visibility', () => {
    const win = windowManager.getMainWindow();
    if (!win) return;
    if (win.isVisible()) win.hide();
    else win.show();
  });

  ipcMain.handle('window:get-position', () => {
    const win = windowManager.getMainWindow();
    return win ? win.getPosition() : null;
  });

  // Display management
  ipcMain.handle('window:get-displays', () => {
    return screen.getAllDisplays().map((d) => ({
      id: d.id,
      label: d.label || `Монитор ${d.id}`,
      bounds: d.bounds,
      primary: d.id === screen.getPrimaryDisplay().id,
    }));
  });

  ipcMain.handle('window:move-to-display', (event, displayId) => {
    const win = windowManager.getMainWindow();
    if (!win) return;
    const displays = screen.getAllDisplays();
    const target = displays.find((d) => d.id === displayId);
    if (target) {
      const { x, y } = target.bounds;
      win.setPosition(x + 20, y + 20);
    }
  });

  // STT
  ipcMain.handle('runtime:start', async (event, options = {}) => {
    try {
      await processManager.startLLMProcess();
      await processManager.startSTTProcess('auto', 8765);
      if (options.dualAudio === true) {
        await processManager.startSTTProcess('microphone', 8764);
      }
      return { success: true };
    } catch (error) {
      processManager.stopAllProcesses();
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('runtime:stop', async () => {
    processManager.stopAllProcesses();
    return { success: true };
  });

  ipcMain.handle('llm:start', async () => {
    try {
      await processManager.startLLMProcess();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stt:start', async (event, options = {}) => {
    try {
      await processManager.startSTTProcess('auto', 8765);
      if (options.dualAudio === true) {
        await processManager.startSTTProcess('microphone', 8764);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stt:stop', async () => {
    processManager.stopSTTProcess();
    return { success: true };
  });

  ipcMain.handle('stt:switch-mode', async (event, mode) => {
    try {
      processManager.stopSTTProcess();
      await processManager.startSTTProcess(mode);
      return { success: true, mode };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Audio capture
  ipcMain.handle('audio:start-capture', async (event, options = {}) => {
    try {
      const { audioCaptureProcess, micCaptureProcess } =
        processManager.startAudioCaptureProcess(options);
      const win = windowManager.getMainWindow();
      if (win) {
        audioCaptureProcess?.stdout?.on('data', (data) => {
          win.webContents.send('audio:pcm-data', data, 'loopback');
        });
        micCaptureProcess?.stdout?.on('data', (data) => {
          win.webContents.send('audio:pcm-data', data, 'microphone');
        });
      }
      return { success: true, dualAudio: options.dualAudio };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('audio:stop-capture', async () => {
    processManager.stopAudioCaptureProcesses();
    return { success: true };
  });

  // Stealth
  ipcMain.handle('stealth:toggle', () => {
    onStealthToggle && onStealthToggle();
    return stealthManager.isStealthMode();
  });

  ipcMain.handle('stealth:status', () => stealthManager.isStealthMode());

  ipcMain.handle('stealth:set-mode', (event, mode) => stealthManager.setStealthMode(mode));

  ipcMain.handle('stealth:set-strategy', (event, strategy) => {
    stealthManager.setStealthStrategy(strategy);
    return { strategy };
  });

  ipcMain.handle('stealth:get-strategy', () => ({
    strategy: stealthManager.getStealthStrategy(),
    active: stealthManager.isStealthMode(),
  }));

  ipcMain.handle('stealth:show-toast', (event, text) => {
    console.log('[Stealth Toast]', text);
    return true;
  });

  ipcMain.handle('stealth:has-second-monitor', () => {
    return screen.getAllDisplays().length > 1;
  });

  ipcMain.handle('stealth:start-monitoring', () => {
    stealthManager.startScreenSharingMonitor();
    return true;
  });

  ipcMain.handle('stealth:stop-monitoring', () => {
    stealthManager.stopScreenSharingMonitor();
    return true;
  });

  ipcMain.handle('window:move-to-secondary', () => {
    stealthManager.moveToSecondaryMonitor();
  });

  // Vision AI
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
        return dataUrl.replace(/^data:image\/\w+;base64,/, '');
      }
      return null;
    } catch (e) {
      console.error('[Vision] Ошибка захвата экрана:', e);
      return null;
    }
  });

  // Onboarding
  ipcMain.handle('onboarding:finish', (event, settings) => {
    try {
      store.set('onboardingCompleted', true);
      store.set('onboardingSettings', settings);

      const mainWin = windowManager.createWindow();
      if (!mainWin) {
        throw new Error('Не удалось создать главное окно');
      }

      windowManager.setMainWindow(mainWin);

      const onboardingWin = windowManager.getOnboardingWindow();
      if (onboardingWin) onboardingWin.close();

      handlers.onFinishOnboarding && handlers.onFinishOnboarding();
      return { success: true };
    } catch (error) {
      console.error('[Onboarding] Ошибка завершения:', error);
      return { success: false, error: error.message };
    }
  });

  // Парсинг загруженных пользователем файлов из буфера
  ipcMain.handle('file:parse-buffer', async (event, bufferData, type) => {
    try {
      if (!ALLOWED_FILE_TYPES.has(type)) {
        throw new Error(`Тип файла ${type} не поддерживается`);
      }
      const buffer = Buffer.from(bufferData);
      if (buffer.length > MAX_IMPORTED_FILE_BYTES) {
        throw new Error('Размер файла превышает 10 МБ');
      }
      if (type === 'pdf') {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        return data.text;
      } else if (type === 'docx') {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      }
      return buffer.toString('utf-8');
    } catch (err) {
      console.error('[File] Parse buffer error:', err);
      throw err;
    }
  });

  // Settings
  ipcMain.handle('settings:get', (event, key) => store.get(key));
  ipcMain.handle('settings:set', (event, key, value) => {
    validateSetting(key, value);
    store.set(key, value);
    return true;
  });
  ipcMain.handle('settings:getAll', () => store.store);
  ipcMain.handle('settings:reset', () => {
    store.clear();
    require('electron').app.relaunch();
    require('electron').app.exit(0);
    return true;
  });

  ipcMain.handle('file:save-context', async (event, type, content) => {
    const fs = require('fs');
    const path = require('path');
    try {
      if (typeof content !== 'string') {
        throw new TypeError('Контекст должен быть строкой');
      }
      if (content.length > MAX_CONTEXT_CHARS) {
        throw new Error('Размер контекста превышает 1 000 000 символов');
      }
      const contextDir = require('electron').app.getPath('userData');
      fs.mkdirSync(contextDir, { recursive: true });
      const fileMap = {
        resume: 'user_context.txt',
        vacancy: 'vacancy.txt',
        user_context: 'mode_context.txt',
      };
      const filename = fileMap[type];
      if (!filename) {
        throw new Error(`Тип контекста ${type} не поддерживается`);
      }
      const filePath = path.join(contextDir, filename);
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`[File] ${type} сохранено: ${filePath} (${content.length} символов)`);
      return { success: true };
    } catch (err) {
      console.error('[File] Save error:', err);
      throw err;
    }
  });
}

module.exports = { setupIPC };
