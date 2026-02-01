/**
 * App Models - управление моделями Ollama
 */

import { SERVERS, PROFILES } from '../constants.js';

import { logger } from '../utils/logger.js';

export class AppModels {
  constructor(app) {
    this.app = app;
  }

  setup() {
    const modelSelect = document.getElementById('ollama-model');
    const refreshBtn = document.getElementById('btn-refresh-models');
    const profileBtns = document.querySelectorAll('.profile-btn');

    this.loadModels();

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadModels());
    }

    if (modelSelect) {
      modelSelect.addEventListener('change', (e) => {
        this.setModel(e.target.value);
      });
    }

    profileBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const profile = btn.dataset.profile;
        this.setProfile(profile);
        profileBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const profile = PROFILES[parseInt(e.key) - 1];
        this.setProfile(profile);
        profileBtns.forEach((b) => {
          b.classList.toggle('active', b.dataset.profile === profile);
        });
      }
    });
  }

  async loadModels() {
    const modelSelect = document.getElementById('ollama-model');
    if (!modelSelect) return;

    try {
      const resp = await fetch(`${SERVERS.LLM}/models`);
      const data = await resp.json();

      if (data.models && data.models.length > 0) {
        modelSelect.innerHTML = data.models
          .map((m) => {
            const name = typeof m === 'string' ? m : m.name;
            const size = typeof m === 'object' ? ` (${m.size})` : '';
            const selected = name === data.current ? 'selected' : '';
            return `<option value="${name}" ${selected}>${name}${size}</option>`;
          })
          .join('');
        if (data.current) {
          this.app.hints.currentModel = data.current;
        }
      } else {
        modelSelect.innerHTML = '<option value="">Нет моделей</option>';
      }
    } catch (e) {
      modelSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
      logger.error('AppModels', 'Ошибка загрузки моделей:', e);
    }
  }

  async setModel(modelName) {
    if (!modelName) return;
    try {
      await fetch(`${SERVERS.LLM}/model/${encodeURIComponent(modelName)}`, { method: 'POST' });
      this.app.hints.currentModel = modelName;
      this.app.ui.showToast(`Модель: ${modelName}`, 'success');
    } catch (e) {
      this.app.ui.showToast('Ошибка смены модели', 'error');
    }
  }

  async setProfile(profileName) {
    try {
      await fetch(`${SERVERS.LLM}/model/profile/${profileName}`, { method: 'POST' });
      this.app.ui.showToast(`Профиль: ${profileName}`, 'success');
      this.loadModels();
    } catch (e) {
      this.app.ui.showToast('Ошибка смены профиля', 'error');
    }
  }
}
