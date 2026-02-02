/**
 * Live Hints - Main Application
 * Shadow Assistant Theme
 * Integrates new UI modules with existing functionality
 */

import { NewUIController } from './modules/ui-new/index.js';
import { state } from './modules/ui-new/state-manager.js';
import { animations } from './modules/ui-new/animation-engine.js';
import { SERVERS } from './modules/constants.js';

// Main Application Class
class LiveHintsApp {
  constructor() {
    this.ui = null;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;

    this.init();
  }

  async init() {
    console.log('[APP] Initializing Live Hints...');

    // Initialize new UI controller
    this.ui = new NewUIController();

    // Setup IPC listeners
    this.setupIPCListeners();

    // Connect to WebSocket
    this.connectWebSocket();

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

    // Transcript received
    window.electron.on('transcript', (data) => {
      console.log('[APP] Transcript received:', data.text);
      state.addTranscript(data.text);
    });

    // Hint received
    window.electron.on('hint', (data) => {
      console.log('[APP] Hint received');
      state.set('ui.status', 'recording');
      state.addHint({
        text: data.text,
        timestamp: Date.now(),
        type: data.type || 'general',
        confidence: data.confidence || 'medium'
      });
      this.ui.showToast('Подсказка получена', 'success');
    });

    // Error received
    window.electron.on('error', (data) => {
      console.error('[APP] Error:', data.message);
      state.set('ui.status', 'error');
      this.ui.showToast(data.message, 'error');
    });

    // Status updates
    window.electron.on('status', (data) => {
      state.set('ui.status', data.status);
    });

    // Settings updated
    window.electron.on('settings-updated', () => {
      this.loadSettings();
    });
  }

  connectWebSocket() {
    try {
      this.ws = new WebSocket(SERVERS.STT);

      this.ws.onopen = () => {
        console.log('[APP] WebSocket connected');
        this.reconnectAttempts = 0;
        state.set('ui.status', 'idle');
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
        this.attemptReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('[APP] WebSocket error:', err);
        state.set('ui.status', 'error');
      };
    } catch (err) {
      console.error('[APP] Failed to connect WebSocket:', err);
    }
  }

  attemptReconnect() {
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
        state.addTranscript(data.text);
        break;
      case 'status':
        state.set('ui.status', data.status);
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

  loadSettings() {
    if (!window.electron) return;

    window.electron.send('get-settings');
    window.electron.once('settings', (settings) => {
      if (settings.theme) {
        document.documentElement.setAttribute('data-theme', settings.theme);
        state.updateSetting('theme', settings.theme);
      }
      if (settings.provider) {
        state.updateSetting('provider', settings.provider);
        const providerSelect = document.getElementById('llm-provider');
        if (providerSelect) providerSelect.value = settings.provider;
      }
      if (settings.profile) {
        state.updateSetting('profile', settings.profile);
        const profileSelect = document.getElementById('ai-profile');
        if (profileSelect) profileSelect.value = settings.profile;
      }
    });
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
  startRecording() {
    state.startSession();
    window.electron?.send('start-recording');
  }

  stopRecording() {
    state.stopSession();
    window.electron?.send('stop-recording');
  }

  generateHint() {
    state.set('ui.status', 'processing');
    this.ui.hints.showLoadingState();
    window.electron?.send('generate-hint');
  }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  window.liveHintsApp = new LiveHintsApp();
});
