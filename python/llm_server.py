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
DEFAULT_MODEL = os.getenv('OLLAMA_MODEL', 'qwen2.5:7b')

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
    
    def generate(self, text: str, context: list = None) -> str:
        """Синхронная генерация подсказки"""
        self.metrics.reset()
        self.metrics.request_started()
        
        messages = [{'role': 'system', 'content': SYSTEM_PROMPT}]
        
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
                        'temperature': 0.3,
                        'num_predict': 100,  # Короткие ответы
                        'top_p': 0.9
                    }
                },
                timeout=30
            )
            
            self.metrics.first_token()
            self.metrics.done()
            
            if resp.status_code == 200:
                data = resp.json()
                hint = data.get('message', {}).get('content', '')
                stats = self.metrics.get_stats()
                logger.info(f'[LLM] Подсказка за {stats["total_ms"]}ms: {hint[:50]}...')
                return hint
            else:
                logger.error(f'[LLM] Ollama ошибка: {resp.status_code}')
                return f'Ошибка Ollama: {resp.status_code}'
                
        except requests.exceptions.ConnectionError:
            return 'Ollama не запущен. Запустите: ollama serve'
        except Exception as e:
            logger.error(f'[LLM] Ошибка: {e}')
            return f'Ошибка: {e}'
    
    async def generate_stream(self, text: str, context: list = None) -> AsyncGenerator[str, None]:
        """Streaming генерация подсказки"""
        self.metrics.reset()
        self.metrics.request_started()
        
        messages = [{'role': 'system', 'content': SYSTEM_PROMPT}]
        
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
                        'temperature': 0.3,
                        'num_predict': 100,
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
    available = ollama._check_available()
    return {
        'status': 'ok' if available else 'ollama_unavailable',
        'model': ollama.model,
        'ollama_url': ollama.base_url
    }


@app.post('/hint', response_model=HintResponse)
async def generate_hint(request: HintRequest):
    """Генерация подсказки (синхронно)"""
    if not request.text or len(request.text.strip()) < 5:
        raise HTTPException(400, 'Текст слишком короткий')
    
    hint = ollama.generate(request.text, request.context)
    stats = ollama.metrics.get_stats()
    
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
    
    async def stream():
        async for chunk in ollama.generate_stream(request.text, request.context):
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
