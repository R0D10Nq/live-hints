# ТЕХНИЧЕСКИЙ АУДИТ STT/LLM PIPELINE — LIVE HINTS

**Дата:** 2025-12-24  
**Версия:** 1.0

---

## EXECUTIVE SUMMARY

| Компонент | Статус | Оценка |
|-----------|--------|--------|
| **STT Pipeline** | ✅ Работает | 8/10 |
| **LLM Pipeline** | ✅ Работает | 8/10 |
| **Кэширование** | ✅ Реализовано | 9/10 |
| **RAG система** | ✅ Реализовано | 7/10 |
| **Промпты** | ✅ Оптимизированы | 8/10 |
| **Провайдеры** | ⚠️ Частично | 6/10 |
| **Error Handling** | ⚠️ Базовый | 6/10 |

**Общая оценка: 7.4/10** — Система production-ready с возможностями для улучшения.

---

## 1. STT PIPELINE

### Архитектура

- **Библиотека:** `faster-whisper` 1.2.1 (CTranslate2)
- **Модель:** `large-v3` (fallback: `medium`, `small`)
- **Устройство:** CUDA GPU (RTX 5060 Ti 16GB)
- **Compute type:** float16
- **WebSocket порты:** 8765 (система), 8764 (микрофон)

### Параметры транскрипции

```python
MIN_CHUNK_SECONDS = 0.3   # Минимальный чанк
MAX_BUFFER_SECONDS = 5.0  # Максимальный буфер
SILENCE_THRESHOLD = 0.01  # RMS порог тишины
SILENCE_TRIGGER_SEC = 1.0 # Пауза для запуска
```

### ✅ Сильные стороны

1. **VAD фильтрация** включена (`vad_filter=True`)
2. **Фильтрация стоп-фраз** ("продолжение следует" и др.)
3. **Dual audio** — раздельные порты для системы/микрофона
4. **Метрики латентности** — логирование в `logs/metrics.jsonl`
5. **GPU-only режим** — максимальная производительность

### ⚠️ Найденные проблемы

#### P1: Некорректный MODEL_PRIORITY

```python
# stt_server.py:47
MODEL_PRIORITY = ['whisper-large-v3-russian', 'large-v3', 'medium', 'small']
```

**Проблема:** Модель `whisper-large-v3-russian` не существует в faster-whisper.  
**Решение:** Использовать `large-v3` как primary.

#### P2: Нет graceful degradation при GPU ошибке

**Проблема:** При недоступности GPU сервер падает.  
**Решение:** Добавить fallback на CPU с меньшей моделью.

### Рекомендации

- [ ] Исправить MODEL_PRIORITY
- [ ] Добавить CPU fallback
- [ ] Рассмотреть `distil-large-v3` для английского контента

---

## 2. LLM PIPELINE

### Архитектура

- **Сервер:** FastAPI (uvicorn) на порту 8766
- **Провайдер:** Ollama (localhost:11434)
- **Модель по умолчанию:** `ministral-3:8b`
- **Streaming:** Поддерживается через SSE

### Доступные модели (Ollama)

| Модель | Размер | Назначение |
|--------|--------|------------|
| qwen2.5:7b | 4.7GB | Общего назначения |
| ministral-3:8b | 6.0GB | Balanced (default) |
| phi4:latest | 9.0GB | Accurate |
| qwen2.5-coder:7b | 4.7GB | Code |
| llava:7b | 4.7GB | Vision |

### ✅ Сильные стороны

1. **Классификация вопросов** — experience/technical/general
2. **Few-shot примеры** — 3 готовых диалога
3. **Streaming** — SSE для progressive rendering
4. **Профили моделей** — fast/balanced/accurate/code
5. **Vision AI** — LLaVA интеграция для скриншотов

### ⚠️ Найденные проблемы

#### P1: Нет fallback между провайдерами

**Проблема:** Если Ollama недоступна, нет автоматического переключения на облачные провайдеры.  
**Текущее поведение:** Возвращает ошибку "Ollama не запущен".

#### P2: Отсутствует retry logic

**Проблема:** При timeout/connection error нет повторных попыток.

#### P3: Thinking models обработка

**Проблема:** Код пытается извлечь ответ из поля `thinking`, но логика сложная и может быть ненадёжной.

### Рекомендации

- [ ] Добавить провайдер fallback (Ollama → OpenAI → Claude)
- [ ] Реализовать retry с exponential backoff
- [ ] Упростить обработку thinking models

---

## 3. КЭШИРОВАНИЕ

### Реализованные механизмы

#### 3.1 LRU Cache (`cache.py`)

```python
HintCache(maxsize=20)
```

- **Ключ:** MD5 hash от `text + context[-3:]`
- **Case-insensitive**
- **LRU eviction**

#### 3.2 Semantic Cache (`semantic_cache.py`)

```python
SemanticCache(threshold=0.85, maxsize=50)
```

- **Модель:** `paraphrase-multilingual-MiniLM-L12-v2`
- **Порог схожести:** 85%
- **Fallback:** exact match если модель недоступна

### ✅ Оценка: 9/10

- Двухуровневое кэширование (LRU + semantic)
- Учёт контекста при кэшировании
- Graceful fallback

### Рекомендации

- [ ] Увеличить maxsize для production (50 → 100)
- [ ] Добавить TTL для устаревших записей
- [ ] Персистентный кэш (SQLite/Redis)

---

## 4. RAG СИСТЕМА

### Архитектура (`advanced_rag.py`)

- **Vector DB:** ChromaDB
- **Embedding:** `paraphrase-multilingual-MiniLM-L12-v2`
- **Chunking:** Smart chunking с overlap
- **Reranking:** Keyword overlap scoring

### Функции

1. **Индексация резюме** — `user_context.txt` разбивается на чанки
2. **Session Memory** — ключевые факты, обсуждённые темы
3. **Adaptive Context** — размер контекста по сложности вопроса
4. **Memory Consolidation** — извлечение важных фактов после ответа

### ⚠️ Найденные проблемы

#### P1: Устаревший ChromaDB API

```python
# advanced_rag.py:90-94
self.chroma_client = chromadb.Client(Settings(
    chroma_db_impl="duckdb+parquet",  # DEPRECATED
    ...
))
```

**Проблема:** `chroma_db_impl` deprecated в новых версиях.

#### P2: Fallback storage неоптимален

**Проблема:** При недоступности ChromaDB используется in-memory list.

### Рекомендации

- [ ] Обновить ChromaDB API
- [ ] Добавить prebuilt knowledge base для интервью

---

## 5. ПРОМПТЫ

### Структура (`prompts.py`)

```python
PROFILE_PROMPTS = {
    'interview': {
        'system': '...',  # ~300 символов
        'few_shot_examples': [...]  # 3 примера
    }
}
```

### ✅ Оценка: 8/10

- Краткие промпты (300 символов vs 1200 ранее)
- Few-shot примеры для типичных вопросов
- Динамическая подстановка user_context
- Акцент на ПОСЛЕДНЕМ вопросе

### Рекомендации

- [ ] Добавить профили для других сценариев (sales, exam)
- [ ] A/B тестирование промптов
- [ ] Версионирование промптов

---

## 6. ПРОВАЙДЕРЫ

### Python сервер (llm_server.py)

| Провайдер | Статус | Примечание |
|-----------|--------|------------|
| Ollama | ✅ Работает | Primary, streaming |
| OpenAI | ❌ Нет | Только в JS fallback |
| Claude | ❌ Нет | Только в JS fallback |
| Gemini | ❌ Нет | Только в JS fallback |

### JavaScript fallback (providers.js)

| Провайдер | Статус | Примечание |
|-----------|--------|------------|
| Ollama | ✅ Работает | Fallback |
| OpenAI | ✅ Реализован | Требует API key |
| Gemini | ✅ Реализован | Требует API key |
| Claude | ✅ Реализован | Требует API key |
| OpenRouter | ✅ Реализован | Требует API key |

### ⚠️ Проблема

Python сервер использует только Ollama. Облачные провайдеры доступны только через JS fallback, который не использует оптимизации (classification, RAG, semantic cache).

### Рекомендации

- [ ] Добавить облачные провайдеры в Python сервер
- [ ] Унифицировать интерфейс провайдеров
- [ ] Реализовать cascade fallback

---

## 7. ERROR HANDLING

### Текущее состояние

- ✅ Логирование ошибок в `logs/metrics.jsonl`
- ✅ Graceful handling ConnectionError
- ⚠️ Нет retry logic
- ⚠️ Нет circuit breaker
- ⚠️ Базовые сообщения об ошибках

### Рекомендации

- [ ] Retry с exponential backoff
- [ ] Circuit breaker для внешних сервисов
- [ ] Более информативные сообщения об ошибках

---

## 8. МЕТРИКИ И OBSERVABILITY

### Реализовано (`metrics.py`)

- Логирование в JSON Lines формат
- STT: latency_ms, audio_duration, RTF
- LLM: ttft_ms, total_ms, cache_hit_rate
- Ошибки по компонентам
- Статистика по типам вопросов

### ✅ Оценка: 8/10

Хорошая система метрик для production.

---

## 9. ТЕСТЫ

### Результаты

```
Python: 15/15 passed (0.54s)
Node.js: 111/111 passed (3.5s)
Total: 126/126 ✅
```

### Покрытие

| Модуль | Покрытие |
|--------|----------|
| pipeline | 84% |
| providers | 36% |
| storage | 40% |
| cache (Python) | 100% |
| classification (Python) | 100% |

---

## 10. КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ

### Выполнено в рамках аудита

1. ✅ Проверена работоспособность Ollama
2. ✅ Проверена работоспособность LLM сервера
3. ✅ Проверены Python тесты (15/15 passed)
4. ✅ Проверены Node.js тесты (111/111 passed)
5. ✅ **Исправлен MODEL_PRIORITY** в stt_server.py — удалена несуществующая модель
6. ✅ **Добавлен retry_with_backoff** декоратор в llm_server.py

### Остаётся для будущих итераций

1. **P1 (High):**
   - [ ] Обновить ChromaDB API (deprecated settings)
   - [ ] Применить retry декоратор к критическим методам

2. **P2 (Medium):**
   - [ ] Добавить облачные провайдеры в Python сервер
   - [ ] Увеличить размер semantic cache (50 → 100)
   - [ ] Добавить TTL для кэша

---

## ЗАКЛЮЧЕНИЕ

Live Hints имеет **production-ready** STT/LLM pipeline с:

- Качественной STT транскрипцией (faster-whisper + GPU)
- Оптимизированной LLM генерацией (streaming, caching, RAG)
- Хорошей системой метрик

**Основные области для улучшения:**

1. Fallback между провайдерами
2. Retry logic и resilience
3. Расширение поддержки облачных провайдеров

**Рекомендуемый приоритет работ:**

1. Исправить критические баги (P0)
2. Добавить retry logic (P1)
3. Расширить провайдеры (P2)
