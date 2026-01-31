"""
LLM Server Routes - FastAPI endpoints
"""

import json
import logging
from typing import Optional

from fastapi import HTTPException
from fastapi.responses import StreamingResponse

from llm import OllamaClient
from cache import HintCache
from metrics import log_cache_hit, log_llm_response
from semantic_cache import get_semantic_cache
from vector_db import get_vector_db
from classification import classify_question

logger = logging.getLogger('LLM')


class LLMRouter:
    """Router для LLM endpoint-ов"""

    def __init__(self, app, ollama: OllamaClient, hint_cache: HintCache):
        self.app = app
        self.ollama = ollama
        self.hint_cache = hint_cache
        self._register_routes()

    def _register_routes(self):
        """Регистрация всех endpoint-ов"""
        # Endpoint-ы зарегистрированы в llm_server.py для совместимости с тестами
        pass

    async def health(self):
        """Проверка здоровья сервера"""
        available = self.ollama._check_available()
        return {
            'status': 'ok' if available else 'ollama_unavailable',
            'model': self.ollama.model,
            'ollama_url': self.ollama.base_url,
            'last_error': None
        }

    async def generate_hint(self, request):
        """Генерация подсказки (синхронно)"""
        if not request.text or len(request.text.strip()) < 5:
            raise HTTPException(400, 'Текст слишком короткий')

        model = request.model or self.ollama.model
        logger.info(f'[API] model={model}, profile={request.profile}')

        original_model = self.ollama.model
        original_profile = self.ollama.profile

        if request.model:
            self.ollama.model = request.model
        if request.profile and request.profile != self.ollama.profile:
            self.ollama.profile = request.profile
            logger.info(f'[API] Обновлён профиль на: {request.profile}')

        try:
            hint = self.ollama.generate(
                text=request.text,
                context=request.context,
                max_tokens=request.max_tokens,
                temperature=request.temperature
            )
            stats = self.ollama.metrics.get_stats()

            from pydantic import BaseModel

            class HintResponse(BaseModel):
                hint: str
                latency_ms: int
                ttft_ms: int

            return HintResponse(
                hint=hint,
                latency_ms=stats['total_ms'],
                ttft_ms=stats['ttft_ms']
            )
        finally:
            self.ollama.model = original_model
            self.ollama.profile = original_profile

    async def generate_hint_stream(self, request):
        """Streaming генерация подсказки"""
        if not request.text or len(request.text.strip()) < 5:
            raise HTTPException(400, 'Текст слишком короткий')

        model = request.model or self.ollama.model
        logger.info(f'[API Stream] model={model}, profile={request.profile}')

        original_model = self.ollama.model
        original_profile = self.ollama.profile

        if request.model:
            self.ollama.model = request.model
        if request.profile and request.profile != self.ollama.profile:
            self.ollama.profile = request.profile
            logger.info(f'[API Stream] Обновлён профиль на: {request.profile}')

        vector_db = get_vector_db()
        instant_answer = vector_db.get_instant_answer(request.text)
        cached = instant_answer or self.hint_cache.get(request.text, request.context or [])
        question_type = classify_question(request.text)

        async def stream():
            try:
                if cached:
                    log_cache_hit(request.text)
                    log_llm_response(0, 0, len(cached), cached=True, question_type=question_type)
                    yield f"data: {json.dumps({'chunk': cached, 'cached': True, 'question_type': question_type}, ensure_ascii=False)}\n\n"
                    yield f"data: {json.dumps({'done': True, 'cached': True, 'question_type': question_type, 'latency_ms': 0, 'ttft_ms': 0}, ensure_ascii=False)}\n\n"
                else:
                    async for chunk in self.ollama.generate_stream(
                        request.text, request.context,
                        request.max_tokens, request.temperature,
                        request.system_prompt, request.user_context
                    ):
                        yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"

                    stats = self.ollama.metrics.get_stats()
                    q_type = getattr(self.ollama, '_last_question_type', question_type)
                    yield f"data: {json.dumps({'done': True, 'question_type': q_type, 'latency_ms': stats['total_ms'], 'ttft_ms': stats['ttft_ms']}, ensure_ascii=False)}\n\n"
            finally:
                self.ollama.model = original_model
                self.ollama.profile = original_profile

        return StreamingResponse(stream(), media_type='text/event-stream')

    async def clear_cache(self):
        """Очистка кэша"""
        try:
            self.hint_cache.clear()
            semantic_cache = get_semantic_cache()
            semantic_cache.clear()
            vector_db = get_vector_db()
            if hasattr(vector_db, 'clear'):
                vector_db.clear()
            logger.info('[API] Кэши очищены')
            return {'status': 'ok'}
        except Exception as e:
            logger.error(f'[API] Ошибка очистки кэша: {e}')
            return {'status': 'error', 'message': str(e)}

    async def get_models(self):
        """Список доступных моделей"""
        try:
            models = self.ollama.list_models()
            return {'models': models, 'current': self.ollama.model}
        except Exception as e:
            return {'models': [], 'current': self.ollama.model, 'error': str(e)}

    async def switch_model(self, model_name: str):
        """Переключение модели"""
        try:
            self.ollama.model = model_name
            logger.info(f'[API] Модель переключена на: {model_name}')
            return {'model': model_name, 'status': 'switched'}
        except Exception as e:
            logger.error(f'[API] Ошибка переключения модели: {e}')
            raise HTTPException(500, str(e))

    async def analyze_vision(self, request):
        """Анализ изображения через Vision AI"""
        try:
            from llm import analyze_image, get_available_vision_model

            if not request.image_base64:
                raise HTTPException(400, 'Изображение не предоставлено')

            vision_model = request.model or get_available_vision_model()
            logger.info(f'[Vision] Анализ изображения, model={vision_model}')

            result = analyze_image(request.image_base64, vision_model)

            from pydantic import BaseModel

            class VisionResponse(BaseModel):
                analysis: str
                model: str

            return VisionResponse(analysis=result, model=vision_model)
        except Exception as e:
            logger.error(f'[Vision] Ошибка анализа: {e}')
            raise HTTPException(500, str(e))
