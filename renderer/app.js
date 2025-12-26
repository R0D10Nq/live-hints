/**
 * Live Hints - Главный модуль приложения
 * Рефакторинг: использует отдельные модули для разных ответственностей
 */

import { SERVERS } from './modules/constants.js';
import { AudioManager } from './modules/audio-manager.js';
import { SessionManager } from './modules/session-manager.js';
import { UIController } from './modules/ui-controller.js';
import { HintManager } from './modules/hint-manager.js';
import { AppSettings } from './modules/app/app-settings.js';
import { AppVision } from './modules/app/app-vision.js';
import { AppStealth } from './modules/app/app-stealth.js';
import { AppModels } from './modules/app/app-models.js';
import { AppIPC } from './modules/app/app-ipc.js';

class LiveHintsApp {
    constructor() {
        // Состояние приложения
        this.isRunning = false;
        this.isPaused = false;
        this.autoHintsEnabled = false;
        this.debugMode = false;
        this.theme = 'dark';
        this.lastContextHash = '';
        this.transcriptContext = [];

        // Инициализация модулей
        this.ui = new UIController(this);
        this.audio = new AudioManager(this);
        this.sessions = new SessionManager(this);
        this.hints = new HintManager(this);

        // Инициализация app-модулей
        this.settings = new AppSettings(this);
        this.vision = new AppVision(this);
        this.stealth = new AppStealth(this);
        this.models = new AppModels(this);
        this.ipc = new AppIPC(this);

        this.init();
    }

    init() {
        this.ui.setup();
        this.audio.setup();
        this.sessions.setup();
        this.bindEvents();
        this.settings.load();
        this.ipc.setup();
        this.models.setup();
        this.vision.setup();
        this.stealth.setup();
    }

    bindEvents() {
        const { elements } = this.ui;

        // Window controls
        elements.btnMinimize?.addEventListener('click', () => {
            window.electronAPI.minimizeWindow();
        });

        elements.btnClose?.addEventListener('click', () => {
            this.stop();
            window.electronAPI.closeWindow();
        });

        // Start/Stop
        elements.btnToggle?.addEventListener('click', () => {
            if (this.isRunning) {
                this.stop();
            } else {
                this.start();
            }
        });

        // Provider change
        elements.llmProvider?.addEventListener('change', (e) => {
            this.saveSettings({ llmProvider: e.target.value });
        });

        // Profile change
        elements.aiProfile?.addEventListener('change', (e) => {
            this.hints.setProfile(e.target.value);
            this.toggleCustomInstructions();
            this.saveSettings({ aiProfile: e.target.value });
        });

        // Custom instructions
        const customInstructions = document.getElementById('custom-instructions');
        if (customInstructions) {
            customInstructions.addEventListener('input', (e) => {
                this.hints.customInstructions = e.target.value;
                this.saveSettings({ customInstructions: e.target.value });
            });
        }

        // Auto hints
        const autoHints = document.getElementById('auto-hints');
        if (autoHints) {
            autoHints.addEventListener('change', (e) => {
                this.autoHintsEnabled = e.target.checked;
                this.saveSettings({ autoHints: e.target.checked });
            });
        }

        // Get hint button
        elements.btnGetHint?.addEventListener('click', () => {
            this.hints.manualRequestHint();
        });

        // Pause button
        elements.btnPause?.addEventListener('click', () => {
            this.togglePause();
        });

        // Opacity slider
        const opacitySlider = document.getElementById('opacity-slider');
        const opacityValue = document.getElementById('opacity-value');
        if (opacitySlider) {
            opacitySlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (opacityValue) opacityValue.textContent = `${value}%`;
                window.electronAPI.setOpacity(value);
                this.saveSettings({ opacity: value });
            });
        }

        // Settings sliders
        this.settings.setupFontSliders();
        this.settings.setupAdvancedSettings();

        // History
        elements.btnHistory?.addEventListener('click', () => {
            this.ui.showHistoryModal();
        });

        // Hotkeys
        document.addEventListener('keydown', (e) => this.handleHotkeys(e));
    }

    // Session flow
    async start() {
        try {
            console.log('[APP] Запуск сессии...');

            this.ui.updateStatus('listening');
            this.isRunning = true;
            this.isPaused = false;
            this.ui.updateToggleButton(true);
            this.ui.clearFeeds();

            this.hints.clearContext();
            console.log('[APP] Контекст очищен для новой сессии');

            this.clearServerCache();
            this.sessions.create();

            console.log('[APP] Подключение к STT...');
            await this.audio.connectToSTT();
            console.log('[APP] STT подключен');

            if (this.audio.dualAudioEnabled) {
                console.log('[APP] Dual Audio включён, подключаем микрофон...');
                this.audio.connectMicrophone();
            } else {
                console.log('[APP] Single mode (только loopback)');
            }

            console.log('[APP] Запуск захвата аудио...');
            const audioOptions = {
                dualAudio: this.audio.dualAudioEnabled,
                micDeviceIndex: this.audio.inputDeviceIndex || null,
            };
            const result = await window.electronAPI.startAudioCapture(audioOptions);
            console.log('[APP] Результат захвата:', result, 'dualAudio:', audioOptions.dualAudio);

            if (!result.success) {
                throw new Error(result.error || 'Не удалось запустить захват аудио');
            }

            console.log('[APP] Сессия запущена успешно');
            this.ui.showToast('Сессия запущена', 'success');
        } catch (error) {
            console.error('[APP] Ошибка запуска:', error);
            this.ui.showError(`Ошибка запуска: ${error.message}`);
            this.stop();
        }
    }

    async stop() {
        try {
            console.log('[APP] Остановка сессии...');

            await window.electronAPI.stopAudioCapture();
            this.audio.disconnect();

            if (this.sessions.currentSessionId) {
                this.sessions.save();
            }

            this.isRunning = false;
            this.isPaused = false;
            this.ui.updateStatus('idle');
            this.ui.updateToggleButton(false);

            console.log('[APP] Сессия остановлена');
        } catch (error) {
            console.error('[APP] Ошибка остановки:', error);
            this.ui.showError(`Ошибка остановки: ${error.message}`);
        }
    }

    togglePause() {
        if (!this.isRunning) return;

        this.isPaused = !this.isPaused;
        this.ui.updatePauseButton(this.isPaused);

        if (this.isPaused) {
            this.ui.updateStatus('paused');
        } else {
            this.ui.updateStatus('listening');
        }
    }

    handleHotkeys(e) {
        if (e.ctrlKey && e.key === '/') {
            e.preventDefault();
            window.electronAPI.toggleVisibility?.();
        }
        if (e.ctrlKey && e.key.startsWith('Arrow')) {
            e.preventDefault();
            const direction = e.key.replace('Arrow', '').toLowerCase();
            window.electronAPI.moveWindow?.(direction);
        }
        if (e.ctrlKey && e.key === 'Enter' && this.isRunning) {
            e.preventDefault();
            this.hints.manualRequestHint();
        }
        if (e.ctrlKey && e.key === 't') {
            e.preventDefault();
            this.ui.toggleTranscripts();
        }
        if (e.ctrlKey && e.key === 'h') {
            e.preventDefault();
            this.stealth.toggle();
        }
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            this.toggleTheme();
        }
    }

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', this.theme);
        this.ui.showToast(`Тема: ${this.theme === 'dark' ? 'тёмная' : 'светлая'}`, 'success');
        this.saveSettings();
    }

    toggleCustomInstructions() {
        const container = document.getElementById('custom-prompt-group');
        if (!container) return;

        if (this.hints.currentProfile === 'custom') {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    }

    async clearServerCache() {
        try {
            const response = await fetch(`${SERVERS.LLM}/cache/clear`, { method: 'POST' });
            if (response.ok) {
                console.log('[APP] Кэш сервера очищен');
            }
        } catch (err) {
            console.warn('[APP] Не удалось очистить кэш сервера:', err.message);
        }
    }

    // Proxy methods for backwards compatibility
    loadSettings() { this.settings.load(); }
    saveSettings(newSettings) { this.settings.save(newSettings); }
    captureAndAnalyze() { this.vision.captureAndAnalyze(); }
    get stealthMode() { return this.stealth.stealthMode; }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.liveHintsApp = new LiveHintsApp();
});
