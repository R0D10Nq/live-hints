"""
Ollama Client - взаимодействие с Ollama API
"""

import asyncio
import json
import logging
import time
from typing import Optional

import aiohttp
import requests

from prompts import get_few_shot_examples
from classification import classify_question, build_contextual_prompt, get_max_tokens_for_type, get_temperature_for_type
from cache import HintCache
from metrics import log_llm_request, log_llm_response, log_error
from semantic_cache import get_semantic_cache
from advanced_rag import get_advanced_rag

logger = logging.getLogger('LLM')


class HintMetrics:
    """Метрики для измерения latency"""
    def __init__(self):
        self.reset()
    
    def reset(self):
        self.request_start = None
        self.first_token_time = None
        self.done_time = None
    
    def request_started(self):
        self.request_start = time.time()
    
    def first_token(self):
        if self.first_token_time is None:
            self.first_token_time = time.time()
    
    def done(self):
        self.done_time = time.time()
    
    def get_stats(self) -> dict:
        ttft = 0
        total = 0
        if self.request_start:
            if self.first_token_time:
                ttft = int((self.first_token_time - self.request_start) * 1000)
            if self.done_time:
                total = int((self.done_time - self.request_start) * 1000)
        return {
            'ttft_ms': ttft, 
            'total_ms': total
        }


def build_messages(system_prompt: str, context: list, question: str, few_shot: list = None) -> list:
    """Построение messages для Ollama API"""
    messages = [
        {
            'role': 'system', 
            'content': system_prompt
        }
    ]
    
    if few_shot:
        for example in few_shot:
            messages.append(
                {
                'role': 'user', 
                'content': example['user']
                }
            )
            messages.append(
                {
                    'role': 'assistant', 
                    'content': example['assistant']
                }
            )
    
    if context:
        context_text = '\n'.join(context[-10:])
        messages.append(
            {
                'role': 'user', 
                'content': f'Контекст разговора:\n{context_text}'
                }
            )
    
    messages.append(
        {
            'role': 'user', 
            'content': question
        }
    )
    return messages


class OllamaClient:
    """Клиент для взаимодействия с Ollama API"""
    
    def __init__(self, base_url: str, model: str, hint_cache: HintCache, user_context: str = '', profile: str = 'job_interview_ru'):
        self.base_url = base_url
        self.model = model
        self.metrics = HintMetrics()
        self.hint_cache = hint_cache
        self.user_context = user_context
        self.profile = profile  # Сохраняем профиль
        self._last_question_type = 'general'
        self._last_similarity = 0.0
    
    def _check_available(self) -> bool:
        try:
            resp = requests.get(f'{self.base_url}/api/tags', timeout=2)
            return resp.status_code == 200
        except:
            return False

    def list_models(self) -> list:
        """Получить список доступных моделей от Ollama"""
        try:
            resp = requests.get(f'{self.base_url}/api/tags', timeout=5)
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
                return models
            raise Exception(f'Ollama returned {resp.status_code}')
        except Exception as e:
            logger.error(f'[OllamaClient] Ошибка получения моделей: {e}')
            raise
    
    def generate(self, text: str, context: list = None, system_prompt: str = None, 
                 profile: str = 'interview', max_tokens: int = 500, temperature: float = 0.8) -> str:
        """Синхронная генерация подсказки"""
        self.metrics.reset()
        self.metrics.request_started()
        
        cached = self.hint_cache.get(text, context or [])
        if cached:
            self.metrics.first_token()
            self.metrics.done()
            return cached
        
        max_tokens = max(50, min(1000, max_tokens or 800))
        temperature = max(0.0, min(1.0, temperature or 0.8))
        
        question_type = classify_question(text)
        logger.info(f'[CLASSIFY] Type: {question_type}')
        
        system_prompt = build_contextual_prompt(question_type, self.user_context, self.profile)
        few_shot = get_few_shot_examples(self.profile)
        messages = build_messages(system_prompt, context or [], text, few_shot)
        
        logger.info(f'[LLM] Type: {question_type}, messages: {len(messages)}')
        
        try:
            resp = requests.post(
                f'{self.base_url}/api/chat',
                json={
                    'model': self.model,
                    'messages': messages,
                    'stream': False,
                    'keep_alive': -1,
                    'options': {
                        'temperature': temperature, 
                        'num_predict': max_tokens, 
                        'top_p': 0.9
                        }
                },
                timeout=60
            )
            
            self.metrics.first_token()
            self.metrics.done()
            
            if resp.status_code == 200:
                data = resp.json()
                hint = self._extract_hint(data)
                stats = self.metrics.get_stats()
                logger.info(f'[LLM] Подсказка за {stats["total_ms"]}ms, len={len(hint)}')
                
                if hint.strip():
                    self.hint_cache.set(text, context or [], hint)
                return hint
            else:
                logger.error(f'[LLM] Ollama ошибка: {resp.status_code}')
                return f'Ошибка Ollama: {resp.status_code}'
                
        except requests.exceptions.ConnectionError:
            return 'Ollama не запущен. Запустите: ollama serve'
        except Exception as e:
            logger.error(f'[LLM] Ошибка: {e}')
            return f'Ошибка: {e}'
    
    def _extract_hint(self, data: dict) -> str:
        """Извлечение hint из ответа Ollama"""
        import re
        
        message_obj = data.get('message', {})
        hint = ''
        
        if isinstance(message_obj, dict):
            hint = message_obj.get('content', '')
            
            if not hint and 'thinking' in message_obj:
                thinking_text = message_obj.get('thinking', '')
                if thinking_text:
                    quotes = re.findall(r'"([^"]{5,})"', thinking_text)
                    if quotes:
                        hint = quotes[-1]
                    else:
                        sentences = [s.strip() for s in thinking_text.replace('\n', ' ').split('.') if s.strip()]
                        if sentences:
                            hint = '. '.join(sentences[-2:]) + '.'
        
        if not hint:
            hint = data.get('response', '')
        if not hint:
            hint = data.get('content', '')
        if not hint and 'choices' in data:
            choices = data.get('choices', [])
            if choices:
                hint = choices[0].get('message', {}).get('content', '')
        
        return hint
    
    async def generate_stream(self, text: str, context: list = None, profile: str = 'interview',
                              max_tokens: int = 500, temperature: float = 0.8,
                              custom_system_prompt: str = None, custom_user_context: str = None):
        """Async streaming генерация подсказки"""
        self.metrics.reset()
        self.metrics.request_started()
        self._last_question_type = 'general'
        
        semantic_cache = get_semantic_cache()
        cached, similarity = semantic_cache.get(text, context or [])
        if cached:
            self.metrics.first_token()
            self.metrics.done()
            self._last_similarity = similarity
            logger.info(f'[SemanticCache] HIT: similarity={similarity:.3f}')
            yield cached
            return
        
        cached_lru = self.hint_cache.get(text, context or [])
        if cached_lru:
            self.metrics.first_token()
            self.metrics.done()
            yield cached_lru
            return
        
        question_type = classify_question(text)
        self._last_question_type = question_type
        logger.info(f'[CLASSIFY Stream] Type: {question_type}')
        
        recommended_tokens = get_max_tokens_for_type(question_type)
        recommended_temp = get_temperature_for_type(question_type)
        max_tokens = max(50, min(1000, max_tokens or recommended_tokens))
        # Конвертируем temperature в float если это строка
        if isinstance(temperature, str):
            try:
                temperature = float(temperature)
            except ValueError:
                temperature = recommended_temp
        
        temperature = max(0.0, min(1.0, temperature or recommended_temp))
        
        log_llm_request(text, len(context or []), question_type, self.profile)
        
        effective_user_context = custom_user_context if custom_user_context else self.user_context
        
        rag = get_advanced_rag()
        
        if custom_system_prompt:
            base_prompt = custom_system_prompt + '\n\n' + build_contextual_prompt(question_type, effective_user_context, self.profile)
        else:
            base_prompt = build_contextual_prompt(question_type, effective_user_context, self.profile)
        
        system_prompt = rag.build_enhanced_prompt(text, context or [], question_type, base_prompt)
        adaptive_context = rag.get_adaptive_context(context or [], text)
        few_shot = get_few_shot_examples(self.profile)
        messages = build_messages(system_prompt, adaptive_context, text, few_shot)
        
        logger.info(f'[LLM Stream] Type: {question_type}, messages: {len(messages)}')
        
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
                                            self.hint_cache.set(text, context or [], accumulated_hint)
                                            semantic_cache.set(text, context or [], accumulated_hint)
                                            rag.consolidate_memory(text, accumulated_hint, question_type)
                                        stats = self.metrics.get_stats()
                                        log_llm_response(
                                            stats['ttft_ms'], stats['total_ms'], len(accumulated_hint),
                                            cached=False, question_type=question_type
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
