/**
 * App Models - управление моделями Ollama
 */

import { SERVERS, PROFILES } from '../constants.js';
import { state } from '../ui-new/state-manager.js';
import { logger } from '../utils/logger.js';

const PRESET_MODELS = [
  { name: 'qwen3:8b', label: 'qwen3:8b (рекомендуется)' },
  { name: 'qwen2.5:7b', label: 'qwen2.5:7b (быстрая)' },
  { name: 'gemma3:4b', label: 'gemma3:4b (компактная)' },
  { name: 'qwen2.5-coder:7b', label: 'qwen2.5-coder:7b (код)' },
];

export class AppModels {
  constructor(app) {
    this.app = app;
  }

  setup() {
    const modelSelect = document.getElementById('ollama-model');
    const refreshBtn = document.getElementById('btn-refresh-models');
    const profileBtns = document.querySelectorAll('.profile-btn');

    void this.loadModels({ silent: true });

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        void this.loadModels({ ensureServer: true });
      });
    }

    if (modelSelect) {
      modelSelect.addEventListener('change', (e) => {
        void this.setModel(e.target.value);
      });
    }

    profileBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const profile = btn.dataset.profile;
        void this.setProfile(profile);
        profileBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const profile = PROFILES[parseInt(e.key, 10) - 1];
        void this.setProfile(profile);
        profileBtns.forEach((b) => {
          b.classList.toggle('active', b.dataset.profile === profile);
        });
      }
    });
  }

  renderPresetOptions(modelSelect, selectedModel) {
    const current = selectedModel || state.get('settings.model') || 'qwen3:8b';
    modelSelect.replaceChildren();
    let matched = false;
    PRESET_MODELS.forEach((preset) => {
      const option = document.createElement('option');
      option.value = preset.name;
      option.textContent = preset.label;
      if (preset.name === current) {
        option.selected = true;
        matched = true;
      }
      modelSelect.appendChild(option);
    });
    if (!matched && current) {
      const customOption = document.createElement('option');
      customOption.value = current;
      customOption.textContent = current;
      customOption.selected = true;
      modelSelect.prepend(customOption);
    }
  }

  async loadModels(options = {}) {
    const { ensureServer = false, silent = false } = options;
    const modelSelect = document.getElementById('ollama-model');
    const helpEl = document.getElementById('ollama-model-help');
    if (!modelSelect) return;

    try {
      if (ensureServer && window.electron?.startLLM) {
        await window.electron.startLLM();
      }
      const resp = await fetch(`${SERVERS.LLM}/models`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const savedModel = state.get('settings.model') || data.current || 'qwen3:8b';

      if (Array.isArray(data.models) && data.models.length > 0) {
        modelSelect.replaceChildren();
        let hasSaved = false;
        data.models.forEach((model) => {
          const name = typeof model === 'string' ? model : model?.name;
          if (!name) return;
          const option = document.createElement('option');
          option.value = String(name);
          const sizeSuffix = typeof model === 'object' && model.size ? ` (${model.size})` : '';
          option.textContent = `${name}${sizeSuffix}`;
          if (name === savedModel || (!hasSaved && name === data.current)) {
            option.selected = true;
            if (name === savedModel) hasSaved = true;
          }
          modelSelect.appendChild(option);
        });
        const activeModel = modelSelect.value || data.current || savedModel;
        if (this.app?.hints) {
          this.app.hints.currentModel = activeModel;
        }
        if (helpEl) {
          helpEl.textContent = `Установлено моделей в Ollama: ${data.models.length}`;
        }
        if (!silent && ensureServer) {
          this.app?.ui?.showToast(`Список моделей обновлен (${data.models.length})`, 'success');
        }
      } else {
        this.renderPresetOptions(modelSelect, savedModel);
        if (helpEl) {
          helpEl.textContent = `В Ollama пока нет моделей. Выполните: ollama pull ${savedModel}`;
        }
        if (!silent && ensureServer) {
          this.app?.ui?.showToast(`В Ollama нет загруженных моделей`, 'warning');
        }
      }
    } catch (e) {
      this.renderPresetOptions(modelSelect, state.get('settings.model'));
      if (!silent) {
        logger.error('AppModels', 'Ошибка загрузки моделей:', e);
      }
    }
  }

  async setModel(modelName) {
    if (!modelName) return;
    state.updateSetting('model', modelName);
    if (this.app?.hints) {
      this.app.hints.currentModel = modelName;
    }
    try {
      const resp = await fetch(`${SERVERS.LLM}/model/${encodeURIComponent(modelName)}`, {
        method: 'POST',
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      this.app?.ui?.showToast(`Модель: ${modelName}`, 'success');
    } catch {
      this.app?.ui?.showToast(`Модель сохранена: ${modelName}`, 'info');
    }
  }

  async setProfile(profileName) {
    try {
      await fetch(`${SERVERS.LLM}/model/profile/${profileName}`, { method: 'POST' });
      this.app?.ui?.showToast(`Профиль: ${profileName}`, 'success');
      await this.loadModels({ silent: true });
    } catch {
      this.app?.ui?.showToast('Ошибка смены профиля', 'error');
    }
  }
}
