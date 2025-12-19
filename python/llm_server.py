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
# ставлю deepseek-r1:8b заебал этот квен
DEFAULT_MODEL = os.getenv('OLLAMA_MODEL', 'deepseek-r1:8b')

# Системный промпт - КОРОТКИЙ для скорости
SYSTEM_PROMPT = """Ты ассистент. Дай 1-2 коротких ответа по контексту разговора. Отвечай кратко, по делу, на русском."""

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
    system_prompt: Optional[str] = None
    profile: Optional[str] = None
    max_tokens: Optional[int] = 200  # 50..500
    temperature: Optional[float] = 0.3  # 0.0..1.0


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
                 max_tokens: int = 200, temperature: float = 0.3) -> str:
        """Синхронная генерация подсказки"""
        self.metrics.reset()
        self.metrics.request_started()
        
        # Валидация параметров
        max_tokens = max(50, min(500, max_tokens or 200))
        temperature = max(0.0, min(1.0, temperature or 0.3))
        
        # Используем переданный system_prompt или дефолтный
        prompt = system_prompt if system_prompt else SYSTEM_PROMPT
        logger.info(f'[LLM] System prompt: {prompt[:100]}...')
        logger.info(f'[LLM] max_tokens={max_tokens}, temperature={temperature}')
        
        messages = [{'role': 'system', 'content': prompt}]
        
        # Добавляем контекст (последние 3 сообщения)
        if context:
            for ctx in context[-3:]:
                messages.append({'role': 'user', 'content': ctx})
        
        messages.append({'role': 'user', 'content': f'Разговор: {text}\n\nПодсказка:'})
        
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
                logger.info(f'[DEBUG-RAW] Ollama response keys: {list(data.keys())}')
                logger.info(f'[DEBUG-RAW] Full response: {str(data)[:800]}')
                
                # Проверяем все возможные поля
                message_obj = data.get('message', {})
                logger.info(f'[DEBUG-RAW] message object: {message_obj}')
                
                # Ollama /api/chat возвращает {"message": {"role": "assistant", "content": "..."}}
                # Некоторые модели (thinking models) возвращают content пустым, а текст в thinking
                hint = ''
                if isinstance(message_obj, dict):
                    hint = message_obj.get('content', '')
                    logger.info(f'[DEBUG-EXTRACT] From message.content: len={len(hint)}, value="{hint[:200]}"')
                    
                    # Если content пустой, пробуем взять из thinking (для thinking models)
                    if not hint and 'thinking' in message_obj:
                        thinking_text = message_obj.get('thinking', '')
                        logger.info(f'[DEBUG-EXTRACT] Found thinking field, len={len(thinking_text)}')
                        # Извлекаем финальный ответ из thinking (обычно после "So we can say:" или в конце)
                        if thinking_text:
                            # Пробуем найти цитату с ответом
                            import re
                            # Ищем паттерны типа: "Привет! Чем могу помочь?"
                            quotes = re.findall(r'"([^"]{5,})"', thinking_text)
                            if quotes:
                                # Берём последнюю цитату (обычно это финальный ответ)
                                hint = quotes[-1]
                                logger.info(f'[DEBUG-EXTRACT] Extracted from thinking quotes: "{hint[:100]}"')
                            else:
                                # Если цитат нет, берём последние 2 предложения из thinking
                                sentences = [s.strip() for s in thinking_text.replace('\n', ' ').split('.') if s.strip()]
                                if sentences:
                                    hint = '. '.join(sentences[-2:]) + '.'
                                    logger.info(f'[DEBUG-EXTRACT] Extracted last sentences from thinking: "{hint[:100]}"')
                
                # Альтернативные поля
                if not hint:
                    hint = data.get('response', '')
                    if hint:
                        logger.info(f'[DEBUG-EXTRACT] From response field: len={len(hint)}')
                if not hint:
                    hint = data.get('content', '')
                    if hint:
                        logger.info(f'[DEBUG-EXTRACT] From content field: len={len(hint)}')
                if not hint and 'choices' in data:
                    choices = data.get('choices', [])
                    if choices:
                        hint = choices[0].get('message', {}).get('content', '')
                        if hint:
                            logger.info(f'[DEBUG-EXTRACT] From choices[0].message.content: len={len(hint)}')
                
                stats = self.metrics.get_stats()
                
                # ===== DEBUG PHASE 2: FINAL HINT =====
                logger.info(f'[DEBUG-HINT] Final hint: len={len(hint)}, stripped_len={len(hint.strip())}')
                logger.info(f'[DEBUG-HINT] Content: "{hint[:300]}"')
                logger.info(f'[LLM] Подсказка за {stats["total_ms"]}ms, len={len(hint)}')
                
                if not hint.strip():
                    logger.warning(f'[DEBUG-WARN] hint пустой! raw_keys={list(data.keys())}, message_obj={message_obj}')
                
                return hint
            else:
                logger.error(f'[LLM] Ollama ошибка: {resp.status_code}')
                return f'Ошибка Ollama: {resp.status_code}'
                
        except requests.exceptions.ConnectionError:
            return 'Ollama не запущен. Запустите: ollama serve'
        except Exception as e:
            logger.error(f'[LLM] Ошибка: {e}')
            return f'Ошибка: {e}'
    
    async def generate_stream(self, text: str, context: list = None, system_prompt: str = None,
                              max_tokens: int = 200, temperature: float = 0.3) -> AsyncGenerator[str, None]:
        """Streaming генерация подсказки"""
        self.metrics.reset()
        self.metrics.request_started()
        
        # Валидация параметров
        max_tokens = max(50, min(500, max_tokens or 200))
        temperature = max(0.0, min(1.0, temperature or 0.3))
        
        # Используем переданный system_prompt или дефолтный
        prompt = system_prompt if system_prompt else SYSTEM_PROMPT
        logger.info(f'[LLM Stream] System prompt: {prompt[:100]}...')
        logger.info(f'[LLM Stream] max_tokens={max_tokens}, temperature={temperature}')
        
        messages = [{'role': 'system', 'content': prompt}]
        
        if context:
            for ctx in context[-3:]:
                messages.append({'role': 'user', 'content': ctx})
        
        messages.append({'role': 'user', 'content': f'Разговор: {text}\n\nПодсказка:'})
        
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
                for line in resp.iter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            content = data.get('message', {}).get('content', '')
                            if content:
                                self.metrics.first_token()
                                yield content
                            if data.get('done'):
                                self.metrics.done()
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
    
    logger.info(f'[API] profile={request.profile}, system_prompt_len={len(request.system_prompt or "")}, max_tokens={request.max_tokens}, temperature={request.temperature}')
    hint = ollama.generate(
        request.text, 
        request.context, 
        request.system_prompt,
        request.max_tokens,
        request.temperature
    )
    stats = ollama.metrics.get_stats()
    
    # ===== DEBUG PHASE 3: API RESPONSE =====
    logger.info(f'[DEBUG-API] Preparing response: hint_len={len(hint)}, hint_type={type(hint).__name__}')
    logger.info(f'[DEBUG-API] hint value: "{hint[:300] if hint else "<NONE>"}"')
    
    response_dict = {
        'hint': hint,
        'latency_ms': stats['total_ms'],
        'ttft_ms': stats['ttft_ms']
    }
    logger.info(f'[DEBUG-API] JSON payload: {response_dict}')
    
    if not hint or not hint.strip():
        logger.warning(f'[DEBUG-WARN] Returning empty hint! profile={request.profile}, text_len={len(request.text)}')
    
    return HintResponse(
        hint=hint,
        latency_ms=stats['total_ms'],
        ttft_ms=stats['ttft_ms']
    )


@app.post('/hint/stream')
async def generate_hint_stream(request: HintRequest):
    """Streaming генерация подсказки"""
    if not request.text or len(request.text.strip()) < 5:
        raise HTTPException(400, 'Текст слишком короткий')
    
    logger.info(f'[API Stream] profile={request.profile}, system_prompt_len={len(request.system_prompt or "")}, max_tokens={request.max_tokens}, temperature={request.temperature}')
    
    async def stream():
        async for chunk in ollama.generate_stream(
            request.text, 
            request.context, 
            request.system_prompt,
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
