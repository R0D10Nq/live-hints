/**
 * Settings Manager - управление настройками приложения
 */

const DEFAULT_SETTINGS = {
  llmProvider: 'ollama',
  aiProfile: 'job_interview_ru',
  customInstructions: '',
  autoHints: false,
  opacity: 100,
  fontTranscript: 13,
  fontHints: 13,
  contextWindowSize: 20,
  maxContextChars: 6000,
  maxTokens: 500,
  temperature: 0.8,
  debugMode: false,
};

class SettingsManager {
  constructor(storageKey = 'live-hints-settings') {
    this.storageKey = storageKey;
    this.settings = { ...DEFAULT_SETTINGS };
    this.listeners = [];
    this.load();
  }

  load() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (error) {
      console.warn('[Settings] Ошибка загрузки:', error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
    return this.settings;
  }

  save(updates = {}) {
    this.settings = { ...this.settings, ...updates };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
      this._notifyListeners(updates);
    } catch (error) {
      console.error('[Settings] Ошибка сохранения:', error);
    }
    return this.settings;
  }

  get(key) {
    return this.settings[key];
  }

  getAll() {
    return { ...this.settings };
  }

  reset() {
    this.settings = { ...DEFAULT_SETTINGS };
    localStorage.removeItem(this.storageKey);
    this._notifyListeners(this.settings);
    return this.settings;
  }

  onChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  _notifyListeners(changes) {
    this.listeners.forEach((callback) => {
      try {
        callback(changes, this.settings);
      } catch (error) {
        console.error('[Settings] Ошибка в listener:', error);
      }
    });
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SettingsManager, DEFAULT_SETTINGS };
}
