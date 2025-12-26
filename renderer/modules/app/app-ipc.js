/**
 * App IPC - обработчики IPC событий
 */

export class AppIPC {
  constructor(app) {
    this.app = app;
    this._pcmLogCount = 0;
  }

  setup() {
    // PCM данные от audio_capture.py
    window.electronAPI.onPCMData((data, source) => {
      this._pcmLogCount++;

      if (this._pcmLogCount === 1) {
        console.log(
          '[IPC] Первый PCM чанк получен, source:',
          source,
          'размер:',
          data?.length || data?.byteLength
        );
      } else if (this._pcmLogCount % 100 === 0) {
        console.log('[IPC] PCM чанков получено:', this._pcmLogCount, 'source:', source);
      }

      if (data && data.length > 0) {
        const arrayBuffer = data.buffer
          ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
          : data;
        this.app.audio.sendAudio(arrayBuffer, source || 'loopback');
      }
    });

    window.electronAPI.onTranscript((data) => {
      this.app.ui.addTranscriptItem(data.text, data.timestamp);
    });

    window.electronAPI.onHint((data) => {
      this.app.ui.addHintItem(data.text, data.timestamp);
    });

    window.electronAPI.onStatusChange((status) => {
      this.app.ui.updateStatus(status);
    });

    window.electronAPI.onError((error) => {
      this.app.ui.showError(error.message);
    });

    // Горячие клавиши
    window.electronAPI.onShortcutAsk(() => {
      this.app.hints.manualRequestHint();
    });

    window.electronAPI.onShortcutScreenshot(() => {
      this.app.vision.captureAndAnalyze();
    });

    window.electronAPI.onShortcutToggleTranscript(() => {
      this.app.ui.toggleTranscriptsVisibility();
    });

    window.electronAPI.onShortcutPrevHint(() => {
      this.app.ui.showPrevHint();
    });

    window.electronAPI.onShortcutNextHint(() => {
      this.app.ui.showNextHint();
    });

    window.electronAPI.onShortcutSettings(() => {
      this.app.ui.toggleSettingsPanel();
    });

    window.electronAPI.onShortcutToggleMute(() => {
      this.app.audio.toggleMute();
    });

    window.electronAPI.onShortcutHelp(() => {
      this.app.ui.showHelpModal();
    });

    window.electronAPI.onShortcutToggleSession(() => {
      if (this.app.isRunning) {
        this.app.stop();
      } else {
        this.app.start();
      }
    });
  }
}
