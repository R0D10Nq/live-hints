"""
Vision AI - анализ изображений через Ollama Vision модели
"""

import asyncio
import logging
from typing import Optional

import httpx
import requests

logger = logging.getLogger('LLM')

# Доступные Vision модели (в порядке приоритета)
VISION_MODELS = ['llava:13b', 'llava:7b', 'llava:latest', 'bakllava:latest']

# Локальный Ollama не должен ходить через системный прокси Windows
_NO_PROXY = {'http': '', 'https': ''}


def get_available_vision_model(ollama_url: str) -> Optional[str]:
    """Проверить наличие Vision модели в Ollama"""
    try:
        resp = requests.get(f'{ollama_url}/api/tags', timeout=5, proxies=_NO_PROXY)
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
        logger.warning(f'[Vision] Failed to list models: {e}')
    return None


async def analyze_image(
    ollama_url: str, default_model: str, image_base64: str, prompt: str
) -> dict[str, str]:
    """
    Анализ изображения с помощью Vision AI.

    Возвращает либо {'analysis': str, 'model': str}, либо {'error': str[, 'hint': str]}.
    Текст ошибки безопасен для показа пользователю и не содержит деталей исключений.
    """
    vision_model = get_available_vision_model(ollama_url)
    if not vision_model:
        return {'error': 'Vision модель не установлена', 'hint': 'ollama pull llava:7b'}

    logger.info(f'[Vision] Analyzing with {vision_model}')

    # Выгружаем текстовую модель, чтобы освободить память GPU
    try:
        async with httpx.AsyncClient(timeout=5.0, trust_env=False) as client:
            await client.post(
                f'{ollama_url}/api/generate',
                json={'model': default_model, 'keep_alive': 0},
            )
        await asyncio.sleep(1)
    except httpx.HTTPError as e:
        logger.warning(f'[Vision] Failed to unload text model: {e}')

    try:
        async with httpx.AsyncClient(timeout=90.0, trust_env=False) as client:
            resp = await client.post(
                f'{ollama_url}/api/chat',
                json={
                    'model': vision_model,
                    'messages': [
                        {'role': 'user', 'content': prompt, 'images': [image_base64]}
                    ],
                    'stream': False,
                    'keep_alive': 0,
                    'options': {'temperature': 0.3, 'num_predict': 500},
                },
            )

            if resp.status_code != 200:
                logger.error(f'[Vision] Ollama status {resp.status_code}')
                return {'error': f'Vision модель вернула ошибку {resp.status_code}'}

            analysis = str(resp.json().get('message', {}).get('content', '')).strip()
            logger.info(f'[Vision] Done: {len(analysis)} chars')

        # Загружаем обратно текстовую модель
        try:
            async with httpx.AsyncClient(timeout=5.0, trust_env=False) as client:
                await client.post(
                    f'{ollama_url}/api/generate',
                    json={'model': default_model, 'prompt': '', 'keep_alive': -1},
                )
        except httpx.HTTPError as e:
            logger.warning(f'[Vision] Failed to reload text model: {e}')

        if not analysis:
            return {'error': 'Vision модель вернула пустой ответ'}
        return {'analysis': analysis, 'model': vision_model}

    except httpx.TimeoutException:
        logger.error('[Vision] Timeout')
        return {'error': 'Таймаут анализа изображения. Попробуйте ещё раз.'}
    except Exception as e:
        logger.error(f'[Vision] Unexpected error: {e}')
        return {'error': 'Не удалось проанализировать изображение'}
