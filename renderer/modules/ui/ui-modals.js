/**
 * UI Modals - управление модальными окнами (история, помощь, сессии)
 */

export class UIModals {
  constructor(elements, utils, app) {
    this.elements = elements;
    this.utils = utils;
    this.app = app;
  }

  showHelp() {
    this.elements.helpModal?.classList.remove('hidden');
  }

  hideHelp() {
    this.elements.helpModal?.classList.add('hidden');
  }

  showHistory() {
    this.renderSessionsList();
    this.elements.historyModal?.classList.remove('hidden');
  }

  hideHistory() {
    this.elements.historyModal?.classList.add('hidden');
  }

  renderSessionsList() {
    const sessions = this.app.sessions.getAll();

    if (sessions.length === 0) {
      this.elements.sessionsList.innerHTML = '<p class="placeholder">Нет сохранённых сессий</p>';
      return;
    }

    this.elements.sessionsList.innerHTML = sessions
      .map((session) => {
        const transcriptLines = (session.transcript || '').split('\n').filter((l) => l.trim());
        const hintLines = (session.hints || '').split('\n').filter((l) => l.trim());
        const duration = this.app.sessions.calculateDuration(session);
        const tags = session.tags || [];

        return `
          <div class="session-card">
            <div class="session-card-header">
              <span class="session-card-title">${this.utils.escapeHtml(session.name || 'Сессия')}</span>
              <span class="session-card-date">${this.app.sessions.formatDateFull(session.date)}</span>
            </div>
            <div class="session-card-stats">
              <span class="session-stat">
                <span class="stat-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></span>
                <span class="stat-value">${transcriptLines.length} реплик</span>
              </span>
              <span class="session-stat">
                <span class="stat-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg></span>
                <span class="stat-value">${hintLines.length} подсказок</span>
              </span>
              <span class="session-stat">
                <span class="stat-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
                <span class="stat-value">${duration}</span>
              </span>
            </div>
            ${
              tags.length > 0
                ? `
              <div class="session-card-tags">
                ${tags.map((tag) => `<span class="session-tag">${this.utils.escapeHtml(tag)}</span>`).join('')}
              </div>
            `
                : ''
            }
            <div class="session-card-preview">${this.utils.escapeHtml((session.transcript || '').substring(0, 120))}...</div>
            <div class="session-card-actions">
              <button class="btn-session-view" data-action="view">Открыть</button>
              <button class="btn-session-export" data-action="export">Экспорт</button>
              <button class="btn-session-delete" data-action="delete">Удалить</button>
            </div>
          </div>
        `;
      })
      .join('');

    this.elements.sessionsList.querySelectorAll('.session-card').forEach((card, index) => {
      card.dataset.sessionId = String(sessions[index].id);
    });

    this.elements.sessionsList.querySelectorAll('.session-card').forEach((card) => {
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
          this.utils.showToast('Сессия удалена', 'success');
        }
      });

      card.addEventListener('click', () => this.showSessionView(sessionId));
    });
  }

  showSessionView(sessionId) {
    const session = this.app.sessions.getById(sessionId);
    if (!session) return;

    const transcriptLines = (session.transcript || '').split('\n').filter((l) => l.trim());
    const hintLines = (session.hints || '').split('\n').filter((l) => l.trim());

    this.elements.sessionViewTitle.textContent =
      session.name || `Сессия от ${this.app.sessions.formatDate(session.date)}`;

    this.elements.sessionTranscript.innerHTML =
      transcriptLines.length > 0
        ? transcriptLines
            .map(
              (line) => `
              <div class="session-dialog-item">
                <span class="dialog-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg></span>
                <span class="dialog-text">${this.utils.escapeHtml(line)}</span>
              </div>
            `
            )
            .join('')
        : '<p class="placeholder">Нет транскрипта</p>';

    this.elements.sessionHints.innerHTML =
      hintLines.length > 0
        ? hintLines
            .map(
              (line) => `
              <div class="session-dialog-item hint-item">
                <span class="dialog-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="18" x2="15" y2="18"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg></span>
                <span class="dialog-text">${this.utils.renderMarkdown(line)}</span>
              </div>
            `
            )
            .join('')
        : '<p class="placeholder">Нет подсказок</p>';

    this.hideHistory();
    this.elements.sessionViewModal?.classList.remove('hidden');
  }

  hideSessionView() {
    this.elements.sessionViewModal?.classList.add('hidden');
  }
}
