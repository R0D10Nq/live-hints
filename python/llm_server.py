"""
LLM Server - Streaming подсказки с минимальной задержкой
GPU-only режим (Ollama) для RTX 5060 Ti 16GB
"""

import asyncio
import json
import logging
import os
import sys
import time
from typing import Optional, AsyncGenerator

import requests
import httpx
import aiohttp
from functools import wraps
from fastapi import FastAPI, HTTPException

# Retry конфигурация
MAX_RETRIES = 3
RETRY_DELAY_BASE = 1.0  # секунды


def retry_with_backoff(max_retries: int = MAX_RETRIES, base_delay: float = RETRY_DELAY_BASE):
    """Декоратор для retry с exponential backoff"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except (requests.exceptions.ConnectionError, 
                        requests.exceptions.Timeout,
                        requests.exceptions.RequestException) as e:
                    last_error = e
                    if attempt < max_retries - 1:
                        delay = base_delay * (2 ** attempt)
                        logging.warning(f'[RETRY] Attempt {attempt + 1}/{max_retries} failed: {e}. Retrying in {delay}s...')
                        time.sleep(delay)
            raise last_error
        return wrapper
    return decorator

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from prompts import get_system_prompt, get_few_shot_examples, get_profile_config
from classification import classify_question, build_contextual_prompt
from cache import HintCache
from metrics import log_llm_request, log_llm_response, log_cache_hit, log_error
from semantic_cache import get_semantic_cache
from advanced_rag import get_advanced_rag
from vector_db import get_vector_db
import uvicorn

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger('LLM')

# ========== КОНФИГУРАЦИЯ ==========
HTTP_HOST = 'localhost'
HTTP_PORT = 8766

# Ollama настройки - GPU модель
OLLAMA_URL = os.getenv('OLLAMA_URL', 'http://localhost:11434')
# Realtime профиль: qwen2.5:7b - быстрая и качественная
# Quality профиль: qwen2.5:14b - медленнее но лучше
DEFAULT_MODEL = os.getenv('OLLAMA_MODEL', 'ministral-3:8b')

# функция загрузки контекста
def load_user_context() -> str:
    """
    Загружает контекст пользователя из файла
    Создай файл: python/user_context.txt
    """
    context_path = os.path.join(os.path.dirname(__file__), 'user_context.txt')
    try:
        if os.path.exists(context_path):
            with open(context_path, 'r', encoding='utf-8') as f:
                return f.read().strip()
    except Exception as e:
        logger.warning(f'Не удалось загрузить user_context.txt: {e}')
    return ''

USER_CONTEXT = load_user_context()
logger.info(f'[CONTEXT] Загружен контекст: {len(USER_CONTEXT)} символов')


def preload_model(model: str = DEFAULT_MODEL):
    """Предзагрузка модели в память Ollama с keep_alive=-1 (бесконечно)"""
    try:
        logger.info(f'[PRELOAD] Загрузка модели {model} с keep_alive=-1...')
        resp = requests.post(
            f'{OLLAMA_URL}/api/generate',
            json={
                'model': model, 
                'prompt': 'test', 
                'stream': False,
                'keep_alive': -1  # Бесконечно держать в памяти
            },
            timeout=180  # 3 минуты на загрузку модели
        )
        if resp.status_code == 200:
            logger.info(f'[PRELOAD] Модель {model} загружена (Forever)')
        else:
            logger.warning(f'[PRELOAD] Ошибка загрузки: {resp.status_code}')
    except Exception as e:
        logger.warning(f'[PRELOAD] Не удалось загрузить модель: {e}')


# ========== ПОСТРОЕНИЕ MESSAGES ==========
def build_messages(system_prompt: str, context: list, text: str, few_shot: list = None) -> list:
    """
    Строит массив messages для LLM с few-shot примерами и акцентом на текущем вопросе
    """
    messages = [{'role': 'system', 'content': system_prompt}]
    
    # Few-shot примеры
    if few_shot:
        for example in few_shot:
            messages.append({'role': 'user', 'content': example['user']})
            messages.append({'role': 'assistant', 'content': example['assistant']})
    
    # История контекста (последние 5)
    if context:
        for ctx in context[-5:]:
            messages.append({'role': 'user', 'content': ctx})
    
    # ТЕКУЩИЙ ВОПРОС с акцентом
    messages.append({
        'role': 'user',
        'content': (
            f'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
            f'ТЕКУЩИЙ ВОПРОС (ответь ТОЛЬКО на него):\n'
            f'{text}\n'
            f'━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
        )
    })
    
    return messages


# Глобальный инстанс кэша
hint_cache = HintCache(maxsize=20)


# ========== МЕТРИКИ ==========
class HintMetrics:
    def __init__(self):
        self.reset()
    
    def reset(self):
        self.t_request = None
        self.t_first_token = None
        self.t_done = None
    
    def request_started(self):
        self.t_request = time.time()
    
    def first_token(self):
        if self.t_first_token is None:
            self.t_first_token = time.time()
    
    def done(self):
        self.t_done = time.time()
    
    def get_stats(self) -> dict:
        return {
            'ttft_ms': int((self.t_first_token - self.t_request) * 1000) if self.t_request and self.t_first_token else 0,
            'total_ms': int((self.t_done - self.t_request) * 1000) if self.t_request and self.t_done else 0
        }


# ========== FASTAPI ==========
app = FastAPI(title='Live Hints LLM Server')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class HintRequest(BaseModel):
    text: str
    context: Optional[list] = None
    stream: bool = False
    profile: str = 'interview'
    max_tokens: Optional[int] = 500  # 50..500
    temperature: Optional[float] = 0.8  # 0.0..1.0
    model: Optional[str] = None  # Модель из настроек клиента
    system_prompt: Optional[str] = None  # Кастомный системный промт от клиента
    user_context: Optional[str] = None  # Контекст пользователя (резюме)


class HintResponse(BaseModel):
    hint: str
    latency_ms: int
    ttft_ms: int


# ========== OLLAMA CLIENT ==========
class OllamaClient:
    def __init__(self, base_url: str = OLLAMA_URL, model: str = DEFAULT_MODEL):
        self.base_url = base_url
        self.model = model
        self.metrics = HintMetrics()
    
    def _check_available(self) -> bool:
        try:
            resp = requests.get(f'{self.base_url}/api/tags', timeout=2)
            return resp.status_code == 200
        except:
            return False
    
    def generate(self, text: str, context: list = None, system_prompt: str = None, 
                 profile: str = 'interview', max_tokens: int = 500, temperature: float = 0.8) -> str:
        """Синхронная генерация подсказки с классификацией и few-shot"""
        self.metrics.reset()
        self.metrics.request_started()
        
        # Проверка кэша
        cached = hint_cache.get(text, context or [])
        if cached:
            self.metrics.first_token()
            self.metrics.done()
            return cached
        
        # Валидация параметров
        max_tokens = max(50, min(500, max_tokens or 500))
        temperature = max(0.0, min(1.0, temperature or 0.8))
        
        # Классификация вопроса
        question_type = classify_question(text)
        logger.info(f'[CLASSIFY] Type: {question_type}')
        
        # Динамический промпт в зависимости от типа
        system_prompt = build_contextual_prompt(question_type, USER_CONTEXT)
        
        # Few-shot примеры
        few_shot = get_few_shot_examples(profile)
        
        # Построение messages
        messages = build_messages(system_prompt, context or [], text, few_shot)
        
        logger.info(f'[LLM] Type: {question_type}, messages: {len(messages)}')
        logger.debug(f'[LLM] System prompt length: {len(system_prompt)} chars')
        logger.debug(f'[LLM] max_tokens={max_tokens}, temperature={temperature}')
        
        try:
            resp = requests.post(
                f'{self.base_url}/api/chat',
                json={
                    'model': self.model,
                    'messages': messages,
                    'stream': False,
                    'keep_alive': -1,  # Бесконечно держать в памяти
                    'options': {
                        'temperature': temperature,
                        'num_predict': max_tokens,
                        'top_p': 0.9
                    }
                },
                timeout=60  # Увеличен таймаут для загрузки модели
            )
            
            self.metrics.first_token()
            self.metrics.done()
            
            if resp.status_code == 200:
                data = resp.json()
                
                # Проверяем все возможные поля
                message_obj = data.get('message', {})
                logger.debug(f'[DEBUG-RAW] message keys: {list(message_obj.keys()) if isinstance(message_obj, dict) else type(message_obj)}')
                
                # Ollama /api/chat возвращает {"message": {"role": "assistant", "content": "..."}}
                # Некоторые модели (thinking models) возвращают content пустым, а текст в thinking
                hint = ''
                if isinstance(message_obj, dict):
                    hint = message_obj.get('content', '')
                    logger.debug(f'[DEBUG-EXTRACT] content len={len(hint)}')
                    
                    # Если content пустой, пробуем взять из thinking (для thinking models)
                    if not hint and 'thinking' in message_obj:
                        thinking_text = message_obj.get('thinking', '')
                        logger.debug(f'[DEBUG-EXTRACT] thinking field len={len(thinking_text)}')
                        # Извлекаем финальный ответ из thinking (обычно после "So we can say:" или в конце)
                        if thinking_text:
                            # Пробуем найти цитату с ответом
                            import re
                            # Ищем паттерны типа: "Привет! Чем могу помочь?"
                            quotes = re.findall(r'"([^"]{5,})"', thinking_text)
                            if quotes:
                                # Берём последнюю цитату (обычно это финальный ответ)
                                hint = quotes[-1]
                                logger.debug(f'[DEBUG-EXTRACT] Extracted from thinking quotes: "{hint[:100]}"')
                            else:
                                # Если цитат нет, берём последние 2 предложения из thinking
                                sentences = [s.strip() for s in thinking_text.replace('\n', ' ').split('.') if s.strip()]
                                if sentences:
                                    hint = '. '.join(sentences[-2:]) + '.'
                                    logger.debug(f'[DEBUG-EXTRACT] Extracted last sentences from thinking: "{hint[:100]}"')
                
                # Альтернативные поля
                if not hint:
                    hint = data.get('response', '')
                    if hint:
                        logger.debug(f'[DEBUG-EXTRACT] From response field: len={len(hint)}')
                if not hint:
                    hint = data.get('content', '')
                    if hint:
                        logger.debug(f'[DEBUG-EXTRACT] From content field: len={len(hint)}')
                if not hint and 'choices' in data:
                    choices = data.get('choices', [])
                    if choices:
                        hint = choices[0].get('message', {}).get('content', '')
                        if hint:
                            logger.debug(f'[DEBUG-EXTRACT] From choices[0].message.content: len={len(hint)}')
                
                stats = self.metrics.get_stats()
                
                logger.info(f'[LLM] Подсказка за {stats["total_ms"]}ms, len={len(hint)}')
                
                if not hint.strip():
                    logger.warning(f'[DEBUG-WARN] hint пустой! raw_keys={list(data.keys())}, message_obj={message_obj}')
                
                # Сохраняем в кэш
                if hint.strip():
                    hint_cache.set(text, context or [], hint)
                
                return hint
            else:
                logger.error(f'[LLM] Ollama ошибка: {resp.status_code}')
                return f'Ошибка Ollama: {resp.status_code}'
                
        except requests.exceptions.ConnectionError:
            return 'Ollama не запущен. Запустите: ollama serve'
        except Exception as e:
            logger.error(f'[LLM] Ошибка: {e}')
            return f'Ошибка: {e}'
    
    async def generate_stream(self, text: str, context: list = None, profile: str = 'interview',
                              max_tokens: int = 500, temperature: float = 0.8,
                              custom_system_prompt: str = None, custom_user_context: str = None):
        """Async streaming генерация подсказки с aiohttp"""
        self.metrics.reset()
        self.metrics.request_started()
        self._last_question_type = 'general'
        
        # Проверка semantic cache (похожие вопросы)
        semantic_cache = get_semantic_cache()
        cached, similarity = semantic_cache.get(text, context or [])
        if cached:
            self.metrics.first_token()
            self.metrics.done()
            self._last_similarity = similarity
            logger.info(f'[SemanticCache] HIT: similarity={similarity:.3f}')
            yield cached
            return
        
        # Fallback на обычный кэш
        cached_lru = hint_cache.get(text, context or [])
        if cached_lru:
            self.metrics.first_token()
            self.metrics.done()
            yield cached_lru
            return
        
        # Валидация параметров
        max_tokens = max(50, min(500, max_tokens or 500))
        temperature = max(0.0, min(1.0, temperature or 0.8))
        
        # Классификация
        question_type = classify_question(text)
        self._last_question_type = question_type
        logger.info(f'[CLASSIFY Stream] Type: {question_type}')
        
        # Логируем запрос
        log_llm_request(text, len(context or []), question_type, profile)
        
        # Используем кастомный контекст если передан, иначе глобальный
        effective_user_context = custom_user_context if custom_user_context else USER_CONTEXT
        if custom_user_context:
            logger.info(f'[CONTEXT] Используется кастомный контекст: {len(custom_user_context)} символов')
        
        # Advanced RAG: улучшаем промпт с semantic search и adaptive context
        rag = get_advanced_rag()
        
        # Если передан кастомный системный промпт - используем его как базу
        if custom_system_prompt:
            base_prompt = custom_system_prompt + '\n\n' + build_contextual_prompt(question_type, effective_user_context)
            logger.info(f'[PROMPT] Используется кастомный системный промпт: {len(custom_system_prompt)} символов')
        else:
            base_prompt = build_contextual_prompt(question_type, effective_user_context)
        
        system_prompt = rag.build_enhanced_prompt(text, context or [], question_type, base_prompt)
        
        # Адаптивный контекст - меньше для простых вопросов, больше для сложных
        adaptive_context = rag.get_adaptive_context(context or [], text)
        
        # Few-shot
        few_shot = get_few_shot_examples(profile)
        
        # Построение messages с адаптивным контекстом
        messages = build_messages(system_prompt, adaptive_context, text, few_shot)
        
        logger.info(f'[LLM Stream] Type: {question_type}, messages: {len(messages)}')
        logger.debug(f'[LLM Stream] max_tokens={max_tokens}, temperature={temperature}')
        
        accumulated_hint = ''
        
        try:
            timeout = aiohttp.ClientTimeout(total=120)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                payload = {
                    'model': self.model,
                    'messages': messages,
                    'stream': True,
                    'keep_alive': -1,
                    'options': {
                        'temperature': temperature,
                        'num_predict': max_tokens,
                        'top_p': 0.9
                    }
                }
                async with session.post(f'{self.base_url}/api/chat', json=payload) as resp:
                    if resp.status == 200:
                        async for line in resp.content:
                            if line:
                                try:
                                    data = json.loads(line.decode('utf-8'))
                                    content = data.get('message', {}).get('content', '')
                                    if content:
                                        self.metrics.first_token()
                                        accumulated_hint += content
                                        yield content
                                    if data.get('done'):
                                        self.metrics.done()
                                        if accumulated_hint.strip():
                                            hint_cache.set(text, context or [], accumulated_hint)
                                            semantic_cache.set(text, context or [], accumulated_hint)
                                            rag.consolidate_memory(text, accumulated_hint, question_type)
                                            logger.info(f'[CACHE] SET: {text[:50]}...')
                                        stats = self.metrics.get_stats()
                                        log_llm_response(
                                            stats['ttft_ms'], 
                                            stats['total_ms'], 
                                            len(accumulated_hint),
                                            cached=False,
                                            question_type=question_type
                                        )
                                        break
                                except json.JSONDecodeError:
                                    pass
                    else:
                        error_msg = f'Ollama ошибка: {resp.status}'
                        log_error('llm', 'ollama_error', error_msg)
                        yield error_msg
                        
        except aiohttp.ClientConnectorError:
            error_msg = 'Ollama не запущен. Запустите: ollama serve'
            log_error('llm', 'connection_error', error_msg)
            yield error_msg
        except asyncio.TimeoutError:
            error_msg = 'Таймаут запроса к Ollama (120 сек)'
            log_error('llm', 'timeout', error_msg)
            yield error_msg
        except Exception as e:
            error_msg = f'Ошибка: {e}'
            log_error('llm', 'unknown', str(e))
            yield error_msg


# Глобальный клиент
ollama = OllamaClient()


# ========== ENDPOINTS ==========
@app.get('/health')
async def health():
    """Проверка здоровья сервера"""
    available = ollama._check_available()
    return {
        'status': 'ok' if available else 'ollama_unavailable',
        'model': ollama.model,
        'ollama_url': ollama.base_url,
        'last_error': None
    }


@app.post('/hint', response_model=HintResponse)
async def generate_hint(request: HintRequest):
    """Генерация подсказки (синхронно)"""
    if not request.text or len(request.text.strip()) < 5:
        raise HTTPException(400, 'Текст слишком короткий')
    
    # Используем модель из запроса или дефолтную
    model = request.model or ollama.model
    logger.info(f'[API] model={model}, profile={request.profile}, max_tokens={request.max_tokens}')
    
    # Временно меняем модель если указана в запросе
    original_model = ollama.model
    if request.model:
        ollama.model = request.model
    
    hint = ollama.generate(
        text=request.text, 
        context=request.context, 
        profile=request.profile,
        max_tokens=request.max_tokens,
        temperature=request.temperature
    )
    
    # Восстанавливаем модель
    ollama.model = original_model
    stats = ollama.metrics.get_stats()
    
    # ===== DEBUG PHASE 3: API RESPONSE =====
    logger.debug(f'[DEBUG-API] Preparing response: hint_len={len(hint)}, hint_type={type(hint).__name__}')
    logger.debug(f'[DEBUG-API] hint value: "{hint[:300] if hint else "<NONE>"}"')
    
    response_dict = {
        'hint': hint,
        'latency_ms': stats['total_ms'],
        'ttft_ms': stats['ttft_ms']
    }
    logger.debug(f'[DEBUG-API] JSON payload: {response_dict}')
    
    if not hint or not hint.strip():
        logger.warning(f'[DEBUG-WARN] Returning empty hint! profile={request.profile}, text_len={len(request.text)}')
    
    return HintResponse(
        hint=hint,
        latency_ms=stats['total_ms'],
        ttft_ms=stats['ttft_ms']
    )


@app.post('/hint/stream')
async def generate_hint_stream(request: HintRequest):
    """Streaming генерация подсказки с классификацией и few-shot"""
    if not request.text or len(request.text.strip()) < 5:
        raise HTTPException(400, 'Текст слишком короткий')
    
    # Используем модель из запроса или дефолтную
    model = request.model or ollama.model
    logger.info(f'[API Stream] model={model}, profile={request.profile}, max_tokens={request.max_tokens}')
    
    # Временно меняем модель если указана в запросе
    original_model = ollama.model
    if request.model:
        ollama.model = request.model
    
    # 1. Проверка VectorDB для instant response (similarity > 0.90)
    vector_db = get_vector_db()
    instant_answer = vector_db.get_instant_answer(request.text)
    
    # 2. Проверка LRU кэша
    cached = instant_answer or hint_cache.get(request.text, request.context or [])
    
    # 3. Получаем похожие ответы для контекста
    context_answers = vector_db.get_context_answers(request.text) if not cached else []
    
    # Классификация для badges
    question_type = classify_question(request.text)
    
    async def stream():
        nonlocal original_model
        try:
            if cached:
                # Логируем cache hit
                log_cache_hit(request.text)
                log_llm_response(0, 0, len(cached), cached=True, question_type=question_type)
                
                # Возвращаем из кэша целиком с типом вопроса
                yield f"data: {json.dumps({'chunk': cached, 'cached': True, 'question_type': question_type}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'done': True, 'cached': True, 'question_type': question_type, 'latency_ms': 0, 'ttft_ms': 0}, ensure_ascii=False)}\n\n"
            else:
                # Streaming генерация с кастомным промтом и контекстом
                async for chunk in ollama.generate_stream(
                    request.text, 
                    request.context,
                    request.profile,
                    request.max_tokens,
                    request.temperature,
                    request.system_prompt,
                    request.user_context
                ):
                    yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
                
                stats = ollama.metrics.get_stats()
                q_type = getattr(ollama, '_last_question_type', question_type)
                yield f"data: {json.dumps({'done': True, 'question_type': q_type, 'latency_ms': stats['total_ms'], 'ttft_ms': stats['ttft_ms']}, ensure_ascii=False)}\n\n"
        finally:
            # Восстанавливаем модель
            ollama.model = original_model
    
    return StreamingResponse(stream(), media_type='text/event-stream')


@app.post('/cache/clear')
async def clear_cache():
    """Очистка кэша при старте новой сессии"""
    try:
        hint_cache.cache.clear()
        semantic_cache = get_semantic_cache()
        semantic_cache.clear()
        logger.info('[CACHE] Кэш очищен для новой сессии')
        return {'status': 'ok', 'message': 'Кэш очищен'}
    except Exception as e:
        logger.error(f'[CACHE] Ошибка очистки: {e}')
        return {'status': 'error', 'message': str(e)}


@app.get('/models')
async def list_models():
    """Список доступных моделей с детальной информацией"""
    try:
        resp = requests.get(f'{ollama.base_url}/api/tags', timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            models = []
            for m in data.get('models', []):
                size_gb = m.get('size', 0) / (1024 ** 3)
                models.append({
                    'name': m['name'],
                    'size': f'{size_gb:.1f}GB',
                    'size_bytes': m.get('size', 0),
                    'modified': m.get('modified_at', ''),
                    'family': m.get('details', {}).get('family', 'unknown'),
                    'parameters': m.get('details', {}).get('parameter_size', 'unknown')
                })
            return {'models': models, 'current': ollama.model}
    except Exception as e:
        logger.error(f'[Models] Ошибка: {e}')
    return {'models': [], 'current': ollama.model, 'error': 'Ollama недоступен'}


@app.post('/model/{model_name}')
async def set_model(model_name: str):
    """Смена модели"""
    ollama.model = model_name
    logger.info(f'[LLM] Модель изменена на: {model_name}')
    return {'model': model_name}


# Профили моделей для быстрого переключения
MODEL_PROFILES = {
    'fast': {'model': 'gemma2:2b', 'temperature': 0.5, 'max_tokens': 200, 'description': 'Быстрые короткие ответы'},
    'balanced': {'model': 'ministral-3:8b', 'temperature': 0.7, 'max_tokens': 400, 'description': 'Баланс скорости и качества'},
    'accurate': {'model': 'phi4:latest', 'temperature': 0.8, 'max_tokens': 600, 'description': 'Точные развёрнутые ответы'},
    'code': {'model': 'qwen2.5-coder:7b', 'temperature': 0.3, 'max_tokens': 500, 'description': 'Специализация на коде'}
}


@app.get('/model/profiles')
async def get_model_profiles():
    """Получить предустановленные профили моделей"""
    return {'profiles': MODEL_PROFILES, 'current': ollama.model}


@app.post('/model/profile/{profile_name}')
async def set_model_profile(profile_name: str):
    """Применить профиль модели"""
    if profile_name not in MODEL_PROFILES:
        raise HTTPException(404, f'Профиль {profile_name} не найден')
    
    profile = MODEL_PROFILES[profile_name]
    ollama.model = profile['model']
    logger.info(f'[LLM] Профиль {profile_name}: модель={profile["model"]}')
    return {'profile': profile_name, 'settings': profile}


# ========== AUDIO DEVICES API ==========

@app.get('/audio/devices')
async def get_audio_devices():
    """Получить список аудио устройств"""
    devices = {'input': [], 'output': []}
    
    try:
        import pyaudiowpatch as pyaudio
        p = pyaudio.PyAudio()
        
        for i in range(p.get_device_count()):
            info = p.get_device_info_by_index(i)
            device = {
                'index': i,
                'name': info['name'],
                'sampleRate': int(info['defaultSampleRate']),
                'isLoopback': info.get('isLoopbackDevice', False)
            }
            
            if info['maxInputChannels'] > 0:
                devices['input'].append(device)
            if info['maxOutputChannels'] > 0:
                devices['output'].append(device)
        
        p.terminate()
    except ImportError:
        try:
            import sounddevice as sd
            for i, dev in enumerate(sd.query_devices()):
                device = {
                    'index': i,
                    'name': dev['name'],
                    'sampleRate': int(dev['default_samplerate']),
                    'isLoopback': 'loopback' in dev['name'].lower()
                }
                if dev['max_input_channels'] > 0:
                    devices['input'].append(device)
                if dev['max_output_channels'] > 0:
                    devices['output'].append(device)
        except:
            pass
    except Exception as e:
        logger.error(f'Ошибка получения устройств: {e}')
    
    return devices


# ========== VISION AI API ==========

# Доступные Vision модели (в порядке приоритета)
VISION_MODELS = ['llava:13b', 'llava:7b', 'llava:latest', 'bakllava:latest']

def get_available_vision_model() -> Optional[str]:
    """Проверить наличие Vision модели в Ollama"""
    try:
        resp = requests.get(f'{OLLAMA_URL}/api/tags', timeout=5)
        if resp.status_code == 200:
            models = [m['name'] for m in resp.json().get('models', [])]
            for vision_model in VISION_MODELS:
                if vision_model in models:
                    return vision_model
            # Проверяем частичное совпадение
            for model in models:
                if 'llava' in model.lower() or 'bakllava' in model.lower():
                    return model
    except Exception as e:
        logger.warning(f'[Vision] Не удалось получить список моделей: {e}')
    return None


@app.get('/vision/status')
async def vision_status():
    """Проверка доступности Vision AI"""
    model = get_available_vision_model()
    return {
        'available': model is not None,
        'model': model,
        'message': f'Vision модель: {model}' if model else 'Vision модель не найдена. Установите: ollama pull llava:7b'
    }


@app.post('/vision/analyze')
async def analyze_image(request: dict):
    """Анализ изображения с помощью Vision AI"""
    image_base64 = request.get('image')
    prompt = request.get('prompt', 'Проанализируй это изображение. Если это код или текст - опиши его. Если это интерфейс - опиши элементы.')
    
    if not image_base64:
        raise HTTPException(400, 'Изображение не предоставлено')
    
    # Проверяем наличие Vision модели
    vision_model = get_available_vision_model()
    if not vision_model:
        return {
            'error': 'Vision модель не установлена',
            'hint': 'Выполните: ollama pull llava:7b'
        }
    
    logger.info(f'[Vision] Анализ изображения с {vision_model}...')
    
    try:
        # Увеличенный timeout для Vision моделей (они медленные)
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f'{ollama.base_url}/api/generate',
                json={
                    'model': vision_model,
                    'prompt': prompt,
                    'images': [image_base64],
                    'stream': False,
                    'options': {
                        'temperature': 0.3,
                        'num_predict': 500
                    }
                }
            )
            
            if resp.status_code == 200:
                data = resp.json()
                analysis = data.get('response', '')
                logger.info(f'[Vision] Анализ завершён: {len(analysis)} символов')
                return {
                    'analysis': analysis,
                    'model': vision_model
                }
            else:
                error_text = resp.text[:200]
                logger.error(f'[Vision] Ошибка {resp.status_code}: {error_text}')
                return {'error': f'Ошибка Vision AI: {resp.status_code}'}
    except httpx.TimeoutException:
        logger.error('[Vision] Таймаут (120 сек)')
        return {'error': 'Таймаут анализа. Vision модель слишком медленная.'}
    except Exception as e:
        logger.error(f'[Vision] Ошибка: {e}')
        return {'error': str(e)}


# ========== GPU CHECK ==========
def check_gpu_status() -> dict:
    """Проверка доступности GPU через nvidia-smi"""
    import subprocess
    result = {'available': False, 'name': None, 'memory_total': None, 'memory_used': None}
    try:
        output = subprocess.check_output(
            ['nvidia-smi', '--query-gpu=name,memory.total,memory.used', '--format=csv,noheader,nounits'],
            timeout=5
        ).decode('utf-8').strip()
        if output:
            parts = output.split(',')
            result['available'] = True
            result['name'] = parts[0].strip()
            result['memory_total'] = int(parts[1].strip())
            result['memory_used'] = int(parts[2].strip())
    except (subprocess.SubprocessError, FileNotFoundError, Exception) as e:
        logger.warning(f'[GPU] nvidia-smi недоступен: {e}')
    return result


@app.get('/gpu/status')
async def gpu_status():
    """Статус GPU для UI"""
    info = check_gpu_status()
    if info['available']:
        free = info['memory_total'] - info['memory_used']
        return {
            'available': True,
            'name': info['name'],
            'memory_free_mb': free,
            'memory_total_mb': info['memory_total']
        }
    return {'available': False, 'message': 'GPU не обнаружен'}


# ========== MAIN ==========
if __name__ == '__main__':
    # GPU check при старте
    gpu_info = check_gpu_status()
    if gpu_info['available']:
        free_mem = gpu_info['memory_total'] - gpu_info['memory_used']
        logger.info(f"[GPU] {gpu_info['name']}: {free_mem}/{gpu_info['memory_total']} MB свободно")
    else:
        logger.warning('[GPU] GPU не обнаружен, используется CPU (медленно)')
    
    logger.info(f'[SERVER] Запуск http://{HTTP_HOST}:{HTTP_PORT}')
    logger.info(f'[SERVER] Ollama: {OLLAMA_URL}, Model: {DEFAULT_MODEL}')
    
    # Предзагрузка модели при старте
    preload_model(DEFAULT_MODEL)
    
    # Загрузка подготовленных вопросов в VectorDB
    try:
        vector_db = get_vector_db()
        loaded = vector_db.load_prepared_questions()
        logger.info(f'[VectorDB] Готово: {vector_db.count} вопросов в базе')
    except Exception as e:
        logger.warning(f'[VectorDB] Ошибка инициализации: {e}')
    
    uvicorn.run(
        app,
        host=HTTP_HOST,
        port=HTTP_PORT,
        log_level='warning'
    )
