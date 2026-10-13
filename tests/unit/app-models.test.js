/**
 * @jest-environment jsdom
 *
 * Unit-тесты для модуля AppModels
 */

import { AppModels } from '../../renderer/modules/app/app-models.js';
import { state } from '../../renderer/modules/ui-new/state-manager.js';

describe('AppModels', () => {
  let appMock;
  let models;

  beforeEach(() => {
    document.body.innerHTML = `
      <select id="ollama-model"></select>
      <button id="btn-refresh-models" type="button"></button>
      <small id="ollama-model-help"></small>
    `;

    appMock = {
      hints: { currentModel: 'qwen3:8b' },
      ui: { showToast: jest.fn() },
    };

    state.applySetting('model', 'qwen3:8b');
    global.fetch = jest.fn();
    window.electron = {
      startLLM: jest.fn().mockResolvedValue({ success: true }),
      settingsSet: jest.fn().mockResolvedValue(true),
    };

    models = new AppModels(appMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('должен загружать установленные модели из LLM сервера', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          { name: 'qwen3:8b', size: '5.2 GB' },
          { name: 'gemma3:4b', size: '3.3 GB' },
        ],
        current: 'qwen3:8b',
      }),
    });

    await models.loadModels({ ensureServer: true });

    const select = document.getElementById('ollama-model');
    expect(window.electron.startLLM).toHaveBeenCalled();
    expect(select.options).toHaveLength(2);
    expect(select.options[0].value).toBe('qwen3:8b');
    expect(select.options[0].textContent).toBe('qwen3:8b (5.2 GB)');
    expect(select.value).toBe('qwen3:8b');
    expect(document.getElementById('ollama-model-help').textContent).toContain('2');
  });

  test('должен показывать рекомендуемые пресеты если в Ollama нет моделей', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [],
        current: 'qwen3:8b',
      }),
    });

    await models.loadModels({ silent: true });

    const select = document.getElementById('ollama-model');
    expect(select.options.length).toBeGreaterThanOrEqual(4);
    expect(select.value).toBe('qwen3:8b');
    expect(document.getElementById('ollama-model-help').textContent).toContain('ollama pull');
  });

  test('должен сохранять выбранную модель в настройках и переключать на сервере', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', model: 'gemma3:4b' }),
    });

    await models.setModel('gemma3:4b');

    expect(state.get('settings.model')).toBe('gemma3:4b');
    expect(window.electron.settingsSet).toHaveBeenCalledWith('model', 'gemma3:4b');
    expect(appMock.ui.showToast).toHaveBeenCalledWith('Модель: gemma3:4b', 'success');
  });
});
