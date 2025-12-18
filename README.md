# Live Hints

Windows desktop overlay для транскрипции системного звука и генерации подсказок в реальном времени.

## Возможности

- **Захват системного аудио** через WASAPI loopback (голос собеседника из звонка)
- **Realtime транскрипция** через faster-whisper (локально на GPU)
- **Генерация подсказок** через LLM (Ollama локально или облачные провайдеры)
- **Always-on-top overlay** — компактное окно поверх всех приложений
- **История сессий** — сохранение транскриптов и подсказок

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
ollama pull qwen2.5:7b

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

| Провайдер | Переменные окружения | Где получить |
|-----------|---------------------|--------------|
| **OpenAI** | `OPENAI_API_KEY` | platform.openai.com |
| **Gemini** | `GEMINI_API_KEY` | aistudio.google.com |
| **Claude (Anthropic)** | `ANTHROPIC_API_KEY` | console.anthropic.com |
| **OpenRouter** | `OPENROUTER_API_KEY` | openrouter.ai |

### Российские провайдеры

| Провайдер | Переменные окружения | Где получить |
|-----------|---------------------|--------------|
| **GigaChat Free** | `GIGACHAT_CLIENT_ID`, `GIGACHAT_CLIENT_SECRET` | developers.sber.ru |
| **GigaChat Max** | `GIGACHAT_CLIENT_ID`, `GIGACHAT_CLIENT_SECRET` | developers.sber.ru |
| **Yandex Lite** | `YANDEX_API_KEY`, `YANDEX_FOLDER_ID` | console.cloud.yandex.ru |
| **Yandex Pro** | `YANDEX_API_KEY`, `YANDEX_FOLDER_ID` | console.cloud.yandex.ru |

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
├── main.js                 # Electron main process
├── preload.js              # Preload script (IPC bridge)
├── renderer/               # UI
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── src/
│   ├── storage/            # Хранилище сессий
│   │   └── session-store.js
│   ├── pipeline/           # Оркестрация пайплайна
│   │   └── hint-pipeline.js
│   └── llm/                # LLM провайдеры
│       └── providers.js
├── python/
│   ├── requirements.txt
│   ├── stt_server.py       # WebSocket STT сервер
│   ├── llm_server.py       # HTTP LLM сервер
│   └── audio_capture.py    # WASAPI loopback захват
├── tests/
│   ├── unit/               # Jest unit тесты
│   └── e2e/                # Playwright E2E тесты
├── jest.config.js
├── playwright.config.js
└── package.json
```

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
