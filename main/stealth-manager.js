/**
 * Stealth Manager - Управление stealth режимом
 */

const { screen, desktopCapturer } = require('electron');
const { exec } = require('child_process');

let stealthMode = false;
let stealthStrategy = 'content-protection';
let stealthCheckInterval = null;
let mainWindow = null;

function setMainWindow(window) {
  mainWindow = window;
}

function activateStealth() {
  if (!mainWindow) return;

  try {
    mainWindow.setContentProtection(true);
  } catch {}
  stealthMode = true;
  mainWindow.webContents.send('stealth:activated');
  console.log('[Stealth] Режим активирован - окно защищено от записи экрана');
}

function deactivateStealth() {
  if (!mainWindow) return;

  try {
    mainWindow.setContentProtection(false);
  } catch {}
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

async function checkScreenSharing() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec(
        'tasklist /FI "IMAGENAME eq Zoom.exe" /FI "IMAGENAME eq Teams.exe" /FI "IMAGENAME eq Discord.exe" /FI "IMAGENAME eq chrome.exe"',
        (error, stdout) => {
          if (error) {
            resolve(false);
            return;
          }

          const hasScreenShareApp =
            stdout.includes('Zoom.exe') ||
            stdout.includes('Teams.exe') ||
            stdout.includes('Discord.exe');

          desktopCapturer
            .getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
            .then((sources) => {
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

function startScreenSharingMonitor() {
  if (stealthCheckInterval) return;

  const tick = () => {
    checkScreenSharing()
      .then((isSharing) => {
        if (isSharing && !stealthMode) {
          console.log('[Stealth] Обнаружен screen sharing - активация stealth');
          stealthMode = true;
          activateStealth();

          if (mainWindow) {
            mainWindow.webContents.send('stealth:auto-activated');
          }
        }
      })
      .catch((err) => {
        console.error('[Stealth] Ошибка проверки screen sharing:', err);
      });
  };

  stealthCheckInterval = setInterval(tick, 5000);

  console.log('[Stealth] Мониторинг screen sharing запущен');
}

function stopScreenSharingMonitor() {
  if (stealthCheckInterval) {
    clearInterval(stealthCheckInterval);
    stealthCheckInterval = null;
    console.log('[Stealth] Мониторинг screen sharing остановлен');
  }
}

function setStealthMode(mode) {
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

module.exports = {
  activateStealth,
  deactivateStealth,
  moveToSecondaryMonitor,
  checkScreenSharing,
  startScreenSharingMonitor,
  stopScreenSharingMonitor,
  setStealthMode,
  setMainWindow,
  isStealthMode: () => stealthMode,
  // setStealthModeState переименован — прямой доступ к внутреннему флагу отсутствует.
  // Используйте activateStealth() / deactivateStealth() вместо этого.
  getStealthStrategy: () => stealthStrategy,
  setStealthStrategy: (s) => {
    stealthStrategy = s;
  },
};
