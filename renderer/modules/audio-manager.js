/**
 * AudioManager - Управление аудио устройствами и WebSocket соединениями
 */

import { SERVERS, TIMEOUTS } from './constants.js';
import { logger } from './utils/logger.js';

export class AudioManager {
  constructor(app) {
    this.app = app;
    this.wsConnection = null;
    this.wsMicrophone = null;
    this.micMuted = false;
    this.dualAudioEnabled = false; // Загружается из настроек
    this.inputDeviceIndex = null;
    this.loopbackDeviceIndex = null;
  }

  setup() {
    const inputDevice = document.getElementById('input-device');
    const loopbackDevice = document.getElementById('loopback-device');
    const refreshBtn = document.getElementById('btn-refresh-devices');
    const dualAudio = document.getElementById('dual-audio');
    const micMuteBtn = document.getElementById('btn-mic-mute');

    // Загружаем настройки из localStorage
    this.loadSettings();

    this.loadDevices();

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadDevices());
    }

    if (inputDevice) {
      inputDevice.addEventListener('change', (e) => {
        this.inputDeviceIndex = e.target.value;
        this.app.saveSettings({ inputDeviceIndex: e.target.value });
      });
    }

    if (loopbackDevice) {
      loopbackDevice.addEventListener('change', (e) => {
        this.loopbackDeviceIndex = e.target.value;
        this.app.saveSettings({ loopbackDeviceIndex: e.target.value });
      });
    }

    if (dualAudio) {
      dualAudio.addEventListener('change', (e) => {
        this.dualAudioEnabled = e.target.checked;
        this.app.saveSettings({ dualAudioEnabled: e.target.checked });
        this.app.ui.showToast(
          e.target.checked ? 'Dual Audio включён' : 'Dual Audio выключен',
          'success'
        );
      });
    }

    if (micMuteBtn) {
      micMuteBtn.addEventListener('click', () => this.toggleMicMute());
    }
  }

  loadSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem('live-hints-settings')) || {};

      // Dual Audio
      if (settings.dualAudioEnabled !== undefined) {
        this.dualAudioEnabled = settings.dualAudioEnabled;
        const dualAudioCheckbox = document.getElementById('dual-audio');
        if (dualAudioCheckbox) {
          dualAudioCheckbox.checked = settings.dualAudioEnabled;
        }
        logger.info('AudioManager', 'Загружен dualAudioEnabled:', this.dualAudioEnabled);
      }

      // Input device (микрофон)
      if (settings.inputDeviceIndex !== undefined) {
        this.inputDeviceIndex = settings.inputDeviceIndex;
        logger.info('AudioManager', 'Загружен inputDeviceIndex:', this.inputDeviceIndex);
      }

      // Loopback device
      if (settings.loopbackDeviceIndex !== undefined) {
        this.loopbackDeviceIndex = settings.loopbackDeviceIndex;
      }
    } catch (e) {
      logger.error('AudioManager', 'Ошибка загрузки настроек:', e);
    }
  }

  async loadDevices() {
    try {
      const resp = await fetch(`${SERVERS.LLM}/audio/devices`);
      const data = await resp.json();

      const inputSelect = document.getElementById('input-device');
      const loopbackSelect = document.getElementById('loopback-device');

      if (inputSelect && data.input) {
        inputSelect.innerHTML =
          '<option value="">По умолчанию</option>' +
          data.input.map((d) => `<option value="${d.index}">${d.name}</option>`).join('');
      }

      if (loopbackSelect && data.output) {
        const loopbacks = data.output.filter((d) => d.isLoopback);
        loopbackSelect.innerHTML =
          '<option value="">Авто (Loopback)</option>' +
          loopbacks.map((d) => `<option value="${d.index}">${d.name}</option>`).join('');
      }
    } catch (e) {
      logger.error('AudioManager', 'Ошибка загрузки аудио устройств:', e);
    }
  }

  async connectToSTT() {
    return new Promise((resolve, reject) => {
      let resolved = false;

      try {
        logger.info('AudioManager', `Подключение к STT серверу ${SERVERS.STT}...`);
        this.wsConnection = new WebSocket(SERVERS.STT);

        this.wsConnection.onopen = () => {
          if (resolved) return;
          resolved = true;
          logger.info('AudioManager', 'Подключено к STT серверу');
          resolve();
        };

        this.wsConnection.onmessage = (event) => {
          this.handleSTTMessage(event);
        };

        this.wsConnection.onerror = (error) => {
          logger.error('AudioManager', 'WebSocket ошибка:', error);
          if (!resolved) {
            resolved = true;
            reject(new Error('Ошибка подключения к STT серверу'));
          }
        };

        this.wsConnection.onclose = () => {
          logger.info('AudioManager', 'WebSocket закрыт');
          if (!resolved) {
            resolved = true;
            reject(new Error('Соединение закрыто'));
          }
        };

        setTimeout(() => {
          if (!resolved && this.wsConnection.readyState !== WebSocket.OPEN) {
            resolved = true;
            reject(new Error('Таймаут подключения к STT серверу. Убедитесь что сервер запущен.'));
          }
        }, TIMEOUTS.STT_CONNECTION);
      } catch (error) {
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      }
    });
  }

  handleSTTMessage(event) {
    try {
      const data = JSON.parse(event.data);
      logger.debug('STT', 'Получено сообщение:', data.type, data.text?.substring(0, 50));

      if (data.type === 'transcript') {
        const latencyInfo = data.latency_ms ? ` (${data.latency_ms}ms)` : '';
        const source = data.source || 'interviewer';
        logger.info('STT', `[${source}] "${data.text}"${latencyInfo}`);

        this.app.ui.addTranscriptItem(data.text, new Date().toISOString(), source);

        // Сохраняем в контекст для подсказок
        if (!this.app.transcriptContext) {
          this.app.transcriptContext = [];
        }
        this.app.transcriptContext.push({ text: data.text, source, timestamp: Date.now() });

        // Ограничиваем контекст
        if (this.app.transcriptContext.length > 50) {
          this.app.transcriptContext = this.app.transcriptContext.slice(-50);
        }

        if (this.app.autoHintsEnabled) {
          this.app.hints.requestHint(data.text, source);
        }

        const btnGetHint = document.getElementById('btn-get-hint');
        if (btnGetHint) btnGetHint.disabled = false;
      } else if (data.type === 'status') {
        logger.debug('STT', 'Статус:', data.status);
      } else if (data.type === 'error') {
        logger.error('STT', 'Ошибка:', data.message);
        this.app.ui.showError(`STT: ${data.message}`);
      }
    } catch (e) {
      // Может быть бинарные данные
      if (typeof event.data !== 'string') {
        logger.debug('STT', 'Получены бинарные данные');
      } else {
        logger.error('STT', 'Ошибка парсинга сообщения:', e);
      }
    }
  }

  sendAudio(data, source = 'loopback') {
    if (this.app.isPaused) {
      return;
    }

    // Выбираем WebSocket в зависимости от источника
    if (source === 'microphone') {
      // Микрофон → порт 8764
      if (this.wsMicrophone && this.wsMicrophone.readyState === WebSocket.OPEN && !this.micMuted) {
        try {
          if (!this._micSentCount) this._micSentCount = 0;
          this._micSentCount++;

          if (this._micSentCount === 1) {
            logger.info('MIC', 'Первый чанк аудио отправлен, размер:', data.length || data.byteLength, 'байт');
          } else if (this._micSentCount % 100 === 0) {
            logger.info('MIC', 'Отправлено чанков:', this._micSentCount);
          }

          this.wsMicrophone.send(data);
        } catch (e) {
          logger.error('MIC', 'Ошибка отправки аудио:', e);
        }
      } else if (!this._micWsWarningShown && this.dualAudioEnabled) {
        logger.warn('MIC', 'WebSocket не открыт или muted, состояние:', this.wsMicrophone?.readyState, 'muted:', this.micMuted);
        this._micWsWarningShown = true;
      }
    } else {
      // Loopback → порт 8765
      if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
        try {
          if (!this._audioSentCount) this._audioSentCount = 0;
          this._audioSentCount++;

          if (this._audioSentCount === 1) {
            logger.info('AUDIO', 'Первый чанк аудио отправлен, размер:', data.length || data.byteLength, 'байт');
          } else if (this._audioSentCount % 100 === 0) {
            logger.info('AUDIO', 'Отправлено чанков:', this._audioSentCount);
          }

          this.wsConnection.send(data);
        } catch (e) {
          logger.error('AUDIO', 'Ошибка отправки аудио:', e);
        }
      } else {
        if (!this._wsWarningShown) {
          logger.warn('AUDIO', 'WebSocket не открыт, состояние:', this.wsConnection?.readyState);
          this._wsWarningShown = true;
        }
      }
    }
  }

  connectMicrophone() {
    if (!this.dualAudioEnabled) return;

    try {
      this.wsMicrophone = new WebSocket(SERVERS.STT_MIC);

      this.wsMicrophone.onopen = () => {
        logger.info('MIC', 'WebSocket подключен');
        this.app.ui.showToast('Микрофон подключен', 'success');
      };

      this.wsMicrophone.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'transcript' && data.text) {
            logger.info('MIC', `Транскрипт: "${data.text}"`);
            this.app.ui.addTranscriptItem(
              data.text,
              data.timestamp || new Date().toISOString(),
              'candidate'
            );

            // ВАЖНО: накапливаем контекст от микрофона тоже
            if (!this.app.transcriptContext) {
              this.app.transcriptContext = [];
            }
            this.app.transcriptContext.push({
              text: data.text,
              source: 'candidate',
              timestamp: Date.now(),
            });

            // Ограничиваем контекст
            if (this.app.transcriptContext.length > 50) {
              this.app.transcriptContext = this.app.transcriptContext.slice(-50);
            }

            // Автоматический запрос подсказки если включён
            if (this.app.autoHintsEnabled) {
              this.app.hints.requestHint(data.text, 'candidate');
            }

            const btnGetHint = document.getElementById('btn-get-hint');
            if (btnGetHint) btnGetHint.disabled = false;
          }
        } catch (e) {
          logger.error('MIC', 'Parse error:', e);
        }
      };

      this.wsMicrophone.onerror = (e) => {
        logger.error('MIC', 'WebSocket error:', e);
      };

      this.wsMicrophone.onclose = () => {
        logger.info('MIC', 'WebSocket закрыт');
      };
    } catch (e) {
      logger.error('MIC', 'Ошибка подключения:', e);
    }
  }

  disconnectMicrophone() {
    if (this.wsMicrophone) {
      this.wsMicrophone.close();
      this.wsMicrophone = null;
    }
  }

  toggleMicMute() {
    this.micMuted = !this.micMuted;
    const btn = document.getElementById('btn-mic-mute');
    if (btn) {
      btn.textContent = this.micMuted ? '🔇' : '🎤';
      btn.title = this.micMuted ? 'Включить микрофон' : 'Выключить микрофон';
    }
    this.app.ui.showToast(this.micMuted ? 'Микрофон выключен' : 'Микрофон включён', 'info');
  }

  toggleMute() {
    this.toggleMicMute();
  }

  disconnect() {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
    this.disconnectMicrophone();
  }

  async testRemoteConnection(sttUrl, llmUrl) {
    let sttOk = false;
    let llmOk = false;

    try {
      const resp = await fetch(`${llmUrl}/health`, { timeout: TIMEOUTS.REMOTE_TEST });
      llmOk = resp.ok;
    } catch (e) {
      llmOk = false;
    }

    try {
      const ws = new WebSocket(sttUrl);
      await new Promise((resolve, reject) => {
        ws.onopen = () => {
          sttOk = true;
          ws.close();
          resolve();
        };
        ws.onerror = () => {
          sttOk = false;
          reject();
        };
        setTimeout(() => {
          ws.close();
          reject();
        }, TIMEOUTS.REMOTE_TEST);
      });
    } catch (e) {
      sttOk = false;
    }

    return { sttOk, llmOk };
  }
}
