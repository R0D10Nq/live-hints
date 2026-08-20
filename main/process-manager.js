/**
 * Process Manager - Управление Python процессами
 */

const { spawn } = require('child_process');
const { app } = require('electron');
const net = require('net');
const path = require('path');

let sttProcess = null;
let micSttProcess = null;
let llmProcess = null;
let audioCaptureProcess = null;
let micCaptureProcess = null;

function getRuntimeRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked');
  }
  return path.resolve(__dirname, '..');
}

function getRuntimeEnv() {
  return {
    ...process.env,
    LIVE_HINTS_DATA_DIR: app.getPath('userData'),
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1',
  };
}

function isRunning(process) {
  return Boolean(process && process.exitCode === null && !process.killed);
}

function stopProcess(process) {
  if (isRunning(process)) {
    process.kill();
  }
}

function waitForPort(
  port,
  host = '127.0.0.1',
  timeoutMs = 60000,
  process = null,
  serviceName = 'Сервис'
) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const tryConnect = () => {
      if (process && !isRunning(process)) {
        reject(new Error(`${serviceName} завершился до готовности с кодом ${process.exitCode}`));
        return;
      }

      const socket = net.createConnection({ port, host });
      socket.setTimeout(500);

      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });

      const retry = () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`${serviceName} не открыл порт ${port} за ${timeoutMs} мс`));
          return;
        }
        setTimeout(tryConnect, 250);
      };

      socket.once('error', retry);
      socket.once('timeout', retry);
    };

    tryConnect();
  });
}

function assertPortAvailable(port, host = '127.0.0.1', timeoutMs = 500, serviceName = 'Сервис') {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port, host });
    let settled = false;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      finish(new Error(`Порт ${port} уже занят; ${serviceName} не может быть запущен`));
    });
    socket.once('error', (error) => {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENETUNREACH') finish();
      else finish(error);
    });
    socket.once('timeout', () => {
      finish(new Error(`Не удалось проверить свободность порта ${port} для ${serviceName}`));
    });
  });
}

function stopSTTProcess() {
  stopProcess(sttProcess);
  stopProcess(micSttProcess);
  sttProcess = null;
  micSttProcess = null;
}

function stopLLMProcess() {
  stopProcess(llmProcess);
  llmProcess = null;
}

function stopAudioCaptureProcesses() {
  stopProcess(audioCaptureProcess);
  stopProcess(micCaptureProcess);
  audioCaptureProcess = null;
  micCaptureProcess = null;
}

function stopAllProcesses() {
  stopSTTProcess();
  stopLLMProcess();
  stopAudioCaptureProcesses();
}

async function startSTTProcess(mode = 'auto', port = 8765) {
  const isMicrophone = port === 8764;
  const currentProcess = isMicrophone ? micSttProcess : sttProcess;
  if (isRunning(currentProcess)) {
    await waitForPort(
      port,
      '127.0.0.1',
      5000,
      currentProcess,
      isMicrophone ? 'Микрофонный STT' : 'STT'
    );
    return currentProcess;
  }

  const rootDir = getRuntimeRoot();
  await assertPortAvailable(port, '127.0.0.1', 500, isMicrophone ? 'Микрофонный STT' : 'STT');
  const venvPython = path.join(rootDir, 'venv', 'Scripts', 'python.exe');
  const pythonPath = require('fs').existsSync(venvPython) ? venvPython : 'python';
  const scriptPath = path.join(rootDir, 'python', 'stt_server.py');

  const process = spawn(pythonPath, [scriptPath, '--mode', mode, '--port', String(port)], {
    cwd: rootDir,
    env: getRuntimeEnv(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (isMicrophone) micSttProcess = process;
  else sttProcess = process;

  process.stdout.on('data', (data) => {
    console.log(`STT-Dynamic (${mode}): ${data}`);
  });

  process.stderr.on('data', (data) => {
    console.error(`STT-Dynamic Error (${mode}): ${data}`);
  });

  process.once('error', (error) => {
    console.error(`Не удалось запустить STT (${mode}):`, error);
    if (isMicrophone) {
      if (micSttProcess === process) micSttProcess = null;
    } else if (sttProcess === process) {
      sttProcess = null;
    }
  });

  process.once('exit', (code, signal) => {
    console.log(`STT завершён: код=${code}, сигнал=${signal || 'нет'}`);
    if (isMicrophone) {
      if (micSttProcess === process) micSttProcess = null;
    } else if (sttProcess === process) {
      sttProcess = null;
    }
  });

  try {
    await waitForPort(port, '127.0.0.1', 60000, process, isMicrophone ? 'Микрофонный STT' : 'STT');
    return process;
  } catch (error) {
    stopProcess(process);
    if (isMicrophone) {
      if (micSttProcess === process) micSttProcess = null;
    } else if (sttProcess === process) {
      sttProcess = null;
    }
    throw error;
  }
}

async function startLLMProcess(port = 8766) {
  if (isRunning(llmProcess)) {
    await waitForPort(port, '127.0.0.1', 5000, llmProcess, 'LLM');
    return llmProcess;
  }

  const rootDir = getRuntimeRoot();
  await assertPortAvailable(port, '127.0.0.1', 500, 'LLM');
  const venvPython = path.join(rootDir, 'venv', 'Scripts', 'python.exe');
  const pythonPath = require('fs').existsSync(venvPython) ? venvPython : 'python';
  const scriptPath = path.join(rootDir, 'python', 'llm_server.py');

  const process = spawn(pythonPath, [scriptPath], {
    cwd: rootDir,
    env: getRuntimeEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  llmProcess = process;

  process.stdout.on('data', (data) => console.log(`LLM: ${data}`));
  process.stderr.on('data', (data) => console.error(`LLM Error: ${data}`));
  process.once('error', (error) => {
    console.error('Не удалось запустить LLM:', error);
    if (llmProcess === process) llmProcess = null;
  });
  process.once('exit', (code, signal) => {
    console.log(`LLM завершён: код=${code}, сигнал=${signal || 'нет'}`);
    if (llmProcess === process) llmProcess = null;
  });

  try {
    await waitForPort(port, '127.0.0.1', 30000, process, 'LLM');
    return process;
  } catch (error) {
    stopProcess(process);
    if (llmProcess === process) llmProcess = null;
    throw error;
  }
}

function startAudioCaptureProcess(options = {}) {
  stopAudioCaptureProcesses();

  const rootDir = getRuntimeRoot();
  const venvPython = path.join(rootDir, 'venv', 'Scripts', 'python.exe');
  const pythonPath = require('fs').existsSync(venvPython) ? venvPython : 'python';
  const scriptPath = path.join(rootDir, 'python', 'audio_capture.py');
  const { dualAudio = false, micDeviceIndex = null } = options;

  // Loopback (системный звук)
  audioCaptureProcess = spawn(pythonPath, [scriptPath, '--mode=loopback'], {
    cwd: rootDir,
    env: getRuntimeEnv(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  audioCaptureProcess.once('error', (error) => {
    console.error('Не удалось запустить захват системного звука:', error);
  });

  // Microphone (если dualAudio)
  if (dualAudio) {
    const micArgs = ['--mode=microphone'];
    if (micDeviceIndex !== null) {
      micArgs.push(`--device-index=${micDeviceIndex}`);
    }

    micCaptureProcess = spawn(pythonPath, [scriptPath, ...micArgs], {
      cwd: rootDir,
      env: getRuntimeEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    micCaptureProcess.once('error', (error) => {
      console.error('Не удалось запустить захват микрофона:', error);
    });
  }

  return { audioCaptureProcess, micCaptureProcess };
}

module.exports = {
  stopAllProcesses,
  stopSTTProcess,
  stopLLMProcess,
  stopAudioCaptureProcesses,
  startSTTProcess,
  startLLMProcess,
  startAudioCaptureProcess,
  getSttProcess: () => sttProcess,
  getMicSttProcess: () => micSttProcess,
  getLLMProcess: () => llmProcess,
  getAudioCaptureProcess: () => audioCaptureProcess,
  getMicCaptureProcess: () => micCaptureProcess,
  setSttProcess: (p) => {
    sttProcess = p;
  },
  setMicSttProcess: (p) => {
    micSttProcess = p;
  },
  setAudioCaptureProcess: (p) => {
    audioCaptureProcess = p;
  },
  setMicCaptureProcess: (p) => {
    micCaptureProcess = p;
  },
};
