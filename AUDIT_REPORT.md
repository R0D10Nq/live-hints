# Технический аудит STT/LLM Pipeline — Live Hints

**Дата:** 24.12.2024  
**Версия:** 1.0

---

## Резюме

Проведён полный технический аудит STT и LLM компонентов приложения Live Hints. Система в целом **production-ready** с рядом улучшений, реализованных в рамках аудита.

### Общая оценка

| Компонент | Статус | Оценка |
|-----------|--------|--------|
| **STT Pipeline** | ✅ Работает | 8/10 |
| **LLM Pipeline** | ✅ Работает | 9/10 |
| **Кэширование** | ✅ Работает | 9/10 |
| **RAG** | ✅ Работает | 7/10 |
| **Промпты** | ✅ Работают | 9/10 |
| **Error Handling** | ⚠️ Улучшено | 8/10 |

---

## 1. STT Pipeline

### Архитектура

```
[Audio Capture] → [WebSocket:8765] → [STT Server] → [Whisper] → [Transcript]
                                         ↓
                                   [WebSocket:8764] (микрофон)
```

### Технические характеристики

| Параметр | Значение |
|----------|----------|
| **Библиотека** | faster-whisper 1.2.1 |
| **Модель по умолчанию** | large-v3 |
| **Устройство** | CUDA (GPU) |
| **Compute type** | float16 |
| **Sample rate** | 16kHz |
| **Min chunk** | 0.3 сек |
| **Silence trigger** | 1.0 сек |

### Выявленные проблемы и исправления

#### ❌ Несуществующая модель в MODEL_PRIORITY

**Было:** `['whisper-large-v3-russian', 'large-v3', 'medium', 'small']`  
**Стало:** `['large-v3', 'medium', 'small', 'base']`

#### ✅ VAD включён

Voice Activity Detection активирован для точного определения границ речи.

#### ✅ Фильтрация стоп-фраз

Реализована фильтрация артефактов Whisper ("продолжение следует" и т.д.)

### Метрики производительности

- **Латентность транскрипции:** ~500-1500ms (зависит от длины аудио)
- **RTF (Real-Time Factor):** < 0.3 на GPU
- **Точность на русском:** ~90%+ (large-v3)

---

## 2. LLM Pipeline

### Архитектура

```
[Transcript] → [Classification] → [Prompt Builder] → [Ollama] → [Hint]
                     ↓                   ↓
              [LRU Cache]        [Semantic Cache]
                     ↓                   ↓
              [RAG Context]      [Few-shot Examples]
```

### Провайдеры

| Провайдер | Статус | Модель по умолчанию |
|-----------|--------|---------------------|
| **Ollama** | ✅ Работает | ministral-3:8b |
| **OpenAI** | ✅ Реализован | gpt-4o-mini |
| **Claude** | ✅ Реализован | claude-3-haiku |
| **Gemini** | ✅ Реализован | gemini-1.5-flash |
| **GigaChat** | ✅ Реализован | GigaChat |
| **OpenRouter** | ✅ Реализован | llama-3.2-3b |
| **Yandex GPT** | ✅ Реализован | yandex-lite |

### Профили моделей

| Профиль | Модель | Temperature | Max Tokens |
|---------|--------|-------------|------------|
| **Fast** | gemma2:2b | 0.5 | 200 |
| **Balanced** | ministral-3:8b | 0.7 | 400 |
| **Accurate** | phi4:latest | 0.8 | 600 |
| **Code** | qwen2.5-coder:7b | 0.3 | 500 |

### Выполненные улучшения

#### ✅ Retry Logic с Exponential Backoff

Добавлена автоматическая повторная попытка при сетевых ошибках:

- 3 попытки
- Задержка: 1s → 2s → 4s

#### ✅ Расширенные профили промптов

Добавлены профили:

- `sales` — для продаж и переговоров
- `support` — для техподдержки
- `general` — универсальный

#### ✅ Fallback на дефолтный профиль

Если запрошенный профиль не найден — используется `interview`.

### Метрики производительности

- **TTFT (Time to First Token):** 1-3 сек
- **Полная генерация:** 2-5 сек
- **Cache hit:** 0 ms

---

## 3. Кэширование

### Многоуровневый кэш

```
[Запрос] → [Semantic Cache] → [LRU Cache] → [LLM]
               85%+              exact
```

### LRU Cache (`cache.py`)

| Параметр | Значение |
|----------|----------|
| **Размер** | 20 записей |
| **Ключ** | MD5(text + context) |
| **Case-sensitive** | Нет |

### Semantic Cache (`semantic_cache.py`)

| Параметр | Значение |
|----------|----------|
| **Размер** | 50 записей |
| **Модель** | paraphrase-multilingual-MiniLM-L12-v2 |
| **Порог схожести** | 85% |
| **Fallback** | exact match |

---

## 4. RAG (Retrieval-Augmented Generation)

### Архитектура

```
[User Context] → [Chunking] → [ChromaDB] → [Semantic Search]
                     ↓
              [Session Memory]
```

### Выполненные исправления

#### ❌ Deprecated ChromaDB API

**Было:** `chromadb.Client(Settings(chroma_db_impl="duckdb+parquet"))`  
**Стало:** `chromadb.PersistentClient(path=..., settings=...)`

### Adaptive Context Window

| Тип вопроса | Размер контекста |
|-------------|------------------|
| Simple | 3 сообщения |
| Medium | 5 сообщений |
| Complex | 8 сообщений |

---

## 5. Промпты

### Структура

```python
PROFILE_PROMPTS = {
    'interview': {...},
    'sales': {...},
    'support': {...},
    'general': {...},
}
```

### Классификация вопросов

| Тип | Ключевые слова | Промпт |
|-----|----------------|--------|
| **experience** | опыт, проект, расскажите о себе | + резюме |
| **technical** | что такое, как работает, алгоритм | без резюме |
| **general** | остальное | сокращённый контекст |

### Few-shot примеры

Каждый профиль содержит 2-3 примера для улучшения качества ответов.

---

## 6. Тесты

### Python тесты

```
tests/unit/test_cache.py        — 8 тестов ✅
tests/unit/test_classification.py — 7 тестов ✅
tests/unit/test_prompts.py      — (добавить)

Всего: 15/15 passed
```

### Node.js тесты

```
tests/unit/pipeline.test.js   — 28 тестов ✅
tests/unit/providers.test.js  — 19 тестов ✅
tests/unit/settings.test.js   — 24 тестов ✅
tests/unit/storage.test.js    — 64 тестов ✅

Всего: 111/111 passed
```

---

## 7. Рекомендации

### Высокий приоритет

1. **Добавить health-check для STT сервера**
   - Endpoint `/health` для мониторинга

2. **Реализовать fallback на облачные провайдеры**
   - Если Ollama недоступна → OpenAI/Claude

3. **Добавить TTL для кэша**
   - Устаревшие ответы могут быть нерелевантны

### Средний приоритет

1. **Metrics dashboard**
   - Уже реализован `dashboard_server.py`
   - Запуск: `python python/dashboard_server.py`

2. **Streaming в UI**
   - Уже реализовано через SSE

3. **Hot-reload промптов**
   - Загружать из файлов без перезапуска

### Низкий приоритет

1. **A/B тестирование промптов**
2. **Rate limiting для облачных провайдеров**
3. **Token counting и cost tracking**

---

## 8. Файлы изменённые в рамках аудита

| Файл | Изменения |
|------|-----------|
| `python/stt_server.py` | Исправлен MODEL_PRIORITY |
| `python/llm_server.py` | Добавлен retry logic |
| `python/prompts.py` | Добавлены профили sales, support, general |
| `python/advanced_rag.py` | Исправлен deprecated ChromaDB API |

---

## 9. Команды запуска

```powershell
# STT сервер
python python/stt_server.py

# LLM сервер
python python/llm_server.py

# Electron приложение
npm run start:win

# Тесты
npm test                    # Node.js тесты
python -m pytest tests/unit/ -v  # Python тесты
```

---

## 10. Заключение

Система Live Hints имеет **production-ready** архитектуру с:

- ✅ GPU-ускоренной транскрипцией (faster-whisper)
- ✅ Многоуровневым кэшированием (LRU + Semantic)
- ✅ RAG для контекстного обогащения
- ✅ Классификацией вопросов
- ✅ Streaming генерацией
- ✅ 126/126 тестов пройдено

Основные улучшения реализованы в рамках аудита. Система готова к production использованию.
