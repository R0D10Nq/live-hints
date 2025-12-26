/**
 * Unit тесты для HintPipeline
 */

const { HintPipeline, PipelineState, PipelineEvents } = require('../../src/pipeline/hint-pipeline');

// Мок WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    this.sentMessages = [];

    // Автоматически "подключаемся" через 10мс
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    }, 10);
  }

  send(data) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose();
  }

  // Хелпер для симуляции получения сообщения
  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data: typeof data === 'string' ? data : JSON.stringify(data) });
    }
  }

  // Хелпер для симуляции ошибки
  simulateError(error) {
    if (this.onerror) this.onerror(error);
  }
}

// Подменяем глобальный WebSocket
global.WebSocket = MockWebSocket;

// Мок fetch
global.fetch = jest.fn();

describe('HintPipeline', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = new HintPipeline({
      sttUrl: 'ws://localhost:8765',
      llmUrl: 'http://localhost:8766',
      hintDebounceMs: 100, // Уменьшаем для тестов
    });

    global.fetch.mockReset();
  });

  afterEach(async () => {
    await pipeline.stop();
  });

  describe('инициализация', () => {
    test('должен создаваться с дефолтными опциями', () => {
      const p = new HintPipeline();
      expect(p.options.sttUrl).toBe('ws://localhost:8765');
      expect(p.options.llmUrl).toBe('http://localhost:8766');
      expect(p.options.llmProvider).toBe('ollama');
    });

    test('должен принимать кастомные опции', () => {
      const p = new HintPipeline({
        sttUrl: 'ws://custom:1234',
        llmProvider: 'openai',
      });
      expect(p.options.sttUrl).toBe('ws://custom:1234');
      expect(p.options.llmProvider).toBe('openai');
    });

    test('начальное состояние должно быть IDLE', () => {
      expect(pipeline.getState()).toBe(PipelineState.IDLE);
    });
  });

  describe('setState', () => {
    test('должен изменять состояние', () => {
      pipeline.setState(PipelineState.RUNNING);
      expect(pipeline.getState()).toBe(PipelineState.RUNNING);
    });

    test('должен эмитить событие STATE_CHANGE', (done) => {
      const handler = (data) => {
        if (data.newState === PipelineState.RUNNING) {
          expect(data.oldState).toBe(PipelineState.IDLE);
          expect(data.newState).toBe(PipelineState.RUNNING);
          pipeline.removeListener(PipelineEvents.STATE_CHANGE, handler);
          done();
        }
      };
      pipeline.on(PipelineEvents.STATE_CHANGE, handler);

      pipeline.setState(PipelineState.RUNNING);
    });
  });

  describe('start', () => {
    test('должен переходить в состояние RUNNING', async () => {
      await pipeline.start();
      expect(pipeline.getState()).toBe(PipelineState.RUNNING);
    });

    test('не должен повторно запускаться если уже запущен', async () => {
      await pipeline.start();
      const ws = pipeline.wsConnection;

      await pipeline.start();
      expect(pipeline.wsConnection).toBe(ws);
    });

    test('должен эмитить STATE_CHANGE события', async () => {
      const states = [];
      pipeline.on(PipelineEvents.STATE_CHANGE, (data) => {
        states.push(data.newState);
      });

      await pipeline.start();

      expect(states).toContain(PipelineState.STARTING);
      expect(states).toContain(PipelineState.RUNNING);
    });
  });

  describe('stop', () => {
    test('должен переходить в состояние IDLE', async () => {
      await pipeline.start();
      await pipeline.stop();
      expect(pipeline.getState()).toBe(PipelineState.IDLE);
    });

    test('должен закрывать WebSocket', async () => {
      await pipeline.start();
      const ws = pipeline.wsConnection;

      await pipeline.stop();

      expect(ws.readyState).toBe(3); // CLOSED
      expect(pipeline.wsConnection).toBeNull();
    });

    test('должен очищать буфер', async () => {
      await pipeline.start();
      pipeline.transcriptBuffer = ['text1', 'text2'];

      await pipeline.stop();

      expect(pipeline.transcriptBuffer).toEqual([]);
    });

    test('не должен ничего делать если уже IDLE', async () => {
      const states = [];
      pipeline.on(PipelineEvents.STATE_CHANGE, (data) => {
        states.push(data.newState);
      });

      await pipeline.stop();

      expect(states.length).toBe(0);
    });
  });

  describe('handleSTTMessage', () => {
    test('должен эмитить событие TRANSCRIPT', async () => {
      await pipeline.start();

      const transcriptPromise = new Promise((resolve) => {
        pipeline.on(PipelineEvents.TRANSCRIPT, resolve);
      });

      pipeline.handleSTTMessage(
        JSON.stringify({
          type: 'transcript',
          text: 'Тестовый текст',
        })
      );

      const transcript = await transcriptPromise;
      expect(transcript.text).toBe('Тестовый текст');
    });

    test('должен добавлять текст в буфер', async () => {
      await pipeline.start();

      pipeline.handleSTTMessage(
        JSON.stringify({
          type: 'transcript',
          text: 'Текст 1',
        })
      );

      pipeline.handleSTTMessage(
        JSON.stringify({
          type: 'transcript',
          text: 'Текст 2',
        })
      );

      expect(pipeline.transcriptBuffer).toEqual(['Текст 1', 'Текст 2']);
    });

    test('должен игнорировать невалидные сообщения', async () => {
      await pipeline.start();

      // Не должен падать
      pipeline.handleSTTMessage('invalid json');
      pipeline.handleSTTMessage(JSON.stringify({ type: 'other' }));
      pipeline.handleSTTMessage(JSON.stringify({ type: 'transcript' })); // без text

      expect(pipeline.transcriptBuffer).toEqual([]);
    });
  });

  describe('sendAudio', () => {
    test('должен отправлять данные через WebSocket', async () => {
      await pipeline.start();

      const audioData = new ArrayBuffer(100);
      pipeline.sendAudio(audioData);

      expect(pipeline.wsConnection.sentMessages).toContain(audioData);
    });

    test('не должен падать если WebSocket не открыт', () => {
      // Не вызываем start()
      expect(() => {
        pipeline.sendAudio(new ArrayBuffer(100));
      }).not.toThrow();
    });
  });

  describe('generateHint', () => {
    test('должен вызывать LLM API', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hint: 'Тестовая подсказка', provider: 'ollama' }),
      });

      await pipeline.start();
      pipeline.transcriptBuffer = ['Достаточно длинный текст для генерации подсказки'];

      await pipeline.generateHint();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8766/hint',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    test('должен эмитить событие HINT', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ hint: 'Подсказка', provider: 'ollama' }),
      });

      await pipeline.start();
      pipeline.transcriptBuffer = ['Достаточно длинный текст'];

      const hintPromise = new Promise((resolve) => {
        pipeline.on(PipelineEvents.HINT, resolve);
      });

      await pipeline.generateHint();

      const hint = await hintPromise;
      expect(hint.text).toBe('Подсказка');
    });

    test('не должен генерировать если текст слишком короткий', async () => {
      await pipeline.start();
      pipeline.transcriptBuffer = ['a'];

      await pipeline.generateHint();

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('setProvider', () => {
    test('должен менять провайдера', () => {
      pipeline.setProvider('openai');
      expect(pipeline.options.llmProvider).toBe('openai');
    });
  });

  describe('clearBuffer', () => {
    test('должен очищать буфер транскриптов', async () => {
      await pipeline.start();
      pipeline.transcriptBuffer = ['text1', 'text2'];

      pipeline.clearBuffer();

      expect(pipeline.transcriptBuffer).toEqual([]);
    });

    test('должен отправлять команду clear в STT', async () => {
      await pipeline.start();

      pipeline.clearBuffer();

      const sentCommands = pipeline.wsConnection.sentMessages
        .filter((m) => typeof m === 'string')
        .map((m) => JSON.parse(m));

      expect(sentCommands).toContainEqual({ command: 'clear' });
    });
  });

  describe('getStats', () => {
    test('должен возвращать статистику', async () => {
      await pipeline.start();
      pipeline.transcriptBuffer = ['a', 'b', 'c'];

      const stats = pipeline.getStats();

      expect(stats.state).toBe(PipelineState.RUNNING);
      expect(stats.transcriptCount).toBe(3);
      expect(stats.provider).toBe('ollama');
    });
  });
});

describe('PipelineState', () => {
  test('должен содержать все состояния', () => {
    expect(PipelineState.IDLE).toBe('idle');
    expect(PipelineState.STARTING).toBe('starting');
    expect(PipelineState.RUNNING).toBe('running');
    expect(PipelineState.STOPPING).toBe('stopping');
    expect(PipelineState.ERROR).toBe('error');
  });
});

describe('PipelineEvents', () => {
  test('должен содержать все события', () => {
    expect(PipelineEvents.STATE_CHANGE).toBe('stateChange');
    expect(PipelineEvents.TRANSCRIPT).toBe('transcript');
    expect(PipelineEvents.HINT).toBe('hint');
    expect(PipelineEvents.ERROR).toBe('error');
  });
});

describe('HintPipeline ошибки', () => {
  let pipeline;

  beforeEach(() => {
    global.WebSocket = MockWebSocket;
    pipeline = new HintPipeline({
      sttUrl: 'ws://localhost:8765',
      llmUrl: 'http://localhost:8766',
      hintDebounceMs: 10,
    });
    global.fetch.mockReset();
  });

  afterEach(async () => {
    global.WebSocket = MockWebSocket;
    if (pipeline.wsConnection) {
      pipeline.wsConnection = null;
    }
    pipeline.state = PipelineState.IDLE;
  });

  test('должен обрабатывать ошибку fetch при генерации подсказки', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    await pipeline.start();
    pipeline.transcriptBuffer = ['Достаточно длинный текст для генерации'];
    pipeline.lastHintTime = 0;

    await pipeline.generateHint();
  });

  test('не должен генерировать подсказку если прошло мало времени', async () => {
    await pipeline.start();
    pipeline.transcriptBuffer = ['Достаточно длинный текст'];
    pipeline.lastHintTime = Date.now();

    await pipeline.generateHint();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('должен обрабатывать onmessage с транскриптом', async () => {
    await pipeline.start();

    const transcriptPromise = new Promise((resolve) => {
      pipeline.on(PipelineEvents.TRANSCRIPT, resolve);
    });

    pipeline.wsConnection.simulateMessage({ type: 'transcript', text: 'Привет' });

    const transcript = await transcriptPromise;
    expect(transcript.text).toBe('Привет');
  });

  test('должен эмитить ERROR при закрытии WebSocket в состоянии RUNNING', async () => {
    await pipeline.start();
    expect(pipeline.state).toBe(PipelineState.RUNNING);

    const errorPromise = new Promise((resolve) => {
      pipeline.on(PipelineEvents.ERROR, resolve);
    });

    pipeline.wsConnection.close();

    const error = await errorPromise;
    expect(error.code).toBe('WS_CLOSED');
    expect(pipeline.state).toBe(PipelineState.ERROR);
  });

  test('не должен генерировать если текст короткий', async () => {
    await pipeline.start();
    pipeline.transcriptBuffer = ['Ко'];
    pipeline.lastHintTime = 0;

    await pipeline.generateHint();

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
