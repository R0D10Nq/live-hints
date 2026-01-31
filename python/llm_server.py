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
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from llm import OllamaClient
from cache import HintCache

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
DEFAULT_MODEL = os.getenv('OLLAMA_MODEL', 'qwen3:8b')

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
                        logging.warning(f'[RETRY] Attempt {attempt + 1}/{max_retries} failed. Retrying in {delay}s...')
                        time.sleep(delay)
            raise last_error
        return wrapper
    return decorator


def load_user_profile() -> str:
    """Загружает профиль пользователя из настроек"""
    profile = 'job_interview_ru'
    try:
        import json
        settings_path = os.path.join(os.path.dirname(__file__), '..', 'renderer', 'settings.json')
        if os.path.exists(settings_path):
            with open(settings_path, 'r', encoding='utf-8') as f:
                settings = json.load(f)
                profile = settings.get('profile', 'job_interview_ru')
                logger.info(f'[PROFILE] Загружен: {profile}')
    except Exception as e:
        logger.warning(f'[PROFILE] Не удалось загрузить: {e}')
    return profile


def load_user_context() -> str:
    """Загружает контекст пользователя"""
    from pathlib import Path
    context_path = Path(__file__).parent / 'user_context.txt'
    if context_path.exists():
        with open(context_path, 'r', encoding='utf-8') as f:
            return f.read().strip()
    return ""


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
            json={'model': model, 'prompt': '', 'keep_alive': -1},
            timeout=120
        )
        if resp.status_code == 200:
            logger.info(f'[PRELOAD] Модель {model} загружена')
        else:
            logger.warning(f'[PRELOAD] Ошибка загрузки: {resp.status_code}')
    except Exception as e:
        logger.warning(f'[PRELOAD] Не удалось загрузить модель: {e}')


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


class VisionRequest(BaseModel):
    image_base64: str
    prompt: str = "Опиши что видишь на изображении"
    model: Optional[str] = None


# ========== ИНИЦИАЛИЗАЦИЯ ==========
USER_CONTEXT = load_user_context()
VACANCY_CONTEXT = load_vacancy_context()
USER_PROFILE = load_user_profile()
logger.info(f'[CONTEXT] Резюме: {len(USER_CONTEXT)} символов, Вакансия: {len(VACANCY_CONTEXT)} символов')

FULL_CONTEXT = USER_CONTEXT
if VACANCY_CONTEXT:
    FULL_CONTEXT += f'\n\n## Вакансия:\n{VACANCY_CONTEXT}'

hint_cache = HintCache(maxsize=100)
ollama = OllamaClient(OLLAMA_URL, DEFAULT_MODEL, hint_cache, FULL_CONTEXT, USER_PROFILE)

# FastAPI app
app = FastAPI(title='Live Hints LLM Server')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*']
)

# Обработчик ошибок валидации - возвращаем 400 вместо 422
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=400,
        content={'detail': 'Validation error', 'errors': exc.errors()}
    )
from llm.routes import LLMRouter
router = LLMRouter(app, ollama, hint_cache)

# Для обратной совместимости с тестами
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from classification import classify_question
from metrics import log_cache_hit, log_llm_response
from semantic_cache import get_semantic_cache
from vector_db import get_vector_db
from llm import get_available_vision_model, analyze_image, get_gpu_info


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


@app.post('/hint')
async def generate_hint(hint_request: HintRequest):
    """Генерация подсказки (синхронно)"""
    request = hint_request
    if not request.text or len(request.text.strip()) < 5:
        raise HTTPException(400, 'Текст слишком короткий')
    
    original_model = ollama.model
    original_profile = ollama.profile
    
    if request.model:
        ollama.model = request.model
    if request.profile and request.profile != ollama.profile:
        ollama.profile = request.profile
    
    try:
        hint = ollama.generate(
            text=request.text,
            context=request.context,
            max_tokens=request.max_tokens,
            temperature=request.temperature
        )
        stats = ollama.metrics.get_stats()
        return {'hint': hint, 'latency_ms': stats['total_ms'], 'ttft_ms': stats['ttft_ms']}
    finally:
        ollama.model = original_model
        ollama.profile = original_profile


@app.post('/hint/stream')
async def generate_hint_stream(hint_request: HintRequest):
    """Streaming генерация подсказки"""
    request = hint_request
    if not request.text or len(request.text.strip()) < 5:
        raise HTTPException(400, 'Текст слишком короткий')
    
    original_model = ollama.model
    original_profile = ollama.profile
    
    if request.model:
        ollama.model = request.model
    if request.profile and request.profile != ollama.profile:
        ollama.profile = request.profile
    
    vector_db = get_vector_db()
    instant_answer = vector_db.get_instant_answer(request.text)
    cached = instant_answer or hint_cache.get(request.text, request.context or [])
    question_type = classify_question(request.text)
    
    async def stream():
        try:
            if cached:
                log_cache_hit(request.text)
                log_llm_response(0, 0, len(cached), cached=True, question_type=question_type)
                yield f"data: {json.dumps({'chunk': cached, 'cached': True, 'question_type': question_type}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'done': True, 'cached': True, 'question_type': question_type, 'latency_ms': 0, 'ttft_ms': 0}, ensure_ascii=False)}\n\n"
            else:
                async for chunk in ollama.generate_stream(
                    request.text, request.context,
                    request.max_tokens, request.temperature,
                    request.system_prompt, request.user_context
                ):
                    yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
                
                stats = ollama.metrics.get_stats()
                q_type = getattr(ollama, '_last_question_type', question_type)
                yield f"data: {json.dumps({'done': True, 'question_type': q_type, 'latency_ms': stats['total_ms'], 'ttft_ms': stats['ttft_ms']}, ensure_ascii=False)}\n\n"
        finally:
            ollama.model = original_model
            ollama.profile = original_profile
    
    return StreamingResponse(stream(), media_type='text/event-stream')


@app.post('/cache/clear')
async def clear_cache():
    """Очистка кэша"""
    try:
        hint_cache.clear()
        semantic_cache = get_semantic_cache()
        semantic_cache.clear()
        return {'status': 'ok'}
    except Exception as e:
        logger.error(f'[CACHE] Ошибка очистки: {e}')
        return {'status': 'error', 'message': str(e)}


@app.get('/models')
async def get_models():
    """Список доступных моделей"""
    try:
        models = ollama.list_models()
        return {'models': models, 'current': ollama.model}
    except Exception as e:
        return {'models': [], 'current': ollama.model, 'error': str(e)}


@app.post('/model/{model_name}')
async def switch_model(model_name: str):
    """Переключение модели"""
    try:
        ollama.model = model_name
        return {'model': model_name, 'status': 'switched'}
    except Exception as e:
        raise HTTPException(500, str(e))


# Модельные профили для тестов
MODEL_PROFILES = {
    'instant': {
        'model': 'gemma3:4b',
        'temperature': 0.5,
        'max_tokens': 150,
        'description': 'Мгновенные ответы <0.5s'
    },
    'fast': {
        'model': 'qwen2.5:7b',
        'temperature': 0.7,
        'max_tokens': 300,
        'description': 'Быстрые качественные ответы'
    },
    'balanced': {
        'model': 'ministral-3:8b',
        'temperature': 0.7,
        'max_tokens': 400
    },
    'code': {
        'model': 'qwen2.5-coder:7b',
        'temperature': 0.3,
        'max_tokens': 500
    }
}


@app.get('/model/profiles')
async def get_model_profiles():
    """Получить профили моделей"""
    return {'profiles': MODEL_PROFILES, 'current': ollama.model}


@app.post('/model/profile/{profile_name}')
async def set_model_profile(profile_name: str):
    """Применить профиль модели"""
    if profile_name not in MODEL_PROFILES:
        raise HTTPException(404, f'Профиль {profile_name} не найден')
    profile = MODEL_PROFILES[profile_name]
    ollama.model = profile['model']
    return {'profile': profile_name, 'settings': profile}


@app.get('/gpu/status')
async def gpu_status():
    """Статус GPU для UI"""
    return get_gpu_info()


@app.get('/audio/devices')
async def get_audio_devices():
    """Получить список аудио устройств"""
    return {'input': [], 'output': []}


@app.get('/vision/status')
async def vision_status():
    """Проверка доступности Vision AI"""
    model = get_available_vision_model(OLLAMA_URL)
    return {
        'available': model is not None,
        'model': model,
        'message': f'Vision модель: {model}' if model else 'Vision модель не найдена'
    }


@app.post('/vision/analyze')
async def vision_analyze(vision_request: VisionRequest):
    """Анализ изображения"""
    request = vision_request
    if not request.image_base64:
        raise HTTPException(400, 'Изображение не предоставлено')
    
    result = await analyze_image(OLLAMA_URL, ollama.model, request.image_base64, request.prompt)
    return {'analysis': result, 'model': ollama.model}


if __name__ == '__main__':
    preload_model()
    logger.info(f'[START] LLM Server on http://{HTTP_HOST}:{HTTP_PORT}')
    uvicorn.run(app, host=HTTP_HOST, port=HTTP_PORT, log_level='warning')
