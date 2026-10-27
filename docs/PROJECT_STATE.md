# Состояние проекта Live Hints

## Текущее состояние (выпуск v1.5.6)

Проверено: 2026-10-28T00:53:00+07:00, Windows 11, PowerShell, локальный репозиторий.
Ветка: `dev_project_readiness_shev`.
Версия: `1.5.6`.

### Выполненные фазы плана доведения до выпуска

- **Фаза 0 — Изоляция тестовой среды:**
  - В `main.js` внедрено перенаправление `app.setPath('userData', ...)` и `new Store({ cwd: app.getPath('userData') })` в изолированную временную директорию при `NODE_ENV === 'test'` или заданной переменной `LIVE_HINTS_USER_DATA_DIR`.
  - В `main/process-manager.js` отключён запуск физических WASAPI-процессов захвата звука при `LIVE_HINTS_SYNTHETIC_AUDIO === '1'` или в тестовом окружении без `LIVE_HINTS_REAL_AUDIO === '1'`.
- **Фаза 1 — Честное покрытие >= 85%, статический анализ и CI-гейты:**
  - Очищен `.coveragerc` от искусственных исключений строк обработки ошибок.
  - В `jest.config.js` включено покрытие `main/**/*.js` и задан обязательный порог 85% по выражениям (`statements`) и строкам (`lines`).
  - Устранены все ошибки и предупреждения линтеров и типизации: `npm run lint` (0 ошибок, 0 предупреждений), `ruff check python tests` (0 ошибок), `mypy python --ignore-missing-imports` (0 ошибок в 26 исходных файлах).
  - Расширены модульные тесты (`tests/unit/test_coverage_boost.py`, `tests/unit/coverage-boost-js.test.js`):
    - Python (`pytest tests/unit --cov=python`): **319 тестов пройдено, общее покрытие 88%**;
    - JavaScript (`npm test`): **14 наборов, 315 тестов пройдено, покрытие 86.99% statements / 90.3% lines**.
  - Обновлён `.github/workflows/ci.yml`: добавлены обязательные шаги `ruff check`, `mypy` и `pytest --cov=python --cov-fail-under=85`.
- **Фаза 2 — Сквозная E2E-верификация (Playwright):**
  - В `tests/e2e/app.spec.js` и `tests/e2e/full-ui-audit.spec.js` настроены временные изолированные профили `LIVE_HINTS_USER_DATA_DIR` и `LIVE_HINTS_SYNTHETIC_AUDIO=1`, удалены `test.skip()` и комментарии-заглушки.
  - Прогон `npx playwright test` с живым локальным сервером LLM и Ollama: **35 из 35 E2E-тестов пройдено**.
- **Фаза 3 — Выравнивание версий и упаковка v1.5.6:**
  - Версия синхронизирована до `1.5.6` в `package.json`, `package-lock.json`, `site/index.html`, `README.md`, `docs/changelog.md` и `docs/releases/v1.5.6.md`.
  - Собраны артефакты Windows (`dist/Live.Hints.Setup.1.5.6.exe`, SHA-256: `7df573be07dd0dcabe7c0425a6fab9af90115bb86f927b4dd8d3b82fdd396d1a` и `dist/LiveHints-Portable-1.5.6.exe`, SHA-256: `913a657b6468bec0eb8f3ab26c3d503d77f817a6016b140f0bbc81fec81bd5c0`) и сформирован файл контрольных сумм `dist/SHA256SUMS.txt`.

## Общая информация

- **Версия**: 1.5.6
- **Статус**: Проверенный выпуск с локальными STT и LLM
- **Последнее обновление**: Выравнивание версии 1.5.6, изоляция тестов и доведение честного покрытия до >= 85%

## Архитектура

### Структура проекта

```
live-hints/
├── main.js                     # Точка входа главного процесса Electron
├── main/                       # Модули главного процесса Electron
│   ├── ipc-handlers.js
│   ├── process-manager.js
│   ├── stealth-manager.js
│   └── window-manager.js
├── preload.js                  # IPC мост главного окна
├── preload-onboarding.js       # IPC мост окна онбординга
├── renderer/                   # UI процесс
│   ├── index.html              # Главное окно
│   ├── onboarding.html         # Онбординг
│   ├── app.js                  # Оркестрация
│   ├── onboarding.js           # Логика онбординга
│   ├── modules/                # JS модули
│   │   ├── audio-manager.js
│   │   ├── session-manager.js
│   │   ├── hint-manager.js
│   │   ├── ui-controller.js
│   │   ├── ui/                 # UI модули
│   │   │   ├── ui-elements.js
│   │   │   ├── ui-hints.js
│   │   │   ├── ui-transcript.js
│   │   │   ├── ui-modals.js
│   │   │   └── ui-utils.js
│   │   ├── app/                # App модули
│   │   │   ├── app-settings.js
│   │   │   ├── app-models.js
│   │   │   ├── app-stealth.js
│   │   │   ├── app-ipc.js
│   │   │   └── app-vision.js
│   │   ├── ui-new/             # Модули Shadow Assistant
│   │   │   ├── animation-engine.js
│   │   │   ├── state-manager.js
│   │   │   ├── components.js
│   │   │   ├── modal-manager.js
│   │   │   └── index.js
│   │   └── onboarding/         # Онбординг модули
│   │       ├── file-handler.js
│   │       └── audio-setup.js
│   └── styles/                 # CSS Design System
│       ├── tokens.css
│       ├── animations.css
│       ├── components.css
│       ├── layout.css
│       ├── themes.css
│       └── app.css
├── python/                     # Python бэкенд
│   ├── launcher.py             # Оркестратор сервисов
│   ├── stt_server.py           # WebSocket STT сервер
│   ├── llm_server.py           # HTTP LLM FastAPI сервер
│   ├── dashboard_server.py     # Аналитика
│   ├── stt/                    # STT модули
│   │   ├── __init__.py
│   │   ├── transcriber.py
│   │   └── latency.py
│   ├── llm/                    # LLM модули
│   │   ├── __init__.py
│   │   ├── ollama_client.py
│   │   ├── provider.py
│   │   ├── routes.py
│   │   ├── vision.py
│   │   └── gpu.py
│   ├── templates/
│   │   └── dashboard.html
│   ├── cache.py                # LRU кэш
│   ├── classification.py       # Классификация вопросов
│   ├── prompts.py              # Системные промпты
│   ├── metrics.py              # Метрики производительности
│   ├── rag.py                  # RAG
│   ├── advanced_rag.py         # Advanced RAG с резервным локальным хранилищем
│   ├── semantic_cache.py       # Семантический кэш
│   ├── vector_db.py            # Vector DB
│   ├── audio_capture.py        # WASAPI loopback
│   ├── mic_capture.py          # Захват микрофона
│   ├── device_monitor.py       # Мониторинг устройств
│   ├── dynamic_audio_capture.py
│   └── requirements.txt
├── site/                       # Промо-лендинг (GitHub Pages)
├── tests/                      # Тесты
│   ├── unit/                   # Модульные тесты Python и JavaScript
│   ├── integration/            # Интеграционные тесты
│   ├── perf/                   # Тесты производительности
│   ├── e2e/                    # Playwright E2E тесты
│   └── conftest.py
├── docs/                       # Документация
│   ├── changelog.md
│   ├── PROJECT_STATE.md
│   └── releases/
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
| Модули ui/             | Реализовано | Покрыты модульными тестами                  |
| Модули app/            | Реализовано | app-settings, app-models, app-vision        |
| Первичная настройка    | Реализовано | Полный редизайн                             |
| История и сеансы       | Реализовано | Сохранение, загрузка и экспорт в Markdown   |
| Настройки              | Реализовано | Выбор модели Ollama, устройств, контекста   |
| Анализ изображений     | Реализовано | Скриншоты и анализ через Ollama Vision      |

### Серверная часть Python

| Компонент          | Статус      | Примечание                        |
| ------------------ | ----------- | --------------------------------- |
| STT-сервер         | Реализовано | WebSocket, faster-whisper         |
| LLM-сервер         | Реализовано | FastAPI, Ollama, потоковая выдача |
| Сервер панели      | Реализовано | Аналитика                         |
| Кэширование        | Реализовано | LRU кэш + семантический кэш       |
| Классификация      | Реализовано | experience/technical/general      |
| RAG                | Реализовано | Локальное хранилище без ChromaDB  |
| Анализ изображений | Реализовано | Модели Ollama Vision              |
| Метрики            | Реализовано | Измерение задержек                |

### Тестирование и качество

| Проверка             | Статус   | Результат                                           |
| -------------------- | -------- | --------------------------------------------------- |
| Модульные Python     | Работает | 319 тестов, покрытие 88%                            |
| Модульные JavaScript | Работает | 315 тестов (14 наборов), 86.99% stmts / 90.3% lines |
| E2E Playwright       | Работает | 35 сценариев (100% прохождение)                     |
| Линтер ESLint        | Работает | 0 ошибок, 0 предупреждений                          |
| Линтер Ruff          | Работает | 0 ошибок                                            |
| Типизация Mypy       | Работает | 0 ошибок (26 исходных файлов)                       |

## Метрики производительности

| Метрика              | Целевое | Фактическое | Статус |
| -------------------- | ------- | ----------- | ------ |
| Задержка STT         | < 1s    | ~300ms      | Норма  |
| TTFT LLM             | < 3s    | 2-3s        | Норма  |
| Полный ответ LLM     | < 25s   | 18-25s      | Норма  |
| Отрисовка интерфейса | 60 FPS  | 60 FPS      | Норма  |
| Память               | < 2GB   | ~1.8GB      | Норма  |
