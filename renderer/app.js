/**
 * Live Hints - Main Application
 * Shadow Assistant Theme
 * Integrates new UI modules with existing functionality
 */

import { NewUIController } from './modules/ui-new/index.js';
import { state } from './modules/ui-new/state-manager.js';
import { SERVERS } from './modules/constants.js';

function normalizeStoredBoolean(value) {
  return value === true || value === 1 || value === 'true';
}

// Main Application Class
class LiveHintsApp {
  constructor() {
    this.ui = null;
    this.ws = null;
    this.wsMicrophone = null;
    this.reconnectAttempts = 0;
    this.microphoneReconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.sessionEpoch = 0;

    this.init();
  }

  async init() {
    console.log('[APP] Initializing Live Hints...');

    // Initialize new UI controller
    this.ui = new NewUIController(this);

    // Setup IPC listeners
    this.setupIPCListeners();

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Load initial settings
    this.loadSettings();

    // Setup particles for visual effect
    this.setupParticles();

    console.log('[APP] Initialization complete');
  }

  setupIPCListeners() {
    if (!window.electron) {
      console.warn('[APP] Electron API not available');
      return;
    }

    // Обработка событий: делегирование NewUIController для уникальной обработки без дублирования
    window.electron.onHint((data) => {
      if (!state.get('session.isActive') || state.get('session.isPaused')) return;
      state.set('ui.status', 'recording');
      state.addHint({
        text: data.text,
        timestamp: Date.now(),
        type: data.type || 'general',
        confidence: data.confidence || 'medium',
      });
    });

    window.electron.onError((data) => {
      if (!state.get('session.isActive')) return;
      console.error('[APP] Error:', data.message);
      state.set('ui.status', 'error');
      this.ui.showToast(data.message, 'error');
    });

    window.electron.onStatusChange((status) => {
      const isActive = state.get('session.isActive');
      const isPaused = state.get('session.isPaused');
      if (!isActive && status !== 'idle') return;
      if (isPaused && status === 'recording') return;
      state.set('ui.status', status);
    });
  }

  connectWebSocket() {
    if (!state.get('session.isActive') || state.get('session.isPaused')) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) return;

    try {
      this.ws = new WebSocket(SERVERS.STT);

      this.ws.onopen = () => {
        console.log('[APP] WebSocket connected');
        this.reconnectAttempts = 0;
        if (state.get('session.isActive') && !state.get('session.isPaused')) {
          state.set('ui.status', 'recording');
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (err) {
          console.error('[APP] Failed to parse WebSocket message:', err);
        }
      };

      this.ws.onclose = () => {
        console.log('[APP] WebSocket closed');
        if (state.get('session.isActive') && !state.get('session.isPaused')) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.error('[APP] WebSocket error:', err);
        if (state.get('session.isActive') && !state.get('session.isPaused')) {
          state.set('ui.status', 'error');
        }
      };

      if (state.get('settings.dualAudio')) this.connectMicrophoneWebSocket();
    } catch (err) {
      console.error('[APP] Failed to connect WebSocket:', err);
    }
  }

  connectMicrophoneWebSocket() {
    if (!state.get('session.isActive') || state.get('session.isPaused')) return;
    if (
      this.wsMicrophone?.readyState === WebSocket.OPEN ||
      this.wsMicrophone?.readyState === WebSocket.CONNECTING
    )
      return;
    try {
      this.wsMicrophone = new WebSocket(SERVERS.STT_MIC);
      this.wsMicrophone.onopen = () => {
        if (state.get('session.isActive') && !state.get('session.isPaused')) {
          this.microphoneReconnectAttempts = 0;
        }
      };
      this.wsMicrophone.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (
            data.type === 'transcript' &&
            data.text &&
            state.get('session.isActive') &&
            !state.get('session.isPaused')
          ) {
            state.addTranscript(data.text);
            if (state.get('settings.autoHints')) void this.requestHint(data.text);
          }
        } catch (error) {
          console.error('[APP] Не удалось разобрать сообщение микрофона:', error);
        }
      };
      this.wsMicrophone.onclose = () => {
        this.wsMicrophone = null;
        if (state.get('session.isActive') && !state.get('session.isPaused')) {
          this.attemptMicrophoneReconnect();
        }
      };
      this.wsMicrophone.onerror = () => {
        if (state.get('session.isActive') && !state.get('session.isPaused')) {
          state.set('ui.status', 'error');
        }
      };
    } catch (error) {
      console.error('[APP] Не удалось подключить микрофонный STT:', error);
    }
  }

  attemptMicrophoneReconnect() {
    if (!state.get('session.isActive') || state.get('session.isPaused')) return;
    if (this.microphoneReconnectAttempts >= this.maxReconnectAttempts) {
      this.ui.showToast('Не удалось подключить микрофонный STT', 'error');
      return;
    }
    this.microphoneReconnectAttempts++;
    const delay = Math.min(1000 * 2 ** this.microphoneReconnectAttempts, 30000);
    setTimeout(() => this.connectMicrophoneWebSocket(), delay);
  }

  attemptReconnect() {
    if (!state.get('session.isActive') || state.get('session.isPaused')) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[APP] Max reconnection attempts reached');
      this.ui.showToast('Не удалось подключиться к серверу', 'error');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`[APP] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'transcript':
        if (!state.get('session.isActive') || state.get('session.isPaused')) break;
        state.addTranscript(data.text);
        if (state.get('settings.autoHints')) {
          void this.requestHint(data.text);
        }
        break;
      case 'status':
        if (!state.get('session.isActive') || state.get('session.isPaused')) break;
        if (data.status) {
          state.set('ui.status', data.status);
        } else if (state.get('session.isActive') && !state.get('session.isPaused')) {
          state.set('ui.status', 'recording');
        }
        break;
      case 'error':
        console.error('[APP] Server error:', data.message);
        this.ui.showToast(data.message, 'error');
        break;
    }
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Space - Toggle recording
      if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
        e.preventDefault();
        document.getElementById('btn-toggle')?.click();
      }

      // Ctrl/Cmd + P - Pause
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyP') {
        e.preventDefault();
        document.getElementById('btn-pause')?.click();
      }

      // Ctrl/Cmd + H - Ask hint
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyH') {
        e.preventDefault();
        document.getElementById('btn-ask')?.click();
      }

      // Escape - Close modals/panels
      if (e.code === 'Escape') {
        const settingsPanel = document.getElementById('settings-panel');
        if (settingsPanel?.classList.contains('open')) {
          this.ui.settings.close();
        }
      }
    });
  }

  async loadSettings() {
    if (!window.electron?.settingsGetAll) return;

    try {
      const settings = await window.electron.settingsGetAll();
      const normalizedSettings = {
        ...settings,
        autoHints:
          settings.autoHints === undefined ? undefined : normalizeStoredBoolean(settings.autoHints),
        dualAudio:
          settings.dualAudio === undefined ? undefined : normalizeStoredBoolean(settings.dualAudio),
        alwaysOnTop:
          settings.alwaysOnTop === undefined
            ? undefined
            : normalizeStoredBoolean(settings.alwaysOnTop),
        compactMode:
          settings.compactMode === undefined
            ? undefined
            : normalizeStoredBoolean(settings.compactMode),
        opacity: settings.opacity === undefined ? undefined : Number(settings.opacity),
      };
      if (settings.theme) {
        document.documentElement.setAttribute('data-theme', settings.theme);
        state.applySetting('theme', settings.theme);
      }
      if (settings.provider) {
        state.applySetting('provider', settings.provider);
        const providerSelect = document.getElementById('llm-provider');
        if (providerSelect) providerSelect.value = settings.provider;
      }
      if (settings.profile) {
        state.applySetting('profile', settings.profile);
        const profileSelect = document.getElementById('ai-profile');
        if (profileSelect) profileSelect.value = settings.profile;
      }
      for (const key of ['autoHints', 'dualAudio', 'alwaysOnTop', 'compactMode']) {
        if (normalizedSettings[key] !== undefined) state.applySetting(key, normalizedSettings[key]);
      }
      const controlMap = {
        autoHints: 'auto-hints',
        dualAudio: 'dual-audio',
        alwaysOnTop: 'always-on-top',
        compactMode: 'compact-mode',
      };
      for (const [key, id] of Object.entries(controlMap)) {
        const control = document.getElementById(id);
        if (control && normalizedSettings[key] !== undefined) {
          control.checked = normalizedSettings[key];
        }
      }
      if (normalizedSettings.opacity !== undefined && Number.isFinite(normalizedSettings.opacity)) {
        const opacity = Math.max(50, Math.min(100, normalizedSettings.opacity));
        state.applySetting('opacity', opacity);
        const slider = document.getElementById('opacity-slider');
        if (slider) slider.value = String(opacity);
        document.getElementById('opacity-value').textContent = `${opacity}%`;
        document.body.style.opacity = opacity / 100;
      }
      if (normalizedSettings.compactMode !== undefined) {
        document.body.classList.toggle('compact-mode', normalizedSettings.compactMode);
      }
    } catch (err) {
      console.error('[APP] Не удалось загрузить настройки:', err);
    }
  }

  setupParticles() {
    const particles = document.getElementById('particles');
    if (!particles) return;

    // Create subtle floating particles
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.animationDelay = `${Math.random() * 20}s`;
      particle.style.animationDuration = `${15 + Math.random() * 10}s`;
      particles.appendChild(particle);
    }
  }

  // Public API for backwards compatibility
  async startSession() {
    if (!window.electron?.startRuntime) {
      this.ui.showToast('API запуска сервисов недоступен', 'error');
      return false;
    }

    try {
      this.sessionEpoch++;
      state.startSession();
      this.ui.updateToggleButton(true);
      this.ui.updatePauseButton(false);
      const result = await window.electron.startRuntime({
        dualAudio: state.get('settings.dualAudio') === true,
      });
      if (!result?.success) throw new Error(result?.error || 'Сервисы не запустились');
      this.connectWebSocket();
      return true;
    } catch (error) {
      await window.electron?.stopRuntime?.();
      state.stopSession();
      this.ui.updateToggleButton(false);
      this.ui.updatePauseButton(true);
      state.set('ui.status', 'error');
      this.ui.showToast(error.message || 'Не удалось запустить STT', 'error');
      return false;
    }
  }

  async stopSession() {
    this.sessionEpoch++;
    state.stopSession();
    try {
      await window.electron?.stopRuntime?.();
    } finally {
      this.ws?.close();
      this.ws = null;
      this.wsMicrophone?.close();
      this.wsMicrophone = null;
      this.ui.updateToggleButton(false);
      this.ui.updatePauseButton(true);
    }
  }

  async pauseSession() {
    this.sessionEpoch++;
    state.pauseSession();
    try {
      await window.electron?.stopSTT?.();
    } finally {
      this.ws?.close();
      this.ws = null;
      this.wsMicrophone?.close();
      this.wsMicrophone = null;
      this.ui.updatePauseButton(true);
    }
  }

  async resumeSession() {
    try {
      this.sessionEpoch++;
      state.set('ui.status', 'processing');
      const result = await window.electron?.startSTT?.({
        dualAudio: state.get('settings.dualAudio') === true,
      });
      if (!result?.success) throw new Error(result?.error || 'STT не запустился');
      state.resumeSession();
      this.ui.updateToggleButton(true);
      this.ui.updatePauseButton(false);
      this.connectWebSocket();
      return true;
    } catch (error) {
      state.set('ui.status', 'error');
      this.ui.showToast(error.message || 'Не удалось возобновить STT', 'error');
      return false;
    }
  }

  startRecording() {
    return this.startSession();
  }

  stopRecording() {
    return this.stopSession();
  }

  async requestHint(text = null) {
    const requestEpoch = this.sessionEpoch;
    const transcript = text || state.get('ui.transcripts').at(-1)?.text;
    if (!transcript || transcript.trim().length < 5) {
      this.ui.showToast('Недостаточно текста для подсказки', 'warning');
      return;
    }

    const context = state
      .get('ui.transcripts')
      .slice(-10)
      .map((item) => `Интервьюер: ${item.text}`);
    this.ui.hints.showLoadingState();
    state.set('ui.status', 'processing');

    try {
      const response = await fetch(`${SERVERS.LLM}/hint/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: transcript,
          context,
          profile: state.get('settings.profile'),
          max_tokens: 512,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) throw new Error(`LLM HTTP ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('LLM не вернул поток ответа');
      const decoder = new TextDecoder();
      let buffer = '';
      let answer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          if (buffer.trim()) {
            this.consumeSSELine(buffer, (chunk) => {
              answer += chunk;
            });
          }
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          this.consumeSSELine(line, (chunk) => {
            answer += chunk;
          });
        }
      }
      if (!answer.trim()) throw new Error('LLM вернул пустой ответ');
      if (requestEpoch !== this.sessionEpoch) return false;
      this.ui.addHint({
        text: answer.trim(),
        type: 'general',
        confidence: 'medium',
        context: transcript,
      });
      state.set(
        'ui.status',
        state.get('session.isPaused')
          ? 'paused'
          : state.get('session.isActive')
            ? 'recording'
            : 'idle'
      );
      return true;
    } catch (error) {
      if (requestEpoch !== this.sessionEpoch) return false;
      state.set('ui.status', 'error');
      this.ui.showToast(error.message || 'Не удалось получить подсказку', 'error');
      const currentHint = state.getCurrentHint();
      if (currentHint) {
        this.ui.hints.displayHint(
          currentHint,
          state.get('ui.currentHintIndex'),
          state.get('ui.hints').length
        );
      } else {
        this.ui.hints.showEmptyState();
      }
      return false;
    }
  }

  generateHint() {
    return this.requestHint();
  }

  async captureAndAnalyze() {
    try {
      if (!(await this.ensureLLM())) throw new Error('LLM не запущен');
      const image = await window.electron?.captureScreen?.();
      if (!image) throw new Error('Не удалось сделать скриншот');
      const response = await fetch(`${SERVERS.LLM}/vision/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: image,
          prompt: 'Проанализируй скриншот и дай полезный ответ.',
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) throw new Error(`Vision HTTP ${response.status}`);
      const result = await response.json();
      if (!result.analysis) throw new Error('Vision вернул пустой ответ');
      this.ui.addHint({ text: result.analysis, type: 'vision', confidence: 'medium' });
      this.ui.showToast('Скриншот проанализирован', 'success');
    } catch (error) {
      this.ui.showToast(error.message || 'Ошибка анализа скриншота', 'error');
    }
  }

  async sendDirectMessage(text) {
    if (!text?.trim()) return false;
    return this.requestHint(text.trim());
  }

  consumeSSELine(line, onChunk) {
    if (!line.startsWith('data: ')) return;
    try {
      const data = JSON.parse(line.slice(6));
      if (data.chunk) onChunk(String(data.chunk));
    } catch (error) {
      console.error('[APP] Ошибка разбора SSE:', error);
    }
  }

  async ensureLLM() {
    if (!window.electron?.startLLM) return false;
    try {
      const result = await window.electron.startLLM();
      return Boolean(result?.success);
    } catch (error) {
      console.error('[APP] Не удалось запустить LLM для Vision:', error);
      return false;
    }
  }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  window.liveHintsApp = new LiveHintsApp();
  window.app = window.liveHintsApp;
});
