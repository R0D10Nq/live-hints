/**
 * App Vision - Vision AI функциональность (скриншоты)
 */

import { SERVERS } from '../constants.js';

export class AppVision {
  constructor(app) {
    this.app = app;
  }

  setup() {
    const btnScreenshot = document.getElementById('btn-screenshot');

    if (btnScreenshot) {
      btnScreenshot.addEventListener('click', () => {
        console.log('[Vision] Клик по btn-screenshot');
        this.captureAndAnalyze();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        this.captureAndAnalyze();
      }
    });
  }

  async captureAndAnalyze() {
    try {
      this.app.ui.showToast('Отправка скриншота...', 'info');

      if (!window.electronAPI?.captureScreen) {
        this.app.ui.showToast('API захвата экрана недоступен', 'error');
        return;
      }

      const imageData = await window.electronAPI.captureScreen();
      console.log('[Vision] Захват:', imageData ? `${imageData.length} символов` : 'null');

      if (!imageData) {
        this.app.ui.showToast('Ошибка захвата экрана', 'error');
        return;
      }

      const resp = await fetch(`${SERVERS.LLM}/vision/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageData,
          prompt:
            'Проанализируй скриншот. Если на нём код или задача - реши её и дай готовый ответ. Если это интерфейс - опиши что видишь.',
        }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const data = await resp.json();
      console.log('[Vision] Ответ:', data);

      if (data.analysis) {
        this.app.ui.addHintItem(`[Vision AI] ${data.analysis}`, new Date().toLocaleTimeString());
        this.app.ui.showToast('Скриншот отправлен', 'success');
      } else if (data.error) {
        console.error('[Vision] Ошибка:', data.error);
        this.app.ui.showToast(`Vision: ${data.error}`, 'error');
      } else {
        this.app.ui.showToast('Vision AI не вернул результат', 'error');
      }
    } catch (e) {
      console.error('[Vision] Ошибка:', e);
      this.app.ui.showToast(`Vision ошибка: ${e.message}`, 'error');
    }
  }
}
