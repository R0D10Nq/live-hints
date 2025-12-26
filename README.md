# Live Hints

Windows desktop overlay для транскрипции системного звука и генерации AI-подсказок на собеседованиях в реальном времени.

## Возможности

- **Захват системного аудио** через WASAPI loopback (голос собеседника из звонка)
- **Realtime транскрипция** через faster-whisper distil-large-v3 (локально на GPU)
- **Streaming генерация подсказок** через LLM (Ollama) с TTFT 2-3 секунды
- **Markdown рендеринг** подсказок (жирный текст, списки, код)
- **Классификация вопросов** — experience / technical / general
- **LRU кэш подсказок** — мгновенные ответы на повторные вопросы
- **Always-on-top overlay** — компактное окно поверх всех приложений
- **История сессий** — сохранение транскриптов и подсказок

## Метрики производительности

| Метрика              | Значение                 |
| -------------------- | ------------------------ |
| STT латентность      | ~300ms (distil-large-v3) |
| LLM TTFT             | 2-3s (streaming)         |
| LLM total            | 18-25s                   |
| End-to-end perceived | **3-4s**                 |

## Требования

### Системные

- Windows 10/11
- NVIDIA GPU с CUDA 12.x (обязательно для STT)
- Python 3.10+
- Node.js 18+

### Для локального режима

- [Ollama](https://ollama.ai/) — для локального LLM
- CUDA Toolkit 12.x + cuDNN 9.x (для GPU ускорения faster-whisper)

## Быстрый старт (GPU)

```powershell
# 1. Создайте venv и установите зависимости
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r python/requirements.txt

# 2. Установите Ollama и модель
# Скачайте с https://ollama.ai/, затем:
ollama pull model_name

# 3. Запустите серверы (3 терминала)
# Терминал 1:
.\venv\Scripts\python.exe python/stt_server.py

# Терминал 2:
.\venv\Scripts\python.exe python/llm_server.py

# Терминал 3:
npm start
```

## Установка

### 1. Клонирование и установка Node зависимостей

```bash
cd live-hints
npm install
```

### 2. Установка Python зависимостей

```bash
pip install -r python/requirements.txt
```

### 3. Установка Ollama (для локального LLM)

Скачайте и установите [Ollama](https://ollama.ai/), затем загрузите модель:

```bash
ollama pull llama3.2
```

## Запуск

### 1. Запустите Python серверы

В отдельных терминалах:

```bash
# STT сервер (faster-whisper)
python python/stt_server.py

# LLM сервер
python python/llm_server.py
```

### 2. Запустите Ollama (если используете локальный LLM)

```bash
ollama serve
```

### 3. Запустите приложение

```bash
npm start
```

## Использование

1. Нажмите **Старт** для начала записи
2. Системный звук (голос собеседника из звонка) будет транскрибироваться
3. На основе транскрипта LLM будет генерировать подсказки
4. Нажмите **Стоп** для завершения — сессия сохранится в историю

## LLM провайдеры

### Локально (по умолчанию)

- **Ollama** — полностью локальный, бесплатный, требует GPU для комфортной работы

### Облачные провайдеры

| Провайдер              | Переменные окружения | Где получить          |
| ---------------------- | -------------------- | --------------------- |
| **OpenAI**             | `OPENAI_API_KEY`     | platform.openai.com   |
| **Gemini**             | `GEMINI_API_KEY`     | aistudio.google.com   |
| **Claude (Anthropic)** | `ANTHROPIC_API_KEY`  | console.anthropic.com |
| **OpenRouter**         | `OPENROUTER_API_KEY` | openrouter.ai         |

### Российские провайдеры

| Провайдер         | Переменные окружения                           | Где получить            |
| ----------------- | ---------------------------------------------- | ----------------------- |
| **GigaChat Free** | `GIGACHAT_CLIENT_ID`, `GIGACHAT_CLIENT_SECRET` | developers.sber.ru      |
| **GigaChat Max**  | `GIGACHAT_CLIENT_ID`, `GIGACHAT_CLIENT_SECRET` | developers.sber.ru      |
| **Yandex Lite**   | `YANDEX_API_KEY`, `YANDEX_FOLDER_ID`           | console.cloud.yandex.ru |
| **Yandex Pro**    | `YANDEX_API_KEY`, `YANDEX_FOLDER_ID`           | console.cloud.yandex.ru |

### Настройка переменных окружения

```powershell
# OpenAI
$env:OPENAI_API_KEY = "sk-..."

# Gemini
$env:GEMINI_API_KEY = "..."

# Claude (Anthropic)
$env:ANTHROPIC_API_KEY = "sk-ant-..."

# OpenRouter
$env:OPENROUTER_API_KEY = "sk-or-..."

# GigaChat (Сбер)
$env:GIGACHAT_CLIENT_ID = "..."
$env:GIGACHAT_CLIENT_SECRET = "..."

# Yandex GPT
$env:YANDEX_API_KEY = "..."
$env:YANDEX_FOLDER_ID = "..."
```

## AI Профили

- **Job interview (RU)** — короткие подсказки 1-3 пункта для собеседований
- **Custom** — пользовательские инструкции для AI

## Режим работы

- **Кнопка "Получить ответ"** — запрос подсказки по накопленному транскрипту
- **Авто-подсказки** — автоматическая генерация подсказок после каждой фразы

## Хоткеи

- `Ctrl+Enter` — получить подсказку
- `Ctrl+/` — показать/скрыть overlay
- `Ctrl+Arrow` — переместить окно

## Тестирование

### Unit тесты

```bash
npm test
```

### E2E тесты (Playwright)

```bash
npm run test:e2e
```

## Структура проекта

```text
live-hints/
├── main.js                     # Electron main process
├── preload.js                  # Preload script (IPC bridge)
├── renderer/
│   ├── index.html              # Главное окно
│   ├── onboarding.html         # Онбординг
│   ├── app.js                  # Оркестрация UI (295 строк)
│   ├── onboarding.js           # Логика онбординга (235 строк)
│   └── modules/
│       ├── audio-manager.js    # WebSocket STT, микрофон
│       ├── session-manager.js  # Сохранение/загрузка сессий
│       ├── hint-manager.js     # LLM запросы
│       ├── ui-controller.js    # DOM оркестрация (280 строк)
│       ├── ui/                 # UI модули
│       │   ├── ui-elements.js  # Кэш DOM элементов
│       │   ├── ui-hints.js     # Пагинация подсказок
│       │   ├── ui-transcript.js # Сайдбар транскриптов
│       │   ├── ui-modals.js    # Модальные окна
│       │   └── ui-utils.js     # Toast, markdown, escape
│       ├── app/                # App модули
│       │   ├── app-settings.js # Загрузка/сохранение настроек
│       │   ├── app-models.js   # Управление моделями Ollama
│       │   ├── app-stealth.js  # Stealth режим
│       │   ├── app-ipc.js      # IPC обработчики
│       │   └── app-vision.js   # Vision AI скриншоты
│       └── onboarding/         # Онбординг модули
│           ├── file-handler.js # Загрузка файлов
│           └── audio-setup.js  # Микрофон, VU meter
├── python/
│   ├── stt_server.py           # WebSocket STT (147 строк)
│   ├── llm_server.py           # HTTP LLM FastAPI (391 строк)
│   ├── dashboard_server.py     # Аналитика (180 строк)
│   ├── stt/                    # STT модули
│   │   ├── transcriber.py      # StreamingTranscriber
│   │   └── latency.py          # LatencyMetrics
│   ├── llm/                    # LLM модули
│   │   ├── ollama_client.py    # OllamaClient, streaming
│   │   ├── vision.py           # Vision AI
│   │   └── gpu.py              # GPU check
│   ├── templates/
│   │   └── dashboard.html      # Dashboard шаблон
│   ├── cache.py                # LRU кэш подсказок
│   ├── classification.py       # Классификация вопросов
│   ├── prompts.py              # Системные промпты
│   ├── advanced_rag.py         # RAG с ChromaDB
│   └── audio_capture.py        # WASAPI loopback
├── tests/
│   ├── unit/                   # Unit тесты (37 passed)
│   ├── integration/            # Интеграционные тесты
│   └── e2e/                    # Playwright E2E
└── package.json
```

> **Рефакторинг завершён**: все файлы < 500 строк, монолиты разбиты на модули.

## Чеклист ручной проверки

### Базовая функциональность

- [ ] Приложение запускается (`npm start`)
- [ ] Окно появляется поверх всех приложений
- [ ] Окно можно перетаскивать за заголовок
- [ ] Кнопки Свернуть/Закрыть работают

### Запись и транскрипция

- [ ] Кнопка Старт меняется на Стоп
- [ ] Статус меняется на "Слушаю..."
- [ ] При воспроизведении звука появляется транскрипт
- [ ] Кнопка Стоп возвращает статус "Приостановлено"

### Подсказки

- [ ] После транскрипта появляются подсказки
- [ ] Подсказки релевантны контексту
- [ ] Смена провайдера работает

### История

- [ ] История открывается по кнопке
- [ ] Сессии сохраняются после Стоп
- [ ] Можно просмотреть содержимое сессии

## Troubleshooting

### "Ollama не запущен"

Запустите `ollama serve` в терминале.

### "STT сервер недоступен"

Запустите `python python/stt_server.py`.

### Нет звука в транскрипте

- Убедитесь что звук воспроизводится через колонки/наушники
- Проверьте что pyaudiowpatch установлен: `pip install pyaudiowpatch`
- Попробуйте включить "Stereo Mix" в настройках звука Windows

### Медленная транскрипция

- Используйте GPU (CUDA): установите `pip install torch --index-url https://download.pytorch.org/whl/cu118`
- Уменьшите размер модели: в `stt_server.py` измените `MODEL_SIZE = 'tiny'`

## Лицензия

MIT
