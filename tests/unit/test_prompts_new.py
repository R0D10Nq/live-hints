"""
Тесты для модуля prompts
"""

import pytest
from prompts import get_system_prompt, get_profile_config, get_few_shot_examples


def test_business_meeting_prompt():
    """Тест промпта для бизнес-встреч"""
    context = 'Проект X, менеджер'
    prompt = get_system_prompt('business_meeting', context)
    assert 'бизнес-встреч' in prompt.lower()
    assert context in prompt
    assert len(prompt) > 200


def test_daily_sync_prompt():
    """Тест промпта для дейликов"""
    context = 'Разработка фичи Y'
    prompt = get_system_prompt('daily_sync', context)
    assert 'дейлик' in prompt.lower() or 'созвон' in prompt.lower()
    assert context in prompt
    assert 'вчера' in prompt.lower()
    assert 'сегодня' in prompt.lower()


def test_presentation_prompt():
    """Тест промпта для презентаций"""
    context = 'Продукт Z, стартап'
    prompt = get_system_prompt('presentation', context)
    assert 'презентаци' in prompt.lower() or 'питч' in prompt.lower()
    assert context in prompt
    assert 'крючок' in prompt.lower() or 'hook' in prompt.lower()


def test_business_meeting_config():
    """Тест конфигурации бизнес-встречи"""
    config = get_profile_config('business_meeting')
    assert config['max_tokens'] == 700
    assert config['temperature'] == 0.6
    assert len(config['few_shot_examples']) > 0


def test_daily_sync_config():
    """Тест конфигурации дейликов"""
    config = get_profile_config('daily_sync')
    assert config['max_tokens'] == 500
    assert config['temperature'] == 0.5
    assert len(config['few_shot_examples']) > 0


def test_presentation_config():
    """Тест конфигурации презентаций"""
    config = get_profile_config('presentation')
    assert config['max_tokens'] == 800
    assert config['temperature'] == 0.8
    assert len(config['few_shot_examples']) > 0


def test_all_few_shot_examples():
    """Тест что few-shot примеры содержат правильные поля"""
    for profile_name in ['business_meeting', 'daily_sync', 'presentation']:
        examples = get_few_shot_examples(profile_name)
        assert len(examples) > 0
        for example in examples:
            assert 'user' in example
            assert 'assistant' in example
            assert len(example['user']) > 0
            assert len(example['assistant']) > 0
