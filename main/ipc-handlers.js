/**
 * IPC Handlers - Обработчики IPC сообщений
 */

const { ipcMain, screen } = require('electron');

function setupIPC(handlers) {
  const {
    windowManager,
    stealthManager,
    processManager,
    store,
    onStealthToggle,
  } = handlers;

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

  ipcMain.handle('window:move', (event, direction) => {
    const win = windowManager.getMainWindow();
    if (!win) return;
    const [x, y] = win.getPosition();
    const step = 20;
    switch (direction) {
      case 'up': win.setPosition(x, y - step); break;
      case 'down': win.setPosition(x, y + step); break;
      case 'left': win.setPosition(x - step, y); break;
      case 'right': win.setPosition(x + step, y); break;
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
  ipcMain.handle('stt:start', async () => {
    try {
      processManager.startSTTProcess('auto');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('stt:stop', async () => {
    processManager.stopAllProcesses();
    return { success: true };
  });

  ipcMain.handle('stt:switch-mode', async (event, mode) => {
    try {
      processManager.stopAllProcesses();
      processManager.startSTTProcess(mode);
      return { success: true, mode };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Audio capture
  ipcMain.handle('audio:start-capture', async (event, options = {}) => {
    try {
      processManager.startAudioCaptureProcess(options);
      const win = windowManager.getMainWindow();
      if (win) {
        const { audioCaptureProcess, micCaptureProcess } = processManager;
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
    processManager.stopAllProcesses();
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

  // Settings
  ipcMain.handle('settings:get', (event, key) => store.get(key));
  ipcMain.handle('settings:set', (event, key, value) => store.set(key, value));
  ipcMain.handle('settings:getAll', () => store.store);
  ipcMain.handle('settings:reset', () => {
    store.clear();
    return true;
  });

  // File operations
  ipcMain.handle('file:parse', async (event, filePath, type) => {
    const fs = require('fs');
    try {
      if (type === 'pdf') {
        try {
          const pdfParse = require('pdf-parse');
          const dataBuffer = fs.readFileSync(filePath);
          const data = await pdfParse(dataBuffer);
          return data.text;
        } catch (e) {
          return fs.readFileSync(filePath, 'utf-8');
        }
      } else if (type === 'docx') {
        try {
          const mammoth = require('mammoth');
          const result = await mammoth.extractRawText({ path: filePath });
          return result.value;
        } catch (e) {
          return '';
        }
      } else {
        return fs.readFileSync(filePath, 'utf-8');
      }
    } catch (err) {
      console.error('[File] Parse error:', err);
      throw err;
    }
  });

  ipcMain.handle('file:save-context', async (event, type, content) => {
    const fs = require('fs');
    const path = require('path');
    try {
      const pythonDir = path.join(process.cwd(), 'python');
      const fileMap = {
        resume: 'user_context.txt',
        vacancy: 'vacancy.txt',
        user_context: 'mode_context.txt',
      };
      const filename = fileMap[type];
      if (filename) {
        const filePath = path.join(pythonDir, filename);
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`[File] ${type} сохранено: ${filePath} (${content.length} символов)`);
      }
      return { success: true };
    } catch (err) {
      console.error('[File] Save error:', err);
      throw err;
    }
  });
}

module.exports = { setupIPC };
