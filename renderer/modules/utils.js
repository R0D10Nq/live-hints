/**
 * Utils - утилиты для UI
 */

/**
 * Рендеринг Markdown в HTML
 */
function renderMarkdown(text) {
  if (!text) return '';

  let html = escapeHtml(text);

  // Жирный текст: **text** или __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Курсив: *text* или _text_
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Инлайн код: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Списки: - item или * item
  html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Нумерованные списки: 1. item
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Переносы строк
  html = html.replace(/\n/g, '<br>');

  // Убираем лишние <br> внутри списков
  html = html.replace(/<\/li><br>/g, '</li>');
  html = html.replace(/<br><li>/g, '<li>');

  return html;
}

/**
 * Экранирование HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Форматирование времени
 */
function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Форматирование латентности
 */
function formatLatency(latencyMs) {
  if (latencyMs == null || latencyMs === undefined) return '';
  const seconds = latencyMs / 1000;
  return `${seconds.toFixed(1)}s`;
}

/**
 * Генерация уникального ID сессии
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Получить label типа вопроса
 */
function getQuestionTypeLabel(type) {
  const labels = {
    technical: 'Технический',
    experience: 'Опыт',
    general: 'Общий',
  };
  return labels[type] || type;
}

/**
 * Debounce функция
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle функция
 */
function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderMarkdown,
    escapeHtml,
    formatTime,
    formatLatency,
    generateSessionId,
    getQuestionTypeLabel,
    debounce,
    throttle,
  };
}
