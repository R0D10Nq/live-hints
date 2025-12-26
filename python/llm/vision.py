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


def get_available_vision_model(ollama_url: str) -> Optional[str]:
    """Проверить наличие Vision модели в Ollama"""
    try:
        resp = requests.get(f'{ollama_url}/api/tags', timeout=5)
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


async def analyze_image(ollama_url: str, default_model: str, image_base64: str, prompt: str) -> dict:
    """Анализ изображения с помощью Vision AI"""
    vision_model = get_available_vision_model(ollama_url)
    if not vision_model:
        return {'error': 'Vision модель не установлена', 'hint': 'ollama pull llava:7b'}
    
    logger.info(f'[Vision] Анализ с {vision_model}...')
    
    # Выгружаем текстовую модель чтобы освободить GPU память
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(f'{ollama_url}/api/generate', json={'model': default_model, 'keep_alive': 0})
        logger.info(f'[Vision] {default_model} выгружена')
        await asyncio.sleep(1)
    except:
        pass
    
    # Запрос к Vision модели
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(
                f'{ollama_url}/api/chat',
                json={
                    'model': vision_model,
                    'messages': [{'role': 'user', 'content': prompt, 'images': [image_base64]}],
                    'stream': False,
                    'keep_alive': 0,
                    'options': {'temperature': 0.3, 'num_predict': 500}
                }
            )
            
            if resp.status_code == 200:
                data = resp.json()
                analysis = data.get('message', {}).get('content', '')
                logger.info(f'[Vision] Готово: {len(analysis)} символов')
                
                # Загружаем обратно текстовую модель
                try:
                    async with httpx.AsyncClient(timeout=5.0) as c:
                        await c.post(f'{ollama_url}/api/generate', json={'model': default_model, 'prompt': '', 'keep_alive': -1})
                except:
                    pass
                
                return {'analysis': analysis, 'model': vision_model}
            else:
                logger.error(f'[Vision] Ошибка {resp.status_code}')
                return {'error': f'Vision ошибка {resp.status_code}'}
                
    except httpx.TimeoutException:
        logger.error('[Vision] Таймаут')
        return {'error': 'Таймаут. Попробуйте ещё раз.'}
    except Exception as e:
        logger.error(f'[Vision] {e}')
        return {'error': str(e)}
