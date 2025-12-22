/**
 * STT Client - WebSocket клиент для STT сервера
 */

class STTClient {
    constructor(options = {}) {
        this.url = options.url || 'ws://localhost:8765';
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.reconnectDelay = 1000;

        // Callbacks
        this.onTranscript = options.onTranscript || (() => { });
        this.onError = options.onError || (() => { });
        this.onConnect = options.onConnect || (() => { });
        this.onDisconnect = options.onDisconnect || (() => { });
    }

    async connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);

                this.ws.onopen = () => {
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.onConnect();
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    this._handleMessage(event.data);
                };

                this.ws.onerror = (error) => {
                    this.onError(error);
                    reject(error);
                };

                this.ws.onclose = () => {
                    this.isConnected = false;
                    this.onDisconnect();
                    this._attemptReconnect();
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    disconnect() {
        this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnect
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }

    sendAudio(audioData) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(audioData);
        }
    }

    clearBuffer() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ command: 'clear' }));
        }
    }

    _handleMessage(data) {
        try {
            const message = JSON.parse(data);
            if (message.text) {
                this.onTranscript({
                    text: message.text,
                    timestamp: message.timestamp || new Date().toISOString(),
                    latencyMs: message.latency_ms
                });
            }
        } catch (error) {
            // Ignore parse errors for binary data
        }
    }

    _attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            return;
        }

        this.reconnectAttempts++;
        setTimeout(() => {
            this.connect().catch(() => { });
        }, this.reconnectDelay * this.reconnectAttempts);
    }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { STTClient };
}
