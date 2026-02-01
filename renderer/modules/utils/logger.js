/**
 * Logger - централизованное логирование для renderer процесса
 * Поддерживает уровни логирования и debug режим
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

class Logger {
  constructor() {
    this.level = LOG_LEVELS.INFO;
    this.prefix = '[Live Hints]';
  }

  setLevel(level) {
    this.level = LOG_LEVELS[level] ?? LOG_LEVELS.INFO;
  }

  setDebugMode(enabled) {
    this.level = enabled ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;
  }

  formatMessage(level, module, message) {
    const timestamp = new Date().toLocaleTimeString('ru-RU');
    return `[${timestamp}] [${level}]${module ? ` [${module}]` : ''} ${message}`;
  }

  debug(module, message, ...args) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      console.debug(this.formatMessage('DEBUG', module, message), ...args);
    }
  }

  info(module, message, ...args) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.info(this.formatMessage('INFO', module, message), ...args);
    }
  }

  warn(module, message, ...args) {
    if (this.level <= LOG_LEVELS.WARN) {
      console.warn(this.formatMessage('WARN', module, message), ...args);
    }
  }

  error(module, message, ...args) {
    if (this.level <= LOG_LEVELS.ERROR) {
      console.error(this.formatMessage('ERROR', module, message), ...args);
    }
  }

  // Специальные методы для метрик производительности
  metric(name, value) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      console.debug(this.formatMessage('METRIC', null, `${name}: ${value}`));
    }
  }
}

export const logger = new Logger();
export { LOG_LEVELS };
