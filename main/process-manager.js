/**
 * Process Manager - Управление Python процессами
 */

const { spawn } = require('child_process');
const path = require('path');

let sttProcess = null;
let audioCaptureProcess = null;
let micCaptureProcess = null;

function stopAllProcesses() {
  if (sttProcess) {
    sttProcess.kill();
    sttProcess = null;
  }
  if (audioCaptureProcess) {
    audioCaptureProcess.kill();
    audioCaptureProcess = null;
  }
  if (micCaptureProcess) {
    micCaptureProcess.kill();
    micCaptureProcess = null;
  }
}

function startSTTProcess(mode = 'auto') {
  const venvPython = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');
  const pythonPath = require('fs').existsSync(venvPython) ? venvPython : 'python';
  const scriptPath = path.join(process.cwd(), 'python', 'stt_server.py');

  sttProcess = spawn(pythonPath, [scriptPath, '--mode', mode], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  sttProcess.stdout.on('data', (data) => {
    console.log(`STT-Dynamic (${mode}): ${data}`);
  });

  sttProcess.stderr.on('data', (data) => {
    console.error(`STT-Dynamic Error (${mode}): ${data}`);
  });

  return sttProcess;
}

function startAudioCaptureProcess(options = {}) {
  const venvPython = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');
  const pythonPath = require('fs').existsSync(venvPython) ? venvPython : 'python';
  const scriptPath = path.join(process.cwd(), 'python', 'audio_capture.py');
  const { dualAudio = false, micDeviceIndex = null } = options;

  // Loopback (системный звук)
  audioCaptureProcess = spawn(pythonPath, [scriptPath, '--mode=loopback'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Microphone (если dualAudio)
  if (dualAudio) {
    const micArgs = ['--mode=microphone'];
    if (micDeviceIndex !== null) {
      micArgs.push(`--device-index=${micDeviceIndex}`);
    }

    micCaptureProcess = spawn(pythonPath, [scriptPath, ...micArgs], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }

  return { audioCaptureProcess, micCaptureProcess };
}

module.exports = {
  stopAllProcesses,
  startSTTProcess,
  startAudioCaptureProcess,
  getSttProcess: () => sttProcess,
  getAudioCaptureProcess: () => audioCaptureProcess,
  getMicCaptureProcess: () => micCaptureProcess,
  setSttProcess: (p) => { sttProcess = p; },
  setAudioCaptureProcess: (p) => { audioCaptureProcess = p; },
  setMicCaptureProcess: (p) => { micCaptureProcess = p; },
};
