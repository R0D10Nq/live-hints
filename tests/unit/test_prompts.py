"""
Тесты для оптимизированных промптов
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'python'))

from prompts import get_system_prompt, get_few_shot_examples


def test_get_system_prompt():
    """Тест получения system prompt"""
    prompt = get_system_prompt('interview', 'Test context')
    
    assert 'ассистент для собеседований' in prompt.lower()
    assert 'Test context' in prompt
    # Проверка что промпт короткий (< 500 символов)
    assert len(prompt) < 500, f"Prompt too long: {len(prompt)} chars"


def test_system_prompt_short():
    """Тест что промпт короткий для быстрой обработки"""
    context = 'Python developer, 3 years'
    prompt = get_system_prompt('interview', context)
    
    # Должен быть меньше 500 символов
    assert len(prompt) < 500


def test_get_few_shot_examples():
    """Тест получения few-shot примеров"""
    examples = get_few_shot_examples('interview')
    
    assert len(examples) == 3
    assert 'user' in examples[0]
    assert 'assistant' in examples[0]
    
    # Проверка контента примеров
    assert 'Расскажите о себе' in examples[0]['user']
    assert 'Python' in examples[0]['assistant']


def test_few_shot_examples_structure():
    """Тест структуры few-shot примеров"""
    examples = get_few_shot_examples('interview')
    
    for example in examples:
        assert isinstance(example, dict)
        assert 'user' in example
        assert 'assistant' in example
        assert isinstance(example['user'], str)
        assert isinstance(example['assistant'], str)
        assert len(example['user']) > 5
        assert len(example['assistant']) > 10


def test_system_prompt_contains_key_instructions():
    """Тест что промпт содержит ключевые инструкции"""
    prompt = get_system_prompt('interview', 'Context')
    
    assert 'кратко' in prompt.lower()
    assert 'markdown' in prompt.lower()
    assert 'контекст' in prompt.lower()
