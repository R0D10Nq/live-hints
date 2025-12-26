/**
 * Unit тесты для AudioManager
 */

// Мок WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    this.sentMessages = [];

    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) this.onopen();
    }, 10);
  }

  send(data) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose({ code: 1000 });
  }

  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data: typeof data === 'string' ? data : JSON.stringify(data) });
    }
  }

  simulateError(error) {
    if (this.onerror) this.onerror(error);
  }
}

global.WebSocket = MockWebSocket;

// Константы
const SERVERS = { STT: 'ws://localhost:8765' };

// Мок приложения
const mockApp = {
  debugMode: false,
  isRunning: true,
  isPaused: false,
  autoHintsEnabled: false,
  ui: {
    addTranscriptItem: jest.fn(),
    showError: jest.fn(),
    showToast: jest.fn(),
    updateMetricsPanel: jest.fn(),
  },
  hints: {
    requestHint: jest.fn(),
    metrics: { stt_latency_ms: null },
  },
};

// AudioManager класс (упрощённая версия)
class AudioManager {
  constructor(app) {
    this.app = app;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.dualAudioEnabled = false;
  }

  async connectToSTT() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(SERVERS.STT);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onerror = (error) => {
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = (event) => {
          if (this.app.isRunning && event.code !== 1000) {
            this.attemptReconnect();
          }
        };

        this.ws.onmessage = (event) => {
          this.handleSTTMessage(event.data);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  handleSTTMessage(data) {
    try {
      const message = JSON.parse(data);

      if (message.type === 'transcript' && message.text) {
        const source = message.source || 'interviewer';
        this.app.ui.addTranscriptItem(message.text, new Date().toISOString(), source);

        if (message.latency_ms) {
          this.app.hints.metrics.stt_latency_ms = message.latency_ms;
        }

        if (this.app.autoHintsEnabled && !this.app.isPaused) {
          this.app.hints.requestHint(message.text);
        }
      }
    } catch (error) {
      console.error('[STT] Ошибка парсинга:', error);
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.app.ui.showError('Не удалось подключиться к STT серверу');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      if (this.app.isRunning) {
        this.connectToSTT().catch(() => {});
      }
    }, delay);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }

  sendAudio(audioData) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(audioData);
      return true;
    }
    return false;
  }

  isConnected() {
    return this.ws && this.ws.readyState === 1;
  }

  setDualAudio(enabled) {
    this.dualAudioEnabled = enabled;
  }
}

describe('AudioManager', () => {
  let audioManager;

  beforeEach(() => {
    audioManager = new AudioManager(mockApp);
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    audioManager.disconnect();
    jest.useRealTimers();
  });

  describe('конструктор', () => {
    test('должен инициализировать ws как null', () => {
      expect(audioManager.ws).toBeNull();
    });

    test('должен инициализировать reconnectAttempts как 0', () => {
      expect(audioManager.reconnectAttempts).toBe(0);
    });

    test('должен инициализировать dualAudioEnabled как false', () => {
      expect(audioManager.dualAudioEnabled).toBe(false);
    });
  });

  describe('connectToSTT', () => {
    test('должен создавать WebSocket соединение', async () => {
      const connectPromise = audioManager.connectToSTT();
      jest.advanceTimersByTime(20);
      await connectPromise;

      expect(audioManager.ws).toBeTruthy();
      expect(audioManager.ws.url).toBe(SERVERS.STT);
    });

    test('должен сбрасывать reconnectAttempts при успешном подключении', async () => {
      audioManager.reconnectAttempts = 3;
      const connectPromise = audioManager.connectToSTT();
      jest.advanceTimersByTime(20);
      await connectPromise;

      expect(audioManager.reconnectAttempts).toBe(0);
    });
  });

  describe('handleSTTMessage', () => {
    test('должен обрабатывать transcript сообщения', () => {
      audioManager.handleSTTMessage(
        JSON.stringify({
          type: 'transcript',
          text: 'Тестовый текст',
        })
      );

      expect(mockApp.ui.addTranscriptItem).toHaveBeenCalledWith(
        'Тестовый текст',
        expect.any(String),
        'interviewer'
      );
    });

    test('должен использовать source из сообщения', () => {
      audioManager.handleSTTMessage(
        JSON.stringify({
          type: 'transcript',
          text: 'Текст',
          source: 'candidate',
        })
      );

      expect(mockApp.ui.addTranscriptItem).toHaveBeenCalledWith(
        'Текст',
        expect.any(String),
        'candidate'
      );
    });

    test('должен сохранять latency_ms в метриках', () => {
      audioManager.handleSTTMessage(
        JSON.stringify({
          type: 'transcript',
          text: 'Текст',
          latency_ms: 150,
        })
      );

      expect(mockApp.hints.metrics.stt_latency_ms).toBe(150);
    });

    test('должен вызывать requestHint если autoHints включён', () => {
      mockApp.autoHintsEnabled = true;
      mockApp.isPaused = false;

      audioManager.handleSTTMessage(
        JSON.stringify({
          type: 'transcript',
          text: 'Вопрос',
        })
      );

      expect(mockApp.hints.requestHint).toHaveBeenCalledWith('Вопрос');

      mockApp.autoHintsEnabled = false;
    });

    test('не должен вызывать requestHint если на паузе', () => {
      mockApp.autoHintsEnabled = true;
      mockApp.isPaused = true;

      audioManager.handleSTTMessage(
        JSON.stringify({
          type: 'transcript',
          text: 'Вопрос',
        })
      );

      expect(mockApp.hints.requestHint).not.toHaveBeenCalled();

      mockApp.autoHintsEnabled = false;
      mockApp.isPaused = false;
    });

    test('должен игнорировать невалидный JSON', () => {
      expect(() => {
        audioManager.handleSTTMessage('invalid json');
      }).not.toThrow();
    });

    test('должен игнорировать сообщения без text', () => {
      audioManager.handleSTTMessage(
        JSON.stringify({
          type: 'transcript',
        })
      );

      expect(mockApp.ui.addTranscriptItem).not.toHaveBeenCalled();
    });

    test('должен игнорировать сообщения с неизвестным type', () => {
      audioManager.handleSTTMessage(
        JSON.stringify({
          type: 'unknown',
          text: 'Текст',
        })
      );

      expect(mockApp.ui.addTranscriptItem).not.toHaveBeenCalled();
    });
  });

  describe('attemptReconnect', () => {
    test('должен увеличивать reconnectAttempts', () => {
      audioManager.attemptReconnect();
      expect(audioManager.reconnectAttempts).toBe(1);
    });

    test('должен показывать ошибку после maxReconnectAttempts', () => {
      audioManager.reconnectAttempts = 5;
      audioManager.attemptReconnect();

      expect(mockApp.ui.showError).toHaveBeenCalledWith('Не удалось подключиться к STT серверу');
    });

    test('должен использовать exponential backoff', () => {
      const spy = jest.spyOn(audioManager, 'connectToSTT').mockResolvedValue();

      audioManager.attemptReconnect();
      jest.advanceTimersByTime(1000);

      audioManager.attemptReconnect();
      jest.advanceTimersByTime(2000);

      expect(spy).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    });
  });

  describe('disconnect', () => {
    test('должен закрывать WebSocket', async () => {
      const connectPromise = audioManager.connectToSTT();
      jest.advanceTimersByTime(20);
      await connectPromise;

      const ws = audioManager.ws;
      audioManager.disconnect();

      expect(ws.readyState).toBe(3);
      expect(audioManager.ws).toBeNull();
    });

    test('должен сбрасывать reconnectAttempts', () => {
      audioManager.reconnectAttempts = 3;
      audioManager.disconnect();
      expect(audioManager.reconnectAttempts).toBe(0);
    });

    test('не должен падать если ws null', () => {
      expect(() => {
        audioManager.disconnect();
      }).not.toThrow();
    });
  });

  describe('sendAudio', () => {
    test('должен отправлять данные через WebSocket', async () => {
      const connectPromise = audioManager.connectToSTT();
      jest.advanceTimersByTime(20);
      await connectPromise;

      const audioData = new ArrayBuffer(100);
      const result = audioManager.sendAudio(audioData);

      expect(result).toBe(true);
      expect(audioManager.ws.sentMessages).toContain(audioData);
    });

    test('должен возвращать false если не подключен', () => {
      const result = audioManager.sendAudio(new ArrayBuffer(100));
      expect(result).toBe(false);
    });
  });

  describe('isConnected', () => {
    test('должен возвращать false если ws null', () => {
      expect(audioManager.isConnected()).toBe(false);
    });

    test('должен возвращать true если подключен', async () => {
      const connectPromise = audioManager.connectToSTT();
      jest.advanceTimersByTime(20);
      await connectPromise;

      expect(audioManager.isConnected()).toBe(true);
    });
  });

  describe('setDualAudio', () => {
    test('должен устанавливать dualAudioEnabled', () => {
      audioManager.setDualAudio(true);
      expect(audioManager.dualAudioEnabled).toBe(true);

      audioManager.setDualAudio(false);
      expect(audioManager.dualAudioEnabled).toBe(false);
    });
  });
});
