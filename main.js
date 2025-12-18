const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let sttProcess = null;
let audioCaptureProcess = null;

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    mainWindow = new BrowserWindow({
        width: 400,
        height: 600,
        x: width - 420,
        y: 20,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: false,
        resizable: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
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
                stdio: ['pipe', 'pipe', 'pipe']
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
                stdio: ['pipe', 'pipe', 'pipe']
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
}

app.whenReady().then(() => {
    setupIPC();
    createWindow();
});

app.on('window-all-closed', () => {
    stopAllProcesses();
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
