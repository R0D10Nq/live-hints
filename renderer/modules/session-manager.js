/**
 * SessionManager - Управление сессиями и историей
 */

import { STORAGE } from './constants.js';

export class SessionManager {
    constructor(app) {
        this.app = app;
        this.currentSessionId = null;
    }

    setup() {
        const exportBtn = document.getElementById('btn-export-sessions');
        const importBtn = document.getElementById('btn-import-sessions');
        const importInput = document.getElementById('import-file-input');

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportAllSessions());
        }

        if (importBtn) {
            importBtn.addEventListener('click', () => importInput?.click());
        }

        if (importInput) {
            importInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) this.importSessions(file);
                importInput.value = '';
            });
        }
    }

    generateId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    create() {
        this.currentSessionId = this.generateId();
        return this.currentSessionId;
    }

    save() {
        if (!this.currentSessionId) return;

        const session = {
            id: this.currentSessionId,
            date: new Date().toISOString(),
            transcript: this.app.ui.getTranscriptText(),
            hints: this.app.ui.getHintsText()
        };

        const sessions = this.getAll();
        sessions.unshift(session);

        if (sessions.length > STORAGE.MAX_SESSIONS) {
            sessions.pop();
        }

        localStorage.setItem('live-hints-sessions', JSON.stringify(sessions));
        this.currentSessionId = null;
    }

    getAll() {
        try {
            return JSON.parse(localStorage.getItem('live-hints-sessions')) || [];
        } catch {
            return [];
        }
    }

    getById(sessionId) {
        return this.getAll().find(s => s.id === sessionId);
    }

    delete(sessionId) {
        if (!confirm('Удалить эту сессию?')) return false;

        let sessions = this.getAll();
        sessions = sessions.filter(s => s.id !== sessionId);
        localStorage.setItem('live-hints-sessions', JSON.stringify(sessions));
        return true;
    }

    exportSession(sessionId) {
        const session = this.getById(sessionId);
        if (!session) return;

        const content = `# Сессия: ${session.name || 'Без названия'}
Дата: ${this.formatDateFull(session.date)}

## Транскрипт
${session.transcript || 'Нет данных'}

## Подсказки
${session.hints || 'Нет данных'}
`;

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session_${new Date(session.date).toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);

        this.app.ui.showToast('Сессия экспортирована', 'success');
    }

    exportAllSessions() {
        try {
            const sessions = this.getAll();

            if (sessions.length === 0) {
                this.app.ui.showToast('Нет сессий для экспорта', 'warning');
                return;
            }

            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                sessionsCount: sessions.length,
                sessions: sessions
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `live-hints-sessions-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.app.ui.showToast(`Экспортировано ${sessions.length} сессий`, 'success');
        } catch (e) {
            console.error('Export error:', e);
            this.app.ui.showToast('Ошибка экспорта', 'error');
        }
    }

    async importSessions(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.sessions || !Array.isArray(data.sessions)) {
                this.app.ui.showToast('Неверный формат файла', 'error');
                return;
            }

            const existingSessions = this.getAll();
            const existingIds = new Set(existingSessions.map(s => s.id));

            let imported = 0;
            for (const session of data.sessions) {
                if (!existingIds.has(session.id)) {
                    existingSessions.push(session);
                    imported++;
                }
            }

            existingSessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
            localStorage.setItem('live-hints-sessions', JSON.stringify(existingSessions));

            this.app.ui.showToast(`Импортировано ${imported} новых сессий`, 'success');
            this.app.ui.renderSessionsList();
        } catch (e) {
            console.error('Import error:', e);
            this.app.ui.showToast('Ошибка импорта: неверный формат', 'error');
        }
    }

    calculateDuration(session) {
        if (session.endedAt && session.date) {
            const start = new Date(session.date);
            const end = new Date(session.endedAt);
            const diffMs = end - start;
            const mins = Math.floor(diffMs / 60000);
            if (mins < 1) return '< 1 мин';
            if (mins < 60) return `${mins} мин`;
            const hours = Math.floor(mins / 60);
            return `${hours} ч ${mins % 60} мин`;
        }
        return '—';
    }

    formatDateFull(isoString) {
        const date = new Date(isoString);
        return date.toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}
