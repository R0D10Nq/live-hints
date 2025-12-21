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
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from prompts import get_system_prompt, get_few_shot_examples
from classification import classify_question, build_contextual_prompt
from cache import HintCache
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
DEFAULT_MODEL = os.getenv('OLLAMA_MODEL', 'phi4:latest')

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
            f'⚠️ ТЕКУЩИЙ ВОПРОС (ответь ТОЛЬКО на него):\n'
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
        logger.info(f'[LLM] System prompt length: {len(system_prompt)} chars')
        logger.info(f'[LLM] max_tokens={max_tokens}, temperature={temperature}')
        
        try:
            resp = requests.post(
                f'{self.base_url}/api/chat',
                json={
                    'model': self.model,
                    'messages': messages,
                    'stream': False,
                    'options': {
                        'temperature': temperature,
                        'num_predict': max_tokens,
                        'top_p': 0.9
                    }
                },
                timeout=30
            )
            
            self.metrics.first_token()
            self.metrics.done()
            
            if resp.status_code == 200:
                data = resp.json()
                
                # ===== DEBUG PHASE 1: RAW RESPONSE =====
                logger.debug(f'[DEBUG-RAW] Ollama response keys: {list(data.keys())}')
                logger.debug(f'[DEBUG-RAW] Full response: {str(data)[:800]}')
                
                # Проверяем все возможные поля
                message_obj = data.get('message', {})
                logger.debug(f'[DEBUG-RAW] message object: {message_obj}')
                
                # Ollama /api/chat возвращает {"message": {"role": "assistant", "content": "..."}}
                # Некоторые модели (thinking models) возвращают content пустым, а текст в thinking
                hint = ''
                if isinstance(message_obj, dict):
                    hint = message_obj.get('content', '')
                    logger.debug(f'[DEBUG-EXTRACT] From message.content: len={len(hint)}, value="{hint[:200]}"')
                    
                    # Если content пустой, пробуем взять из thinking (для thinking models)
                    if not hint and 'thinking' in message_obj:
                        thinking_text = message_obj.get('thinking', '')
                        logger.debug(f'[DEBUG-EXTRACT] Found thinking field, len={len(thinking_text)}')
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
                
                # ===== DEBUG PHASE 2: FINAL HINT =====
                logger.debug(f'[DEBUG-HINT] Final hint: len={len(hint)}, stripped_len={len(hint.strip())}')
                logger.debug(f'[DEBUG-HINT] Content: "{hint[:300]}"')
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
                              max_tokens: int = 500, temperature: float = 0.8) -> AsyncGenerator[str, None]:
        """Streaming генерация подсказки с классификацией"""
        self.metrics.reset()
        self.metrics.request_started()
        
        # Проверка кэша (для streaming возвращаем целиком если есть)
        cached = hint_cache.get(text, context or [])
        if cached:
            self.metrics.first_token()
            self.metrics.done()
            yield cached
            return
        
        # Валидация параметров
        max_tokens = max(50, min(500, max_tokens or 500))
        temperature = max(0.0, min(1.0, temperature or 0.8))
        
        # Классификация
        question_type = classify_question(text)
        logger.info(f'[CLASSIFY Stream] Type: {question_type}')
        
        # Динамический промпт
        system_prompt = build_contextual_prompt(question_type, USER_CONTEXT)
        
        # Few-shot
        few_shot = get_few_shot_examples(profile)
        
        # Построение messages
        messages = build_messages(system_prompt, context or [], text, few_shot)
        
        logger.info(f'[LLM Stream] Type: {question_type}, messages: {len(messages)}')
        logger.info(f'[LLM Stream] max_tokens={max_tokens}, temperature={temperature}')
        
        try:
            resp = requests.post(
                f'{self.base_url}/api/chat',
                json={
                    'model': self.model,
                    'messages': messages,
                    'stream': True,
                    'options': {
                        'temperature': temperature,
                        'num_predict': max_tokens,
                        'top_p': 0.9
                    }
                },
                stream=True,
                timeout=30
            )
            
            if resp.status_code == 200:
                accumulated_hint = ''
                for line in resp.iter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            content = data.get('message', {}).get('content', '')
                            if content:
                                self.metrics.first_token()
                                accumulated_hint += content
                                yield content
                            if data.get('done'):
                                self.metrics.done()
                                # Сохраняем в кэш
                                if accumulated_hint.strip():
                                    hint_cache.set(text, context or [], accumulated_hint)
                                break
                        except json.JSONDecodeError:
                            pass
            else:
                yield f'Ошибка: {resp.status_code}'
                
        except Exception as e:
            yield f'Ошибка: {e}'


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
    
    logger.info(f'[API] profile={request.profile}, max_tokens={request.max_tokens}, temperature={request.temperature}')
    hint = ollama.generate(
        request.text, 
        request.context, 
        request.profile,
        request.max_tokens,
        request.temperature
    )
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
    
    logger.info(f'[API Stream] profile={request.profile}, max_tokens={request.max_tokens}, temperature={request.temperature}')
    
    # Проверка кэша
    cached = hint_cache.get(request.text, request.context or [])
    
    async def stream():
        if cached:
            # Возвращаем из кэша целиком
            yield f"data: {json.dumps({'chunk': cached, 'cached': True}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'done': True, 'cached': True, 'latency_ms': 0, 'ttft_ms': 0}, ensure_ascii=False)}\n\n"
        else:
            # Streaming генерация
            async for chunk in ollama.generate_stream(
                request.text, 
                request.context,
                request.profile,
                request.max_tokens,
                request.temperature
            ):
                yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
            
            stats = ollama.metrics.get_stats()
            yield f"data: {json.dumps({'done': True, 'latency_ms': stats['total_ms'], 'ttft_ms': stats['ttft_ms']}, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(stream(), media_type='text/event-stream')


@app.get('/models')
async def list_models():
    """Список доступных моделей"""
    try:
        resp = requests.get(f'{ollama.base_url}/api/tags', timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            models = [m['name'] for m in data.get('models', [])]
            return {'models': models, 'current': ollama.model}
    except:
        pass
    return {'models': [], 'current': ollama.model, 'error': 'Ollama недоступен'}


@app.post('/model/{model_name}')
async def set_model(model_name: str):
    """Смена модели"""
    ollama.model = model_name
    logger.info(f'[LLM] Модель изменена на: {model_name}')
    return {'model': model_name}


# ========== MAIN ==========
if __name__ == '__main__':
    logger.info(f'[SERVER] Запуск http://{HTTP_HOST}:{HTTP_PORT}')
    logger.info(f'[SERVER] Ollama: {OLLAMA_URL}, Model: {DEFAULT_MODEL}')
    
    uvicorn.run(
        app,
        host=HTTP_HOST,
        port=HTTP_PORT,
        log_level='warning'
    )
