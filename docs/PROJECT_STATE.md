# Состояние проекта Live Hints

Дата: 2026-08-21

## Общая информация

- **Версия**: 1.0.1
- **Статус**: Публичный выпуск с локальными STT и LLM
- **Последнее обновление**: Устранены уязвимые зависимости и подготовлен выпуск 1.0.1

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
│   ├── advanced_rag.py        # Advanced RAG с резервным локальным хранилищем
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

### Интерфейс (JavaScript/Electron)

| Компонент              | Статус      | Примечание                                  |
| ---------------------- | ----------- | ------------------------------------------- |
| Тема Shadow Assistant  | Реализовано | Тёмная тема с янтарными акцентами           |
| Система оформления CSS | Реализовано | tokens.css, animations.css, components.css  |
| Модули ui-new          | Реализовано | animation-engine, state-manager, components |
| Модули ui/             | Реализовано | Устаревшие, требуют миграции                |
| Модули app/            | Реализовано | app-settings, app-models, app-vision        |
| Первичная настройка    | Реализовано | Полный редизайн                             |
| История и сеансы       | Реализовано | Сохранение и загрузка сеансов               |
| Настройки              | Реализовано | Настройки провайдеров                       |
| Анализ изображений     | Реализовано | Скриншоты и анализ                          |

### Серверная часть Python

| Компонент          | Статус      | Примечание                        |
| ------------------ | ----------- | --------------------------------- |
| STT-сервер         | Реализовано | WebSocket, faster-whisper         |
| LLM-сервер         | Реализовано | FastAPI, Ollama, потоковая выдача |
| Сервер панели      | Реализовано | Аналитика                         |
| Кэширование        | Реализовано | LRU кэш + семантический кэш       |
| Классификация      | Реализовано | experience/technical/general      |
| RAG                | Ограничено  | Резервное хранилище без ChromaDB  |
| Анализ изображений | Реализовано | Модели Ollama Vision              |
| Метрики            | Реализовано | Измерение задержек                |

### Тестирование

| Тип                  | Статус   | Проверено             |
| -------------------- | -------- | --------------------- |
| Модульные Python     | Работает | 286 тестов            |
| Модульные JavaScript | Работает | 304 теста, 12 наборов |
| E2E Playwright       | Работает | 30 сценариев          |

## Метрики производительности

| Метрика              | Целевое | Фактическое | Статус |
| -------------------- | ------- | ----------- | ------ |
| Задержка STT         | < 1s    | ~300ms      | Норма  |
| TTFT LLM             | < 3s    | 2-3s        | Норма  |
| Полный ответ LLM     | < 25s   | 18-25s      | Норма  |
| Отрисовка интерфейса | 60 FPS  | 60 FPS      | Норма  |
| Память               | < 2GB   | ~1.8GB      | Норма  |

## Зависимости

### Python (requirements.txt)

- faster-whisper (STT)
- fastapi, uvicorn (LLM сервер)
- ollama (LLM клиент)
- sentence-transformers (семантический кэш)
- websockets (STT сервер)
- pyaudiowpatch (аудио захват)

### Node.js (package.json)

- electron (настольное приложение)
- jest (тестирование)
- playwright (E2E тесты)
- eslint, prettier (линтинг)

## Известные проблемы

1. **Совместимость GPU** — установленный PyTorch 2.5.1+cu121 не поддерживает RTX 5060 Ti с архитектурой `sm_120`
2. **Покрытие JavaScript** — требует расширения
3. **Модули интерфейса ui/** — устарели, требуют миграции на ui-new/

## Планы

- [ ] Расширить E2E-проверки основных пользовательских сценариев
- [ ] Настроить покрытие JavaScript
- [ ] Мигрировать оставшиеся модули ui/ на ui-new/
- [ ] Добавить интеграционные тесты
- [ ] Документация API

## Последние изменения

- Исключён уязвимый ChromaDB и принудительно отключена его инициализация
- Обновлён `requests` до исправленной версии 2.34.2
- Подготовлены установщик и portable-сборка 1.0.1
- Полный редизайн интерфейса (тема Shadow Assistant)
- Очистка мусорных файлов
- Перевод коммитов на русский язык
- Расширено модульное тестирование Python
- Обновление README.md
