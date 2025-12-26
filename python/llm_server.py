"""
LLM Server - Streaming подсказки с минимальной задержкой
GPU-only режим (Ollama) для RTX 5060 Ti 16GB
Рефакторинг: использует модули из llm/
"""

import json
import logging
import os
import sys
import time
from typing import Optional

import requests
from functools import wraps
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uvicorn

from llm import OllamaClient, get_available_vision_model, analyze_image, check_gpu_status, get_gpu_info
from classification import classify_question
from cache import HintCache
from metrics import log_cache_hit, log_llm_response
from semantic_cache import get_semantic_cache
from vector_db import get_vector_db

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

OLLAMA_URL = os.getenv('OLLAMA_URL', 'http://localhost:11434')
DEFAULT_MODEL = os.getenv('OLLAMA_MODEL', 'ministral-3:8b')

# Retry конфигурация
MAX_RETRIES = 3
RETRY_DELAY_BASE = 1.0


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


def load_user_context() -> str:
    """Загружает контекст пользователя из файла"""
    context_path = os.path.join(os.path.dirname(__file__), 'user_context.txt')
    try:
        if os.path.exists(context_path):
            with open(context_path, 'r', encoding='utf-8') as f:
                return f.read().strip()
    except Exception as e:
        logger.warning(f'Не удалось загрузить user_context.txt: {e}')
    return ''


def load_vacancy_context() -> str:
    """Загружает вакансию из файла"""
    vacancy_path = os.path.join(os.path.dirname(__file__), 'vacancy.txt')
    try:
        if os.path.exists(vacancy_path):
            with open(vacancy_path, 'r', encoding='utf-8') as f:
                return f.read().strip()
    except Exception as e:
        logger.warning(f'Не удалось загрузить vacancy.txt: {e}')
    return ''


def preload_model(model: str = DEFAULT_MODEL):
    """Предзагрузка модели в память Ollama"""
    try:
        logger.info(f'[PRELOAD] Загрузка модели {model}...')
        resp = requests.post(
            f'{OLLAMA_URL}/api/generate',
            json={
                'model': model, 
                'prompt': '', 
                'keep_alive': -1
            },
            timeout=120
        )
        if resp.status_code == 200:
            logger.info(f'[PRELOAD] Модель {model} загружена')
        else:
            logger.warning(f'[PRELOAD] Ошибка загрузки: {resp.status_code}')
    except Exception as e:
        logger.warning(f'[PRELOAD] Не удалось загрузить модель: {e}')


# ========== ИНИЦИАЛИЗАЦИЯ ==========
USER_CONTEXT = load_user_context()
VACANCY_CONTEXT = load_vacancy_context()
logger.info(f'[CONTEXT] Резюме: {len(USER_CONTEXT)} символов, Вакансия: {len(VACANCY_CONTEXT)} символов')

# Объединяем резюме и вакансию в единый контекст
FULL_CONTEXT = USER_CONTEXT
if VACANCY_CONTEXT:
    FULL_CONTEXT += f'\n\n## Вакансия:\n{VACANCY_CONTEXT}'

hint_cache = HintCache(maxsize=100)
ollama = OllamaClient(OLLAMA_URL, DEFAULT_MODEL, hint_cache, FULL_CONTEXT)

# FastAPI app
app = FastAPI(title='Live Hints LLM Server')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*']
)


# ========== PYDANTIC MODELS ==========
class HintRequest(BaseModel):
    text: str
    context: list = []
    profile: str = 'interview'
    model: Optional[str] = None
    max_tokens: int = 500
    temperature: float = 0.8
    system_prompt: Optional[str] = None
    user_context: Optional[str] = None


class HintResponse(BaseModel):
    hint: str
    latency_ms: int
    ttft_ms: int


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
    
    model = request.model or ollama.model
    logger.info(f'[API] model={model}, profile={request.profile}')
    
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
    
    ollama.model = original_model
    stats = ollama.metrics.get_stats()
    
    return HintResponse(hint=hint, latency_ms=stats['total_ms'], ttft_ms=stats['ttft_ms'])


@app.post('/hint/stream')
async def generate_hint_stream(request: HintRequest):
    """Streaming генерация подсказки"""
    if not request.text or len(request.text.strip()) < 5:
        raise HTTPException(400, 'Текст слишком короткий')
    
    model = request.model or ollama.model
    logger.info(f'[API Stream] model={model}, profile={request.profile}')
    
    original_model = ollama.model
    if request.model:
        ollama.model = request.model
    
    vector_db = get_vector_db()
    instant_answer = vector_db.get_instant_answer(request.text)
    cached = instant_answer or hint_cache.get(request.text, request.context or [])
    question_type = classify_question(request.text)
    
    async def stream():
        nonlocal original_model
        try:
            if cached:
                log_cache_hit(request.text)
                log_llm_response(0, 0, len(cached), cached=True, question_type=question_type)
                yield f"data: {json.dumps({'chunk': cached, 'cached': True, 'question_type': question_type}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'done': True, 'cached': True, 'question_type': question_type, 'latency_ms': 0, 'ttft_ms': 0}, ensure_ascii=False)}\n\n"
            else:
                async for chunk in ollama.generate_stream(
                    request.text, request.context, request.profile,
                    request.max_tokens, request.temperature,
                    request.system_prompt, request.user_context
                ):
                    yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
                
                stats = ollama.metrics.get_stats()
                q_type = getattr(ollama, '_last_question_type', question_type)
                yield f"data: {json.dumps({'done': True, 'question_type': q_type, 'latency_ms': stats['total_ms'], 'ttft_ms': stats['ttft_ms']}, ensure_ascii=False)}\n\n"
        finally:
            ollama.model = original_model
    
    return StreamingResponse(stream(), media_type='text/event-stream')


@app.post('/cache/clear')
async def clear_cache():
    """Очистка кэша при старте новой сессии"""
    try:
        hint_cache.cache.clear()
        semantic_cache = get_semantic_cache()
        semantic_cache.clear()
        logger.info('[CACHE] Кэш очищен')
        return {
            'status': 'ok', 
            'message': 'Кэш очищен'
        }
    except Exception as e:
        logger.error(f'[CACHE] Ошибка очистки: {e}')
        return {
            'status': 'error', 
            'message': str(e)
        }


# ========== MODEL MANAGEMENT ==========
MODEL_PROFILES = {
    'instant': {
        'model': 'gemma2:2b', 
        'temperature': 0.4, 
        'max_tokens': 150, 
        'description': 'Моментальные ответы <1s'
    },
    'fast': {
        'model': 'qwen2.5:7b', 
        'temperature': 0.6, 
        'max_tokens': 300, 
        'description': 'Моментальные ответы <1s'
    },
    'balanced': {
        'model': 'ministral-3:8b', 
        'temperature': 0.7, 
        'max_tokens': 400, 
        'description': 'Быстрые качественные ответы'
    },
    'accurate': {
        'model': 'qwen2.5:14b', 
        'temperature': 0.8, 
        'max_tokens': 600, 
        'description': 'Максимальная точность'
    },
    'code': {
        'model': 'qwen2.5-coder:7b', 
        'temperature': 0.3, 
        'max_tokens': 500, 
        'description': 'Специализация на коде'
    }
}


@app.get('/models')
async def list_models():
    """Список доступных моделей"""
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
            return {
                'models': models, 
                'current': ollama.model
            }
    except Exception as e:
        logger.error(f'[Models] Ошибка: {e}')
    return {
        'models': [], 
        'current': ollama.model, 
        'error': 'Ollama недоступен'
    }


@app.post('/model/{model_name}')
async def set_model(model_name: str):
    """Смена модели"""
    ollama.model = model_name
    logger.info(f'[LLM] Модель: {model_name}')
    return {
        'model': model_name
    }


@app.get('/model/profiles')
async def get_model_profiles():
    """Получить профили моделей"""
    return {
        'profiles': MODEL_PROFILES, 
        'current': ollama.model
    }


@app.post('/model/profile/{profile_name}')
async def set_model_profile(profile_name: str):
    """Применить профиль модели"""
    if profile_name not in MODEL_PROFILES:
        raise HTTPException(404, f'Профиль {profile_name} не найден')
    
    profile = MODEL_PROFILES[profile_name]
    ollama.model = profile['model']
    logger.info(f'[LLM] Профиль {profile_name}: {profile["model"]}')
    return {
        'profile': profile_name, 
        'settings': profile
    }


# ========== AUDIO DEVICES ==========
@app.get('/audio/devices')
async def get_audio_devices():
    """Получить список аудио устройств"""
    devices = {
        'input': [], 
        'output': []
    }
    
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


# ========== VISION AI ==========
@app.get('/vision/status')
async def vision_status():
    """Проверка доступности Vision AI"""
    model = get_available_vision_model(OLLAMA_URL)
    return {
        'available': model is not None,
        'model': model,
        'message': f'Vision модель: {model}' if model else 'Vision модель не найдена. Установите: ollama pull llava:7b'
    }


@app.post('/vision/analyze')
async def vision_analyze(request: dict):
    """Анализ изображения с помощью Vision AI"""
    image_base64 = request.get('image')
    prompt = request.get('prompt', 'Проанализируй это изображение.')
    
    if not image_base64:
        raise HTTPException(400, 'Изображение не предоставлено')
    
    return await analyze_image(OLLAMA_URL, DEFAULT_MODEL, image_base64, prompt)


# ========== GPU ==========
@app.get('/gpu/status')
async def gpu_status():
    """Статус GPU для UI"""
    return get_gpu_info()


# ========== MAIN ==========
if __name__ == '__main__':
    gpu_info = check_gpu_status()
    if gpu_info['available']:
        free_mem = gpu_info['memory_total'] - gpu_info['memory_used']
        logger.info(f"[GPU] {gpu_info['name']}: {free_mem}/{gpu_info['memory_total']} MB свободно")
    else:
        logger.warning('[GPU] GPU не обнаружен, используется CPU')
    
    logger.info(f'[SERVER] Запуск http://{HTTP_HOST}:{HTTP_PORT}')
    logger.info(f'[SERVER] Ollama: {OLLAMA_URL}, Model: {DEFAULT_MODEL}')
    
    preload_model(DEFAULT_MODEL)
    
    try:
        vector_db = get_vector_db()
        loaded = vector_db.load_prepared_questions()
        logger.info(f'[VectorDB] Готово: {vector_db.count} вопросов')
    except Exception as e:
        logger.warning(f'[VectorDB] Ошибка: {e}')
    
    uvicorn.run(app, host=HTTP_HOST, port=HTTP_PORT, log_level='warning')
