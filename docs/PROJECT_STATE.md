# Состояние проекта Live Hints

Дата: 2025-02-01

## Общая информация

- **Версия**: 1.0.0
- **Статус**: Рабочий прототип с редизайном Shadow Assistant
- **Последнее обновление**: Полный редизайн UI, очистка мусорных файлов

## Архитектура

### Структура проекта

```
live-hints/
├── main/                       # Главный процесс Electron
│   └── main.js
├── preload.js                  # IPC мост
├── renderer/                   # UI процесс
│   ├── index.html             # Главное окно
│   ├── onboarding.html        # Онбординг
│   ├── app.js                 # Оркестрация
│   ├── onboarding.js          # Логика онбординга
│   ├── modules/               # JS модули
│   │   ├── audio-manager.js
│   │   ├── session-manager.js
│   │   ├── hint-manager.js
│   │   ├── ui/                # UI модули
│   │   │   ├── ui-elements.js
│   │   │   ├── ui-hints.js
│   │   │   ├── ui-transcript.js
│   │   │   ├── ui-modals.js
│   │   │   └── ui-utils.js
│   │   ├── app/               # App модули
│   │   │   ├── app-settings.js
│   │   │   ├── app-models.js
│   │   │   ├── app-stealth.js
│   │   │   ├── app-ipc.js
│   │   │   └── app-vision.js
│   │   ├── ui-new/            # Новые UI модули (Shadow Assistant)
│   │   │   ├── animation-engine.js
│   │   │   ├── state-manager.js
│   │   │   ├── components.js
│   │   │   ├── modal-manager.js
│   │   │   └── index.js
│   │   └── onboarding/        # Онбординг модули
│   │       ├── file-handler.js
│   │       └── audio-setup.js
│   └── styles/                # CSS Design System
│       ├── tokens.css
│       ├── animations.css
│       ├── components.css
│       ├── layout.css
│       ├── themes.css
│       └── app.css
├── python/                     # Python бэкенд
│   ├── stt_server.py          # WebSocket STT сервер
│   ├── llm_server.py          # HTTP LLM FastAPI сервер
│   ├── dashboard_server.py    # Аналитика
│   ├── stt/                   # STT модули
│   │   ├── __init__.py
│   │   ├── transcriber.py
│   │   └── latency.py
│   ├── llm/                   # LLM модули
│   │   ├── __init__.py
│   │   ├── ollama_client.py
│   │   ├── routes.py
│   │   ├── vision.py
│   │   └── gpu.py
│   ├── templates/
│   │   └── dashboard.html
│   ├── cache.py               # LRU кэш
│   ├── classification.py      # Классификация вопросов
│   ├── prompts.py             # Системные промпты
│   ├── metrics.py             # Метрики производительности
│   ├── rag.py                 # RAG
│   ├── advanced_rag.py        # Advanced RAG с ChromaDB
│   ├── semantic_cache.py      # Семантический кэш
│   ├── vector_db.py           # Vector DB
│   ├── audio_capture.py       # WASAPI loopback
│   ├── mic_capture.py         # Захват микрофона
│   ├── device_monitor.py      # Мониторинг устройств
│   ├── dynamic_audio_capture.py
│   └── requirements.txt
├── tests/                      # Тесты
│   ├── unit/                  # Python unit тесты
│   ├── e2e/                   # Playwright E2E тесты
│   └── conftest.py
├── docs/                       # Документация
│   ├── PROMPTS.md
│   └── TEST_REPORT.md
├── .windsurf/                  # Конфигурация Windsurf
│   ├── rules/                 # Правила разработки
│   │   ├── architecture.md
│   │   ├── code-style.md
│   │   ├── electron-specific.md
│   │   ├── git-workflow.md
│   │   ├── global.md
│   │   ├── memory-management.md
│   │   ├── performance.md
│   │   ├── python-servers.md
│   │   ├── safety-rules.md
│   │   ├── smoke-test.md
│   │   ├── structure.md
│   │   └── testing.md
│   ├── skills/                # Навыки AI
│   └── workflows/             # Рабочие процессы
├── data/                       # Данные приложения
├── scripts/                    # Скрипты
├── package.json
└── README.md
```

## Статус компонентов

### UI (JavaScript/Electron)

| Компонент | Статус | Примечание |
|-----------|--------|------------|
| Shadow Assistant тема | Реализовано | Темная тема с янтарными акцентами |
| CSS Design System | Реализовано | tokens.css, animations.css, components.css |
| Модули ui-new | Реализовано | animation-engine, state-manager, components |
| Модули ui/ | Реализовано | Устаревшие, требуют миграции |
| Модули app/ | Реализовано | app-settings, app-models, app-vision |
| Onboarding | Реализовано | Полный редизайн |
| History/Sessions | Реализовано | Сохранение/загрузка сессий |
| Settings | Реализовано | Настройки провайдеров |
| Vision AI | Реализовано | Скриншоты и анализ |

### Python Backend

| Компонент | Статус | Примечание |
|-----------|--------|------------|
| STT Server | Реализовано | WebSocket, faster-whisper |
| LLM Server | Реализовано | FastAPI, Ollama, streaming |
| Dashboard Server | Реализовано | Аналитика |
| Кэширование | Реализовано | LRU кэш + семантический кэш |
| Классификация | Реализовано | experience/technical/general |
| RAG | Реализовано | ChromaDB |
| Vision | Реализовано | Ollama vision models |
| Metrics | Реализовано | Latency tracking |

### Тестирование

| Тип | Статус | Покрытие |
|-----|--------|----------|
| Python Unit | Работает | 200+ тестов, 13 модулей 100% |
| JavaScript Unit | Работает | Jest |
| E2E Playwright | Частично | Onboarding работает, Main UI в процессе |

## Метрики производительности

| Метрика | Целевое | Фактическое | Статус |
|---------|---------|-------------|--------|
| STT латентность | < 1s | ~300ms | OK |
| LLM TTFT | < 3s | 2-3s | OK |
| LLM total | < 25s | 18-25s | OK |
| UI рендеринг | 60 FPS | 60 FPS | OK |
| Память | < 2GB | ~1.8GB | OK |

## Зависимости

### Python (requirements.txt)

- faster-whisper (STT)
- fastapi, uvicorn (LLM сервер)
- ollama (LLM клиент)
- chromadb (RAG)
- sentence-transformers (семантический кэш)
- websockets (STT сервер)
- pyaudiowpatch (аудио захват)

### Node.js (package.json)

- electron (desktop app)
- jest (тестирование)
- playwright (E2E тесты)
- eslint, prettier (линтинг)

## Известные проблемы

1. **E2E тесты Main UI** — не все тесты проходят
2. **JavaScript покрытие** — требует настройки
3. **UI модули ui/** — устарели, требуют миграции на ui-new/

## TODO

- [ ] Добавить тесты для Main UI E2E
- [ ] Настроить JavaScript coverage
- [ ] Мигрировать оставшиеся модули ui/ на ui-new/
- [ ] Добавить интеграционные тесты
- [ ] Документация API

## Последние изменения

- Полный редизайн UI (Shadow Assistant тема)
- Очистка мусорных файлов
- Перевод коммитов на русский язык
- Python покрытие 100% для 13 модулей
- Обновление README.md
