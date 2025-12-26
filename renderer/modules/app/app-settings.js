/**
 * App Settings - загрузка/сохранение настроек, слайдеры
 */

import { SERVERS } from '../constants.js';

export class AppSettings {
    constructor(app) {
        this.app = app;
    }

    setupFontSliders() {
        const fontTranscript = document.getElementById('font-transcript');
        const fontTranscriptValue = document.getElementById('font-transcript-value');
        const fontHints = document.getElementById('font-hints');
        const fontHintsValue = document.getElementById('font-hints-value');

        if (fontTranscript) {
            fontTranscript.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (fontTranscriptValue) fontTranscriptValue.textContent = `${value}px`;
                document.documentElement.style.setProperty('--font-transcript', `${value}px`);
                this.app.saveSettings({ fontTranscript: value });
            });
        }

        if (fontHints) {
            fontHints.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (fontHintsValue) fontHintsValue.textContent = `${value}px`;
                document.documentElement.style.setProperty('--font-hints', `${value}px`);
                this.app.saveSettings({ fontHints: value });
            });
        }
    }

    setupAdvancedSettings() {
        const contextWindowSize = document.getElementById('context-window-size');
        const maxContextChars = document.getElementById('max-context-chars');
        const maxTokens = document.getElementById('max-tokens');
        const temperature = document.getElementById('temperature');
        const debugMode = document.getElementById('debug-mode');
        const btnHealthCheck = document.getElementById('btn-health-check');

        if (contextWindowSize) {
            contextWindowSize.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.app.hints.setParams({ contextWindowSize: value });
                const valueEl = document.getElementById('context-window-size-value');
                if (valueEl) valueEl.textContent = value;
                this.app.saveSettings({ contextWindowSize: value });
            });
        }

        if (maxContextChars) {
            maxContextChars.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.app.hints.setParams({ maxContextChars: value });
                const valueEl = document.getElementById('max-context-chars-value');
                if (valueEl) valueEl.textContent = value;
                this.app.saveSettings({ maxContextChars: value });
            });
        }

        if (maxTokens) {
            maxTokens.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.app.hints.setParams({ maxTokens: value });
                const valueEl = document.getElementById('max-tokens-value');
                if (valueEl) valueEl.textContent = value;
                this.app.saveSettings({ maxTokens: value });
            });
        }

        if (temperature) {
            temperature.addEventListener('input', (e) => {
                const value = parseInt(e.target.value) / 10;
                this.app.hints.setParams({ temperature: value });
                const valueEl = document.getElementById('temperature-value');
                if (valueEl) valueEl.textContent = value.toFixed(1);
                this.app.saveSettings({ temperature: value });
            });
        }

        if (debugMode) {
            debugMode.addEventListener('change', (e) => {
                this.app.debugMode = e.target.checked;
                this.app.ui.toggleMetricsPanel(this.app.debugMode);
                this.app.saveSettings({ debugMode: e.target.checked });
            });
        }

        if (btnHealthCheck) {
            btnHealthCheck.addEventListener('click', () => {
                this.app.hints.checkHealth();
            });
        }

        this.setupRemoteMode();
    }

    setupRemoteMode() {
        const remoteMode = document.getElementById('remote-mode');
        const remoteConfig = document.getElementById('remote-servers-config');
        const btnTestRemote = document.getElementById('btn-test-remote');

        if (remoteMode) {
            remoteMode.addEventListener('change', (e) => {
                if (remoteConfig) {
                    remoteConfig.classList.toggle('hidden', !e.target.checked);
                }
                this.app.saveSettings({ remoteMode: e.target.checked });
            });
        }

        if (btnTestRemote) {
            btnTestRemote.addEventListener('click', async () => {
                const sttUrl = document.getElementById('remote-stt-url')?.value || SERVERS.STT;
                const llmUrl = document.getElementById('remote-llm-url')?.value || SERVERS.LLM;
                const result = await this.app.audio.testRemoteConnection(sttUrl, llmUrl);

                if (result.sttOk && result.llmOk) {
                    this.app.ui.showToast('Оба сервера доступны', 'success');
                } else if (result.llmOk) {
                    this.app.ui.showToast('LLM доступен, STT недоступен', 'warning');
                } else if (result.sttOk) {
                    this.app.ui.showToast('STT доступен, LLM недоступен', 'warning');
                } else {
                    this.app.ui.showToast('Оба сервера недоступны', 'error');
                }
            });
        }
    }

    load() {
        try {
            const settings = JSON.parse(localStorage.getItem('live-hints-settings')) || {};

            if (settings.llmProvider) {
                this.app.ui.elements.llmProvider.value = settings.llmProvider;
            }
            if (settings.aiProfile) {
                this.app.hints.currentProfile = settings.aiProfile;
                this.app.ui.elements.aiProfile.value = settings.aiProfile;
                this.app.toggleCustomInstructions();
            }
            if (settings.customInstructions) {
                this.app.hints.customInstructions = settings.customInstructions;
                const el = document.getElementById('custom-instructions');
                if (el) el.value = settings.customInstructions;
            }
            if (settings.autoHints !== undefined) {
                this.app.autoHintsEnabled = settings.autoHints;
                const el = document.getElementById('auto-hints');
                if (el) el.checked = settings.autoHints;
            }
            if (settings.opacity !== undefined) {
                const slider = document.getElementById('opacity-slider');
                const value = document.getElementById('opacity-value');
                if (slider) slider.value = settings.opacity;
                if (value) value.textContent = `${settings.opacity}%`;
                window.electronAPI.setOpacity(settings.opacity);
            }
            if (settings.debugMode !== undefined) {
                this.app.debugMode = settings.debugMode;
                const el = document.getElementById('debug-mode');
                if (el) el.checked = settings.debugMode;
                this.app.ui.toggleMetricsPanel(this.app.debugMode);
            }
            if (settings.compactMode) {
                this.app.ui.compactMode = true;
                document.body.classList.add('compact-mode');
                this.app.ui.elements.btnCompactToggle?.classList.add('active');
            }

            this.app.hints.setParams({
                contextWindowSize: settings.contextWindowSize,
                maxContextChars: settings.maxContextChars,
                maxTokens: settings.maxTokens,
                temperature: settings.temperature,
            });

            this.loadUserContext();
        } catch {
            // Ignore errors
        }
    }

    loadUserContext() {
        try {
            const onboarding = JSON.parse(localStorage.getItem('live-hints-onboarding')) || {};
            if (onboarding.contextFileContent) {
                this.app.hints.setUserContext(onboarding.contextFileContent);
                console.log(`[App] Загружен контекст пользователя: ${onboarding.contextFileContent.length} символов`);
            }
        } catch (err) {
            console.warn('[App] Ошибка загрузки контекста:', err);
        }
    }

    save(newSettings = {}) {
        try {
            const settings = JSON.parse(localStorage.getItem('live-hints-settings')) || {};
            Object.assign(settings, newSettings);
            localStorage.setItem('live-hints-settings', JSON.stringify(settings));
        } catch {
            // Ignore errors
        }
    }
}
