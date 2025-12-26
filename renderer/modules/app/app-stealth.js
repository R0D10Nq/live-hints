/**
 * App Stealth - Stealth режим
 */

export class AppStealth {
  constructor(app) {
    this.app = app;
    this.stealthMode = true;
  }

  setup() {
    const stealthToggle = document.getElementById('stealth-toggle');
    const stealthStrategy = document.getElementById('stealth-strategy');

    this.loadStatus();

    if (stealthToggle) {
      stealthToggle.addEventListener('change', async () => {
        const result = await window.electronAPI?.stealthToggle();
        this.updateUI(result);
      });
    }

    if (stealthStrategy) {
      stealthStrategy.addEventListener('change', async (e) => {
        await window.electronAPI?.stealthSetStrategy(e.target.value);
        this.app.saveSettings({ stealthStrategy: e.target.value });
        this.app.ui.showToast(`Stealth стратегия: ${e.target.value}`, 'success');
      });
    }

    window.electronAPI?.onStealthActivated(() => {
      this.updateUI(true);
      if (stealthToggle) stealthToggle.checked = true;
    });

    window.electronAPI?.onStealthDeactivated(() => {
      this.updateUI(false);
      if (stealthToggle) stealthToggle.checked = false;
    });
  }

  async loadStatus() {
    try {
      const status = await window.electronAPI?.stealthGetStrategy();
      if (status) {
        const stealthToggle = document.getElementById('stealth-toggle');
        const stealthStrategy = document.getElementById('stealth-strategy');

        if (stealthToggle) stealthToggle.checked = status.active;
        if (stealthStrategy) stealthStrategy.value = status.strategy;
        this.updateUI(status.active);
      }

      const hasSecondMonitor = await window.electronAPI?.stealthHasSecondMonitor();
      const secondMonitorOption = document.querySelector(
        '#stealth-strategy option[value="second-monitor"]'
      );
      if (secondMonitorOption && !hasSecondMonitor) {
        secondMonitorOption.textContent = 'Второй монитор (недоступен)';
        secondMonitorOption.disabled = true;
      }
    } catch (e) {
      console.error('Ошибка загрузки stealth статуса:', e);
    }
  }

  updateUI(isActive) {
    this.stealthMode = isActive;
    const indicator = document.getElementById('stealth-indicator');
    const statusText = document.getElementById('stealth-status-text');

    if (indicator) {
      indicator.classList.toggle('active', isActive);
      indicator.classList.toggle('inactive', !isActive);
    }
    if (statusText) {
      statusText.textContent = isActive ? 'АКТИВЕН' : 'Выключен';
    }

    if (isActive) {
      this.app.ui.showToast('Stealth режим активирован', 'warning');
    }
  }

  async toggle() {
    if (window.electronAPI?.stealthToggle) {
      this.stealthMode = await window.electronAPI.stealthToggle();
      if (this.stealthMode) {
        this.app.ui.showToast('Stealth режим активирован', 'success');
      }
    }
  }
}
