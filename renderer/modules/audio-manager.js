/**
 * AudioManager - Управление аудио устройствами и WebSocket соединениями
 */

import { SERVERS, TIMEOUTS } from './constants.js';

export class AudioManager {
    constructor(app) {
        this.app = app;
        this.wsConnection = null;
        this.wsMicrophone = null;
        this.micMuted = false;
        this.dualAudioEnabled = false;
        this.inputDeviceIndex = null;
        this.loopbackDeviceIndex = null;
    }

    setup() {
        const inputDevice = document.getElementById('input-device');
        const loopbackDevice = document.getElementById('loopback-device');
        const refreshBtn = document.getElementById('btn-refresh-devices');
        const dualAudio = document.getElementById('dual-audio');
        const micMuteBtn = document.getElementById('btn-mic-mute');

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
                this.app.ui.showToast(e.target.checked ? 'Dual Audio включён' : 'Dual Audio выключен', 'success');
            });
        }

        if (micMuteBtn) {
            micMuteBtn.addEventListener('click', () => this.toggleMicMute());
        }
    }

    async loadDevices() {
        try {
            const resp = await fetch(`${SERVERS.LLM}/audio/devices`);
            const data = await resp.json();

            const inputSelect = document.getElementById('input-device');
            const loopbackSelect = document.getElementById('loopback-device');

            if (inputSelect && data.input) {
                inputSelect.innerHTML = '<option value="">По умолчанию</option>' +
                    data.input.map(d => `<option value="${d.index}">${d.name}</option>`).join('');
            }

            if (loopbackSelect && data.output) {
                const loopbacks = data.output.filter(d => d.isLoopback);
                loopbackSelect.innerHTML = '<option value="">Авто (Loopback)</option>' +
                    loopbacks.map(d => `<option value="${d.index}">${d.name}</option>`).join('');
            }
        } catch (e) {
            console.error('Ошибка загрузки аудио устройств:', e);
        }
    }

    async connectToSTT() {
        return new Promise((resolve, reject) => {
            let resolved = false;

            try {
                console.log(`Подключение к STT серверу ${SERVERS.STT}...`);
                this.wsConnection = new WebSocket(SERVERS.STT);

                this.wsConnection.onopen = () => {
                    if (resolved) return;
                    resolved = true;
                    console.log('Подключено к STT серверу');
                    resolve();
                };

                this.wsConnection.onmessage = (event) => {
                    this.handleSTTMessage(event);
                };

                this.wsConnection.onerror = (error) => {
                    console.error('WebSocket ошибка:', error);
                    if (!resolved) {
                        resolved = true;
                        reject(new Error('Ошибка подключения к STT серверу'));
                    }
                };

                this.wsConnection.onclose = () => {
                    console.log('WebSocket закрыт');
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
            if (data.type === 'transcript') {
                const latencyInfo = data.latency_ms ? ` (${data.latency_ms}ms)` : '';
                const source = data.source || 'interviewer';
                console.log(`[STT:${source}] "${data.text}"${latencyInfo}`);

                this.app.ui.addTranscriptItem(data.text, new Date().toISOString(), source);

                if (this.app.autoHintsEnabled) {
                    this.app.hints.requestHint(data.text);
                }

                const btnGetHint = document.getElementById('btn-get-hint');
                if (btnGetHint) btnGetHint.disabled = false;
            }
        } catch (e) {
            console.error('Ошибка парсинга сообщения:', e);
        }
    }

    sendAudio(data) {
        if (this.app.isPaused) return;

        if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
            try {
                this.wsConnection.send(data);
            } catch (e) {
                console.error('Ошибка отправки аудио:', e);
            }
        }
    }

    connectMicrophone() {
        if (!this.dualAudioEnabled) return;

        try {
            this.wsMicrophone = new WebSocket(SERVERS.STT_MIC);

            this.wsMicrophone.onopen = () => {
                console.log('[MIC] WebSocket подключен');
                this.app.ui.showToast('Микрофон подключен', 'success');
            };

            this.wsMicrophone.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'transcript' && data.text) {
                        this.app.ui.addTranscriptItem(data.text, data.timestamp, 'candidate');
                    }
                } catch (e) {
                    console.error('[MIC] Parse error:', e);
                }
            };

            this.wsMicrophone.onerror = (e) => {
                console.error('[MIC] WebSocket error:', e);
            };

            this.wsMicrophone.onclose = () => {
                console.log('[MIC] WebSocket закрыт');
            };
        } catch (e) {
            console.error('[MIC] Ошибка подключения:', e);
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
                ws.onopen = () => { sttOk = true; ws.close(); resolve(); };
                ws.onerror = () => { sttOk = false; reject(); };
                setTimeout(() => { ws.close(); reject(); }, TIMEOUTS.REMOTE_TEST);
            });
        } catch (e) {
            sttOk = false;
        }

        return { sttOk, llmOk };
    }
}
