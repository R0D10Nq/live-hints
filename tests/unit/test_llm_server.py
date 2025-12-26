"""
Интеграционные тесты для LLM сервера
"""

import pytest
import json
import asyncio
from unittest.mock import Mock, patch, MagicMock, AsyncMock
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'python'))

from cache import HintCache
from classification import classify_question
from prompts import get_system_prompt, get_few_shot_examples


class TestHintCache:
    """Тесты для HintCache"""
    
    def test_init(self):
        """Должен инициализироваться с maxsize"""
        cache = HintCache(maxsize=10)
        assert cache.maxsize == 10
    
    def test_set_and_get(self):
        """Должен сохранять и возвращать значения"""
        cache = HintCache(maxsize=10)
        cache.set("вопрос", ["контекст"], "ответ")
        result = cache.get("вопрос", ["контекст"])
        assert result == "ответ"
    
    def test_get_miss(self):
        """Должен возвращать None при промахе"""
        cache = HintCache(maxsize=10)
        result = cache.get("несуществующий", [])
        assert result is None
    
    def test_lru_eviction(self):
        """Должен удалять старые записи при переполнении"""
        cache = HintCache(maxsize=2)
        cache.set("q1", [], "a1")
        cache.set("q2", [], "a2")
        cache.set("q3", [], "a3")
        
        # q1 должен быть вытеснен
        assert cache.get("q1", []) is None
        assert cache.get("q2", []) == "a2"
        assert cache.get("q3", []) == "a3"
    
    def test_context_affects_key(self):
        """Разный контекст должен давать разные ключи"""
        cache = HintCache(maxsize=10)
        cache.set("вопрос", ["контекст1"], "ответ1")
        cache.set("вопрос", ["контекст2"], "ответ2")
        
        assert cache.get("вопрос", ["контекст1"]) == "ответ1"
        assert cache.get("вопрос", ["контекст2"]) == "ответ2"


class TestClassifyQuestion:
    """Тесты для classify_question"""
    
    def test_technical_question(self):
        """Должен классифицировать технические вопросы"""
        result = classify_question("Что такое REST API?")
        assert result in ['technical', 'general']
    
    def test_experience_question(self):
        """Должен классифицировать вопросы об опыте"""
        result = classify_question("Расскажите о вашем опыте работы")
        assert result in ['experience', 'general']
    
    def test_general_question(self):
        """Должен классифицировать общие вопросы"""
        result = classify_question("Как дела?")
        assert result == 'general'
    
    def test_empty_question(self):
        """Должен обрабатывать пустой вопрос"""
        result = classify_question("")
        assert result == 'general'
    
    def test_short_question(self):
        """Должен обрабатывать короткий вопрос"""
        result = classify_question("Да")
        assert result == 'general'


class TestSystemPrompts:
    """Тесты для системных промптов"""
    
    def test_get_system_prompt_interview(self):
        """Должен возвращать промпт для интервью"""
        prompt = get_system_prompt('interview')
        assert prompt is not None
        assert len(prompt) > 0
    
    def test_get_system_prompt_unknown(self):
        """Должен возвращать дефолтный промпт для неизвестного профиля"""
        prompt = get_system_prompt('unknown_profile')
        assert prompt is not None
    
    def test_get_few_shot_examples(self):
        """Должен возвращать few-shot примеры"""
        examples = get_few_shot_examples('interview')
        assert isinstance(examples, list)


class TestHintRequest:
    """Тесты для модели HintRequest"""
    
    def test_default_values(self):
        """Должен иметь дефолтные значения"""
        from pydantic import BaseModel
        from typing import Optional
        
        class HintRequest(BaseModel):
            text: str
            context: Optional[list] = None
            stream: bool = False
            profile: str = 'interview'
            max_tokens: Optional[int] = 500
            temperature: Optional[float] = 0.8
            model: Optional[str] = None
            system_prompt: Optional[str] = None
            user_context: Optional[str] = None
        
        request = HintRequest(text="тест")
        assert request.text == "тест"
        assert request.context is None
        assert request.stream is False
        assert request.profile == 'interview'
        assert request.max_tokens == 500
        assert request.temperature == 0.8
        assert request.model is None
        assert request.system_prompt is None
        assert request.user_context is None
    
    def test_custom_values(self):
        """Должен принимать кастомные значения"""
        from pydantic import BaseModel
        from typing import Optional
        
        class HintRequest(BaseModel):
            text: str
            context: Optional[list] = None
            profile: str = 'interview'
            max_tokens: Optional[int] = 500
            system_prompt: Optional[str] = None
            user_context: Optional[str] = None
        
        request = HintRequest(
            text="вопрос",
            context=["контекст1", "контекст2"],
            profile="custom",
            max_tokens=200,
            system_prompt="Мой промпт",
            user_context="Мое резюме"
        )
        
        assert request.text == "вопрос"
        assert request.context == ["контекст1", "контекст2"]
        assert request.profile == "custom"
        assert request.max_tokens == 200
        assert request.system_prompt == "Мой промпт"
        assert request.user_context == "Мое резюме"


class TestBuildMessages:
    """Тесты для функции build_messages"""
    
    def test_basic_message_structure(self):
        """Должен создавать базовую структуру сообщений"""
        def build_messages(system_prompt, context, text, few_shot=None):
            messages = [{'role': 'system', 'content': system_prompt}]
            if few_shot:
                for example in few_shot:
                    messages.append({'role': 'user', 'content': example['user']})
                    messages.append({'role': 'assistant', 'content': example['assistant']})
            if context:
                for ctx in context[-5:]:
                    messages.append({'role': 'user', 'content': ctx})
            messages.append({
                'role': 'user',
                'content': f'ТЕКУЩИЙ ВОПРОС:\n{text}'
            })
            return messages
        
        messages = build_messages("Системный промпт", [], "Вопрос")
        
        assert len(messages) == 2
        assert messages[0]['role'] == 'system'
        assert messages[0]['content'] == "Системный промпт"
        assert messages[1]['role'] == 'user'
        assert 'Вопрос' in messages[1]['content']
    
    def test_with_context(self):
        """Должен добавлять контекст"""
        def build_messages(system_prompt, context, text, few_shot=None):
            messages = [{'role': 'system', 'content': system_prompt}]
            if context:
                for ctx in context[-5:]:
                    messages.append({'role': 'user', 'content': ctx})
            messages.append({'role': 'user', 'content': text})
            return messages
        
        context = ["Контекст 1", "Контекст 2"]
        messages = build_messages("Промпт", context, "Вопрос")
        
        assert len(messages) == 4  # system + 2 context + question
    
    def test_with_few_shot(self):
        """Должен добавлять few-shot примеры"""
        def build_messages(system_prompt, context, text, few_shot=None):
            messages = [{'role': 'system', 'content': system_prompt}]
            if few_shot:
                for example in few_shot:
                    messages.append({'role': 'user', 'content': example['user']})
                    messages.append({'role': 'assistant', 'content': example['assistant']})
            messages.append({'role': 'user', 'content': text})
            return messages
        
        few_shot = [
            {'user': 'Пример вопроса', 'assistant': 'Пример ответа'}
        ]
        messages = build_messages("Промпт", [], "Вопрос", few_shot)
        
        assert len(messages) == 4  # system + user + assistant + question
    
    def test_context_limit(self):
        """Должен ограничивать контекст 5 элементами"""
        def build_messages(system_prompt, context, text, few_shot=None):
            messages = [{'role': 'system', 'content': system_prompt}]
            if context:
                for ctx in context[-5:]:
                    messages.append({'role': 'user', 'content': ctx})
            messages.append({'role': 'user', 'content': text})
            return messages
        
        context = ["C1", "C2", "C3", "C4", "C5", "C6", "C7"]
        messages = build_messages("Промпт", context, "Вопрос")
        
        # system + 5 context (ограничение) + question = 7
        assert len(messages) == 7


class TestHintMetrics:
    """Тесты для HintMetrics"""
    
    def test_init(self):
        """Должен инициализироваться с null значениями"""
        class HintMetrics:
            def __init__(self):
                self.reset()
            
            def reset(self):
                self.t_request = None
                self.t_first_token = None
                self.t_done = None
        
        metrics = HintMetrics()
        assert metrics.t_request is None
        assert metrics.t_first_token is None
        assert metrics.t_done is None
    
    def test_get_stats(self):
        """Должен вычислять статистику"""
        import time
        
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
            
            def get_stats(self):
                return {
                    'ttft_ms': int((self.t_first_token - self.t_request) * 1000) if self.t_request and self.t_first_token else 0,
                    'total_ms': int((self.t_done - self.t_request) * 1000) if self.t_request and self.t_done else 0
                }
        
        metrics = HintMetrics()
        metrics.request_started()
        time.sleep(0.01)
        metrics.first_token()
        time.sleep(0.01)
        metrics.done()
        
        stats = metrics.get_stats()
        assert stats['ttft_ms'] >= 0
        assert stats['total_ms'] >= stats['ttft_ms']


class TestCacheClear:
    """Тесты для очистки кэша"""
    
    def test_clear_hint_cache(self):
        """Должен очищать HintCache"""
        cache = HintCache(maxsize=10)
        cache.set("q1", [], "a1")
        cache.set("q2", [], "a2")
        
        cache.cache.clear()
        
        assert cache.get("q1", []) is None
        assert cache.get("q2", []) is None


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
