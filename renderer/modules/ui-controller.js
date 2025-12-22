/**
 * UIController - Управление пользовательским интерфейсом
 */

import { STATUS_CONFIG, TIMEOUTS, QUESTION_TYPE_LABELS } from './constants.js';

export class UIController {
    constructor(app) {
        this.app = app;
        this.elements = {};
        this.compactMode = false;
        this.focusMode = false;
        this.hideTranscripts = false;
        this.transcriptsCollapsed = false;
        this.lastTranscriptText = '';
        this.lastHintText = '';
        this.pinnedHintText = '';
    }

    cacheElements() {
        this.elements = {
            btnToggle: document.getElementById('btn-toggle'),
            btnMinimize: document.getElementById('btn-minimize'),
            btnClose: document.getElementById('btn-close'),
            btnHistory: document.getElementById('btn-history'),
            btnCloseModal: document.getElementById('btn-close-modal'),
            btnCloseSessionView: document.getElementById('btn-close-session-view'),
            btnDismissError: document.getElementById('btn-dismiss-error'),
            statusIndicator: document.getElementById('status-indicator'),
            statusText: document.getElementById('status-text'),
            llmProvider: document.getElementById('llm-provider'),
            transcriptFeed: document.getElementById('transcript-feed'),
            hintsFeed: document.getElementById('hints-feed'),
            historyModal: document.getElementById('history-modal'),
            sessionsList: document.getElementById('sessions-list'),
            sessionViewModal: document.getElementById('session-view-modal'),
            sessionViewTitle: document.getElementById('session-view-title'),
            sessionTranscript: document.getElementById('session-transcript'),
            sessionHints: document.getElementById('session-hints'),
            errorToast: document.getElementById('error-toast'),
            errorMessage: document.getElementById('error-message'),
            btnGetHint: document.getElementById('btn-get-hint'),
            aiProfile: document.getElementById('ai-profile'),
            btnPause: document.getElementById('btn-pause'),
            btnCompactToggle: document.getElementById('btn-compact-toggle'),
            btnFocusToggle: document.getElementById('btn-focus-toggle'),
            btnSettingsToggle: document.getElementById('btn-settings-toggle'),
            settingsDrawer: document.getElementById('settings-drawer'),
            btnExitFocus: document.getElementById('btn-exit-focus'),
            btnPinHint: document.getElementById('btn-pin-hint'),
            btnCopyLast: document.getElementById('btn-copy-last'),
            btnClearHints: document.getElementById('btn-clear-hints'),
            pinnedHintContainer: document.getElementById('pinned-hint-container'),
            pinnedHintText: document.getElementById('pinned-hint-text'),
            metricsPanel: document.getElementById('metrics-panel'),
            metricsSttLatency: document.getElementById('metrics-stt-latency'),
            metricsLlmLatency: document.getElementById('metrics-llm-latency')
        };
    }

    setup() {
        this.cacheElements();
        this.bindUIEvents();
    }

    bindUIEvents() {
        // Compact mode
        if (this.elements.btnCompactToggle) {
            this.elements.btnCompactToggle.addEventListener('click', () => this.toggleCompactMode());
        }

        // Focus mode
        if (this.elements.btnFocusToggle) {
            this.elements.btnFocusToggle.addEventListener('click', () => this.toggleFocusMode());
        }

        if (this.elements.btnExitFocus) {
            this.elements.btnExitFocus.addEventListener('click', () => this.toggleFocusMode());
        }

        // Settings drawer
        if (this.elements.btnSettingsToggle) {
            this.elements.btnSettingsToggle.addEventListener('click', () => this.toggleSettingsDrawer());
        }

        // Pin/copy/clear hints
        if (this.elements.btnPinHint) {
            this.elements.btnPinHint.addEventListener('click', () => this.pinLastHint());
        }

        if (this.elements.btnCopyLast) {
            this.elements.btnCopyLast.addEventListener('click', () => this.copyLastHint());
        }

        if (this.elements.btnClearHints) {
            this.elements.btnClearHints.addEventListener('click', () => this.clearHints());
        }

        // Clear transcript
        const btnClearTranscript = document.getElementById('btn-clear-transcript');
        if (btnClearTranscript) {
            btnClearTranscript.addEventListener('click', () => this.clearTranscript());
        }

        // Toggle transcripts
        const btnToggleTranscripts = document.getElementById('btn-toggle-transcripts');
        if (btnToggleTranscripts) {
            btnToggleTranscripts.addEventListener('click', () => this.toggleTranscripts());
        }

        // Collapse transcripts
        const btnCollapseTranscripts = document.getElementById('btn-collapse-transcripts');
        if (btnCollapseTranscripts) {
            btnCollapseTranscripts.addEventListener('click', () => {
                this.collapseTranscripts();
                btnCollapseTranscripts.textContent = this.transcriptsCollapsed ? '▼' : '▲';
            });
        }

        // Error dismiss
        if (this.elements.btnDismissError) {
            this.elements.btnDismissError.addEventListener('click', () => this.hideError());
        }
    }

    updateStatus(status) {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.paused;

        if (this.elements.statusIndicator) {
            this.elements.statusIndicator.className = `status-indicator ${config.class}`;
        }
        if (this.elements.statusText) {
            this.elements.statusText.textContent = config.text;
        }
    }

    updateToggleButton(isRunning) {
        const btn = this.elements.btnToggle;
        if (!btn) return;

        const icon = btn.querySelector('.btn-icon');
        const text = btn.querySelector('.btn-text');

        if (isRunning) {
            btn.classList.add('active');
            if (icon) icon.textContent = '';
            if (text) text.textContent = 'Стоп';
        } else {
            btn.classList.remove('active');
            if (icon) icon.textContent = '';
            if (text) text.textContent = 'Старт';
        }
    }

    clearFeeds() {
        if (this.elements.transcriptFeed) {
            this.elements.transcriptFeed.innerHTML = '';
        }
        if (this.elements.hintsFeed) {
            this.elements.hintsFeed.innerHTML = '';
        }
        this.lastTranscriptText = '';
        this.lastHintText = '';
    }

    addTranscriptItem(text, timestamp, source = 'interviewer') {
        if (text === this.lastTranscriptText) {
            console.log('[STT] Дубликат транскрипта, пропускаем');
            return;
        }
        this.lastTranscriptText = text;

        const icon = source === 'candidate' ? '🗣️' : '🎙️';
        const label = source === 'candidate' ? 'Ты' : 'Интервьюер';
        const formattedText = this.app.audio?.dualAudioEnabled ? `${icon} ${label}: ${text}` : text;

        this.addFeedItem(this.elements.transcriptFeed, formattedText, timestamp, null, source);
    }

    addHintItem(text, timestamp, latencyMs = null) {
        if (text === this.lastHintText) {
            console.log('[LLM] Дубликат подсказки, пропускаем');
            return;
        }
        this.lastHintText = text;
        this.addFeedItem(this.elements.hintsFeed, text, timestamp, latencyMs);
    }

    addFeedItem(feed, text, timestamp, latencyMs = null) {
        if (!feed) return;

        const placeholder = feed.querySelector('.placeholder');
        if (placeholder) placeholder.remove();

        const item = document.createElement('div');
        item.className = 'feed-item';

        const latencyBadge = latencyMs ? `<span class="latency-badge">${this.formatLatency(latencyMs)}</span>` : '';
        const isHintsFeed = feed === this.elements.hintsFeed;
        const renderedText = isHintsFeed ? this.renderMarkdown(text) : this.escapeHtml(text);

        item.innerHTML = `
            <div class="feed-item-time">${this.formatTime(timestamp)}${latencyBadge}</div>
            <div class="feed-item-text">${renderedText}</div>
        `;

        feed.appendChild(item);
        feed.scrollTop = feed.scrollHeight;
    }

    showHintLoading() {
        const feed = this.elements.hintsFeed;
        if (!feed) return;

        const placeholder = feed.querySelector('.placeholder');
        if (placeholder) placeholder.remove();

        const existingLoader = feed.querySelector('.hint-loading');
        if (existingLoader) existingLoader.remove();

        const loader = document.createElement('div');
        loader.className = 'feed-item hint-loading';
        loader.innerHTML = `
            <div class="feed-item-time">${this.formatTime(new Date().toISOString())}</div>
            <div class="feed-item-text loading-text">Генерация подсказки...</div>
        `;
        feed.appendChild(loader);
        feed.scrollTop = feed.scrollHeight;
    }

    hideHintLoading() {
        const feed = this.elements.hintsFeed;
        if (!feed) return;
        const loader = feed.querySelector('.hint-loading');
        if (loader) loader.remove();
    }

    createStreamingHintElement() {
        const feed = this.elements.hintsFeed;
        if (!feed) return null;

        const item = document.createElement('div');
        item.className = 'feed-item streaming-hint';
        item.innerHTML = `
            <div class="feed-item-time">${this.formatTime(new Date().toISOString())}</div>
            <div class="feed-item-text"></div>
        `;
        feed.appendChild(item);
        feed.scrollTop = feed.scrollHeight;
        return item;
    }

    updateStreamingHint(element, text) {
        if (!element) return;
        const textEl = element.querySelector('.feed-item-text');
        if (textEl) {
            textEl.innerHTML = this.renderMarkdown(text);
        }
        const feed = this.elements.hintsFeed;
        if (feed) feed.scrollTop = feed.scrollHeight;
    }

    finalizeStreamingHint(element, text, options = {}) {
        if (!element) return;
        element.classList.remove('streaming-hint');

        const { latencyMs, cached, questionType } = options;
        const timeEl = element.querySelector('.feed-item-time');

        if (timeEl) {
            if (questionType) {
                const typeBadge = document.createElement('span');
                typeBadge.className = `question-type-badge type-${questionType}`;
                typeBadge.textContent = QUESTION_TYPE_LABELS[questionType] || questionType;
                timeEl.appendChild(typeBadge);
            }

            if (cached) {
                const cacheBadge = document.createElement('span');
                cacheBadge.className = 'cache-badge';
                cacheBadge.textContent = 'Из кэша';
                timeEl.appendChild(cacheBadge);
            }

            if (latencyMs && !cached) {
                const latencyBadge = document.createElement('span');
                latencyBadge.className = 'latency-badge';
                latencyBadge.textContent = this.formatLatency(latencyMs);
                timeEl.appendChild(latencyBadge);
            }
        }
    }

    // History Modal
    showHistoryModal() {
        this.renderSessionsList();
        this.elements.historyModal?.classList.remove('hidden');
    }

    hideHistoryModal() {
        this.elements.historyModal?.classList.add('hidden');
    }

    renderSessionsList() {
        const sessions = this.app.sessions.getAll();

        if (sessions.length === 0) {
            this.elements.sessionsList.innerHTML = '<p class="placeholder">Нет сохранённых сессий</p>';
            return;
        }

        this.elements.sessionsList.innerHTML = sessions.map(session => {
            const transcriptLines = (session.transcript || '').split('\n').filter(l => l.trim());
            const hintLines = (session.hints || '').split('\n').filter(l => l.trim());
            const duration = this.app.sessions.calculateDuration(session);
            const tags = session.tags || [];

            return `
                <div class="session-card" data-session-id="${session.id}">
                    <div class="session-card-header">
                        <span class="session-card-title">${session.name || 'Сессия'}</span>
                        <span class="session-card-date">${this.app.sessions.formatDateFull(session.date)}</span>
                    </div>
                    <div class="session-card-stats">
                        <span class="session-stat">
                            <span class="stat-icon">🎙️</span>
                            <span class="stat-value">${transcriptLines.length} реплик</span>
                        </span>
                        <span class="session-stat">
                            <span class="stat-icon">💡</span>
                            <span class="stat-value">${hintLines.length} подсказок</span>
                        </span>
                        <span class="session-stat">
                            <span class="stat-icon">⏱️</span>
                            <span class="stat-value">${duration}</span>
                        </span>
                    </div>
                    ${tags.length > 0 ? `
                        <div class="session-card-tags">
                            ${tags.map(tag => `<span class="session-tag">${this.escapeHtml(tag)}</span>`).join('')}
                        </div>
                    ` : ''}
                    <div class="session-card-preview">${this.escapeHtml((session.transcript || '').substring(0, 120))}...</div>
                    <div class="session-card-actions">
                        <button class="btn-session-view" data-action="view">Открыть</button>
                        <button class="btn-session-export" data-action="export">Экспорт</button>
                        <button class="btn-session-delete" data-action="delete">Удалить</button>
                    </div>
                </div>
            `;
        }).join('');

        this.elements.sessionsList.querySelectorAll('.session-card').forEach(card => {
            const sessionId = card.dataset.sessionId;

            card.querySelector('.btn-session-view')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showSessionView(sessionId);
            });

            card.querySelector('.btn-session-export')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.app.sessions.exportSession(sessionId);
            });

            card.querySelector('.btn-session-delete')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.app.sessions.delete(sessionId)) {
                    this.renderSessionsList();
                    this.showToast('Сессия удалена', 'success');
                }
            });

            card.addEventListener('click', () => this.showSessionView(sessionId));
        });
    }

    showSessionView(sessionId) {
        const session = this.app.sessions.getById(sessionId);
        if (!session) return;

        const transcriptLines = (session.transcript || '').split('\n').filter(l => l.trim());
        const hintLines = (session.hints || '').split('\n').filter(l => l.trim());

        this.elements.sessionViewTitle.textContent = session.name || `Сессия от ${this.app.sessions.formatDate(session.date)}`;

        this.elements.sessionTranscript.innerHTML = transcriptLines.length > 0
            ? transcriptLines.map(line => `
                <div class="session-dialog-item">
                    <span class="dialog-icon">🎙️</span>
                    <span class="dialog-text">${this.escapeHtml(line)}</span>
                </div>
            `).join('')
            : '<p class="placeholder">Нет транскрипта</p>';

        this.elements.sessionHints.innerHTML = hintLines.length > 0
            ? hintLines.map(line => `
                <div class="session-dialog-item hint-item">
                    <span class="dialog-icon">💡</span>
                    <span class="dialog-text">${this.renderMarkdown(line)}</span>
                </div>
            `).join('')
            : '<p class="placeholder">Нет подсказок</p>';

        this.hideHistoryModal();
        this.elements.sessionViewModal?.classList.remove('hidden');
    }

    hideSessionView() {
        this.elements.sessionViewModal?.classList.add('hidden');
    }

    // UI Modes
    toggleSettingsDrawer() {
        if (!this.elements.settingsDrawer) return;

        const isOpen = this.elements.settingsDrawer.classList.toggle('open');
        if (this.elements.btnSettingsToggle) {
            this.elements.btnSettingsToggle.classList.toggle('active', isOpen);
        }
    }

    toggleCompactMode() {
        this.compactMode = !this.compactMode;
        document.body.classList.toggle('compact-mode', this.compactMode);

        if (this.elements.btnCompactToggle) {
            this.elements.btnCompactToggle.classList.toggle('active', this.compactMode);
        }

        this.app.saveSettings({ compactMode: this.compactMode });
    }

    toggleFocusMode() {
        this.focusMode = !this.focusMode;
        document.body.classList.toggle('focus-mode', this.focusMode);

        if (this.elements.btnFocusToggle) {
            this.elements.btnFocusToggle.classList.toggle('active', this.focusMode);
        }

        this.app.saveSettings({ focusMode: this.focusMode });
    }

    toggleTranscripts() {
        this.hideTranscripts = !this.hideTranscripts;
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.setAttribute('data-hide-transcripts', this.hideTranscripts);
        }
        const btn = document.getElementById('btn-toggle-transcripts');
        if (btn) {
            btn.textContent = this.hideTranscripts ? '👁' : '👁‍🗨';
            btn.title = this.hideTranscripts ? 'Показать транскрипты' : 'Скрыть транскрипты';
        }
        this.showToast(this.hideTranscripts ? 'Транскрипты скрыты' : 'Транскрипты показаны', 'success');
        this.app.saveSettings();
    }

    collapseTranscripts() {
        this.transcriptsCollapsed = !this.transcriptsCollapsed;
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.setAttribute('data-transcripts-collapsed', this.transcriptsCollapsed);
        }
        this.showToast(this.transcriptsCollapsed ? 'Транскрипты свёрнуты' : 'Транскрипты развёрнуты', 'success');
    }

    // Pin/Copy hints
    pinLastHint() {
        if (!this.lastHintText) {
            this.showToast('Нет подсказки для закрепления', 'info');
            return;
        }

        this.pinnedHintText = this.lastHintText;

        if (this.elements.pinnedHintText) {
            this.elements.pinnedHintText.textContent = this.pinnedHintText;
        }
        if (this.elements.pinnedHintContainer) {
            this.elements.pinnedHintContainer.classList.remove('hidden');
        }

        this.showToast('Подсказка закреплена', 'success');
    }

    unpinHint() {
        this.pinnedHintText = '';
        if (this.elements.pinnedHintContainer) {
            this.elements.pinnedHintContainer.classList.add('hidden');
        }
    }

    async copyLastHint() {
        const textToCopy = this.pinnedHintText || this.lastHintText;

        if (!textToCopy) {
            this.showToast('Нет подсказки для копирования', 'info');
            return;
        }

        try {
            await navigator.clipboard.writeText(textToCopy);
            this.showToast('Скопировано в буфер', 'success');
        } catch (error) {
            console.error('Ошибка копирования:', error);
            this.showToast('Ошибка копирования', 'error');
        }
    }

    clearHints() {
        if (this.elements.hintsFeed) {
            this.elements.hintsFeed.innerHTML = '<p class="placeholder">Подсказки появятся здесь...</p>';
        }
        this.lastHintText = '';
        this.unpinHint();
    }

    clearTranscript() {
        if (this.elements.transcriptFeed) {
            this.elements.transcriptFeed.innerHTML = '<p class="placeholder">Ожидание речи...</p>';
        }
        this.app.transcriptContext = [];
        this.lastTranscriptText = '';
        this.app.lastContextHash = '';
    }

    getTranscriptText() {
        const items = this.elements.transcriptFeed?.querySelectorAll('.feed-item-text');
        return items ? Array.from(items).map(el => el.textContent).join('\n') : '';
    }

    getHintsText() {
        const items = this.elements.hintsFeed?.querySelectorAll('.feed-item-text');
        return items ? Array.from(items).map(el => el.textContent).join('\n') : '';
    }

    // Toast/Error
    showToast(message, type = 'info') {
        if (this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
        }
        if (this.elements.errorToast) {
            this.elements.errorToast.classList.remove('hidden');
            this.elements.errorToast.style.background = type === 'success' ? 'var(--accent-success)' : '';
            setTimeout(() => {
                this.elements.errorToast.classList.add('hidden');
                this.elements.errorToast.style.background = '';
            }, TIMEOUTS.TOAST_DURATION);
        }
    }

    showError(message) {
        if (this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
        }
        if (this.elements.errorToast) {
            this.elements.errorToast.classList.remove('hidden');
        }
        this.updateStatus('error');

        setTimeout(() => this.hideError(), TIMEOUTS.ERROR_TOAST_DURATION);
    }

    hideError() {
        this.elements.errorToast?.classList.add('hidden');
    }

    // Metrics panel
    toggleMetricsPanel(debugMode) {
        if (!this.elements.metricsPanel) return;

        if (debugMode) {
            this.elements.metricsPanel.classList.remove('hidden');
            document.body.classList.add('debug-mode');
        } else {
            this.elements.metricsPanel.classList.add('hidden');
            document.body.classList.remove('debug-mode');
        }
    }

    updateMetricsPanel(metrics) {
        if (this.elements.metricsSttLatency) {
            this.elements.metricsSttLatency.textContent = metrics.stt_latency_ms ?? '-';
        }
        if (this.elements.metricsLlmLatency) {
            this.elements.metricsLlmLatency.textContent = metrics.llm_server_latency_ms ?? '-';
        }
    }

    // Utilities
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    formatLatency(latencyMs) {
        if (latencyMs == null) return '';
        const seconds = latencyMs / 1000;
        return `${seconds.toFixed(1)}s`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    renderMarkdown(text) {
        if (!text) return '';

        let html = this.escapeHtml(text);

        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/_(.+?)_/g, '<em>$1</em>');
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
        html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
        html = html.replace(/\n/g, '<br>');
        html = html.replace(/<\/li><br>/g, '</li>');
        html = html.replace(/<br><li>/g, '<li>');

        return html;
    }
}
