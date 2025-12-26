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
                <span class="dialog-icon">🎙️</span>
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
                <span class="dialog-icon">💡</span>
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
