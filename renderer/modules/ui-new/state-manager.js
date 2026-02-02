/**
 * State Manager
 * Centralized UI state management for Live Hints
 */

import { animations } from './animation-engine.js';

export class StateManager {
  constructor() {
    this.state = {
      session: {
        isActive: false,
        isPaused: false,
        startTime: null,
        transcriptCount: 0,
        hintCount: 0
      },
      ui: {
        sidebarOpen: true,
        settingsOpen: false,
        currentHintIndex: 0,
        hints: [],
        transcripts: [],
        status: 'idle'
      },
      settings: {
        provider: 'ollama',
        profile: 'job_interview_ru',
        autoHints: false,
        dualAudio: false,
        alwaysOnTop: true,
        compactMode: false,
        theme: 'dark',
        opacity: 100
      }
    };

    this.listeners = new Map();
  }

  /**
   * Get state value by path
   */
  get(path) {
    const keys = path.split('.');
    let value = this.state;
    for (const key of keys) {
      if (value === undefined) return undefined;
      value = value[key];
    }
    return value;
  }

  /**
   * Set state value by path
   */
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = this.state;

    for (const key of keys) {
      if (!(key in target)) {
        target[key] = {};
      }
      target = target[key];
    }

    const oldValue = target[lastKey];
    target[lastKey] = value;

    this._notify(path, value, oldValue);
    return this;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(path, callback) {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, new Set());
    }
    this.listeners.get(path).add(callback);

    return () => this.unsubscribe(path, callback);
  }

  /**
   * Unsubscribe from state changes
   */
  unsubscribe(path, callback) {
    const callbacks = this.listeners.get(path);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  /**
   * Notify listeners of state change
   */
  _notify(path, newValue, oldValue) {
    const callbacks = this.listeners.get(path);
    if (callbacks) {
      callbacks.forEach(cb => cb(newValue, oldValue, path));
    }

    // Notify parent path listeners
    const parentPath = path.split('.').slice(0, -1).join('.');
    if (parentPath) {
      this._notify(parentPath, this.get(parentPath), null);
    }
  }

  /**
   * Session actions
   */
  startSession() {
    this.set('session.isActive', true);
    this.set('session.startTime', Date.now());
    this.set('ui.status', 'recording');
  }

  stopSession() {
    this.set('session.isActive', false);
    this.set('session.isPaused', false);
    this.set('ui.status', 'idle');
  }

  pauseSession() {
    this.set('session.isPaused', true);
    this.set('ui.status', 'paused');
  }

  resumeSession() {
    this.set('session.isPaused', false);
    this.set('ui.status', 'recording');
  }

  /**
   * Hint actions
   */
  addHint(hint) {
    const hints = [...this.get('ui.hints'), hint];
    this.set('ui.hints', hints);
    this.set('session.hintCount', hints.length);
    this.set('ui.currentHintIndex', hints.length - 1);
  }

  clearHints() {
    this.set('ui.hints', []);
    this.set('ui.currentHintIndex', 0);
    this.set('session.hintCount', 0);
  }

  setCurrentHint(index) {
    const hints = this.get('ui.hints');
    if (index >= 0 && index < hints.length) {
      this.set('ui.currentHintIndex', index);
    }
  }

  nextHint() {
    const current = this.get('ui.currentHintIndex');
    const total = this.get('ui.hints').length;
    if (current < total - 1) {
      this.set('ui.currentHintIndex', current + 1);
    }
  }

  prevHint() {
    const current = this.get('ui.currentHintIndex');
    if (current > 0) {
      this.set('ui.currentHintIndex', current - 1);
    }
  }

  /**
   * Transcript actions
   */
  addTranscript(text) {
    const transcripts = [...this.get('ui.transcripts'), {
      text,
      timestamp: Date.now(),
      id: `t_${Date.now()}`
    }];
    this.set('ui.transcripts', transcripts);
    this.set('session.transcriptCount', transcripts.length);
  }

  clearTranscripts() {
    this.set('ui.transcripts', []);
    this.set('session.transcriptCount', 0);
  }

  /**
   * UI actions
   */
  toggleSidebar() {
    const isOpen = this.get('ui.sidebarOpen');
    this.set('ui.sidebarOpen', !isOpen);
    return !isOpen;
  }

  openSettings() {
    this.set('ui.settingsOpen', true);
  }

  closeSettings() {
    this.set('ui.settingsOpen', false);
  }

  setStatus(status) {
    this.set('ui.status', status);
  }

  /**
   * Settings actions
   */
  updateSetting(key, value) {
    this.set(`settings.${key}`, value);
    // Persist to electron store
    if (window.electron) {
      window.electron.send('settings:set', key, value);
    }
  }

  /**
   * Get current hint
   */
  getCurrentHint() {
    const hints = this.get('ui.hints');
    const index = this.get('ui.currentHintIndex');
    return hints[index] || null;
  }

  /**
   * Reset all state
   */
  reset() {
    this.state = {
      session: {
        isActive: false,
        isPaused: false,
        startTime: null,
        transcriptCount: 0,
        hintCount: 0
      },
      ui: {
        sidebarOpen: true,
        settingsOpen: false,
        currentHintIndex: 0,
        hints: [],
        transcripts: [],
        status: 'idle'
      },
      settings: { ...this.state.settings }
    };
    this.listeners.clear();
  }
}

export const state = new StateManager();
