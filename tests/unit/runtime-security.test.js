/**
 * Регрессионные тесты критических границ Electron runtime.
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf-8');
}

describe('Безопасный Electron runtime', () => {
  test('preload не открывает произвольные invoke и send', () => {
    const preload = read('preload.js');

    expect(preload).not.toMatch(/\binvoke\s*:\s*/);
    expect(preload).not.toMatch(/\bsend\s*:\s*/);
    expect(preload).toContain("ipcRenderer.invoke('runtime:start', options)");
    expect(preload).toContain("ipcRenderer.invoke('runtime:stop')");
    expect(preload).not.toContain("ipcRenderer.invoke('file:parse'");
  });

  test('остановленная или приостановленная сессия игнорирует поздние события', () => {
    const app = read('renderer/app.js');

    expect(app).toContain(
      "if (!state.get('session.isActive') || state.get('session.isPaused')) return;"
    );
    expect(app).toMatch(
      /data\.type === 'transcript'[\s\S]*?state\.get\('session\.isActive'\)[\s\S]*?!state\.get\('session\.isPaused'\)/
    );
    expect(app).toContain("if (!isActive && status !== 'idle') return;");
    expect(app).toContain("if (isPaused && status === 'recording') return;");
    expect(app).toContain("if (!state.get('session.isActive')) return;");
    expect(app).toContain('const requestEpoch = this.sessionEpoch;');
    expect(app).toContain('if (requestEpoch !== this.sessionEpoch) return false;');
  });

  test('runtime запускает LLM, основной STT и микрофонный STT по настройке', () => {
    const ipcHandlers = read('main/ipc-handlers.js');
    const processManager = read('main/process-manager.js');

    expect(ipcHandlers).toContain("ipcMain.handle('runtime:start'");
    expect(ipcHandlers).toContain('await processManager.startLLMProcess()');
    expect(ipcHandlers).toContain("await processManager.startSTTProcess('auto', 8765)");
    expect(ipcHandlers).toContain("await processManager.startSTTProcess('microphone', 8764)");
    expect(processManager).toContain("PYTHONIOENCODING: 'utf-8'");
    expect(processManager).toContain("PYTHONUTF8: '1'");
  });

  test('остановка STT не останавливает LLM', () => {
    const ipcHandlers = read('main/ipc-handlers.js');
    const stopHandler = ipcHandlers.match(/ipcMain\.handle\('stt:stop',[\s\S]*?\n\s*}\);/)?.[0];

    expect(stopHandler).toContain('processManager.stopSTTProcess()');
    expect(stopHandler).not.toContain('stopLLMProcess');
    expect(stopHandler).not.toContain('stopAllProcesses');
  });

  test('dual-audio подписывается на процессы, возвращённые менеджером', () => {
    const ipcHandlers = read('main/ipc-handlers.js');

    expect(ipcHandlers).toMatch(
      /const \{ audioCaptureProcess, micCaptureProcess \} =[\s\S]*?startAudioCaptureProcess\(options\)/
    );
    expect(ipcHandlers).not.toContain('processManager.audioCaptureProcess');
    expect(ipcHandlers).not.toContain('processManager.micCaptureProcess');
  });

  test('упаковка использует whitelist и исключает рабочие данные', () => {
    const packageJson = JSON.parse(read('package.json'));
    const files = packageJson.build.files;

    expect(files).toContain('main/**/*');
    expect(files).toContain('!**/.history{,/**/*}');
    expect(files).toContain('!tests{,/**/*}');
    expect(files).toContain('!logs{,/**/*}');
    expect(files).toContain('!data{,/**/*}');
    expect(packageJson.build.asarUnpack).toContain('python/**/*');
  });
});
