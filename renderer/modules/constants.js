/**
 * Константы приложения Live Hints
 * Централизованное хранение всех magic numbers
 */

// Порты серверов
export const PORTS = {
  STT_SYSTEM: 8765,
  STT_MIC: 8764,
  LLM: 8766,
  DASHBOARD: 8767,
};

// URL серверов
export const SERVERS = {
  STT: `ws://localhost:${PORTS.STT_SYSTEM}`,
  STT_MIC: `ws://localhost:${PORTS.STT_MIC}`,
  LLM: `http://localhost:${PORTS.LLM}`,
  DASHBOARD: `http://localhost:${PORTS.DASHBOARD}`,
};

// Таймауты (мс)
export const TIMEOUTS = {
  STT_CONNECTION: 30000,
  LLM_REQUEST: 60000,
  WEBSOCKET_RECONNECT: 5000,
  TOAST_DURATION: 3000,
  ERROR_TOAST_DURATION: 5000,
  REMOTE_TEST: 3000,
};

// Настройки контекста
export const CONTEXT = {
  WINDOW_SIZE_DEFAULT: 20,
  WINDOW_SIZE_MIN: 5,
  WINDOW_SIZE_MAX: 20,
  MAX_CHARS_DEFAULT: 6000,
  MAX_CHARS_MIN: 2000,
  MAX_CHARS_MAX: 6000,
};

// Настройки LLM
export const LLM = {
  MAX_TOKENS_DEFAULT: 500,
  MAX_TOKENS_MIN: 50,
  MAX_TOKENS_MAX: 500,
  TEMPERATURE_DEFAULT: 0.8,
  TEMPERATURE_MIN: 0.0,
  TEMPERATURE_MAX: 1.0,
};

// Лимиты хранения
export const STORAGE = {
  MAX_SESSIONS: 999,
  MAX_PROMPT_LENGTH: 4000,
};

// Профили LLM
export const PROFILES = ['fast', 'balanced', 'accurate', 'code'];

// Типы вопросов
export const QUESTION_TYPE_LABELS = {
  technical: 'Технический',
  experience: 'Опыт',
  general: 'Общий',
};

// Статусы приложения
export const STATUS_CONFIG = {
  idle: { class: 'status-idle', text: 'Готов' },
  listening: { class: 'status-listening', text: 'Слушаю...' },
  paused: { class: 'status-paused', text: 'Приостановлено' },
  error: { class: 'status-error', text: 'Ошибка' },
};

// Системные промпты
export const SYSTEM_PROMPTS = {
  job_interview_ru: `Ты помощник на собеседовании. Давай краткие, полезные подсказки по техническим вопросам. Отвечай на русском, кратко и по делу.

Ассистент должен отвечать от имени кандидата, придерживаясь единого потока речи; избегать точек между предложениями, когда это возможно. Максимальное разделение — абзацами при смене мысли; преимущественно использовать запятые и переносы строк для выделения тем, имитируя живую речь.

- Все ответы формулируются на русском языке
- Англицизмы запрещены
- Допускается только разговорный стиль; избегать шаблонных и штампованных фраз
- Проявлять живость, непринужденность, использовать обороты, характерные для устной речи
- Не разрешается дословное повторение одной и той же фразы в похожих ответах

Структура ответа:
- Первая мысль — краткая вводная
- Далее описывать логику или шаги через запятую, всё в едином потоке
- Итоговая фраза

Запрещено упоминать «как ИИ» или «как модель». Не придумывать вымышленных деталей.`,

  default_fallback: 'Ты ассистент. Дай краткий ответ по контексту разговора на русском.',
};
