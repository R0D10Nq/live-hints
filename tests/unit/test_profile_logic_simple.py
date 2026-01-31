"""
Простые тесты логики профилей без зависимостей
"""

import pytest


def test_profile_prompt_mapping():
    """Тест маппинга профилей к типам промптов"""
    
    # Правила маппинга
    INTERVIEW_PROFILES = ['job_interview_ru', 'job_interview_en']
    BUSINESS_PROFILES = ['business_meeting', 'daily_sync', 'presentation', 'custom']
    
    def get_prompt_type(profile):
        """Возвращает тип промпта для профиля"""
        if profile in BUSINESS_PROFILES:
            return 'system_prompt'
        return 'star_format'
    
    # Тесты
    assert get_prompt_type('job_interview_ru') == 'star_format'
    assert get_prompt_type('job_interview_en') == 'star_format'
    assert get_prompt_type('business_meeting') == 'system_prompt'
    assert get_prompt_type('daily_sync') == 'system_prompt'
    assert get_prompt_type('presentation') == 'system_prompt'
    assert get_prompt_type('custom') == 'system_prompt'


def test_profile_context_file_selection():
    """Тест выбора файла контекста"""
    
    def get_context_file(profile):
        """Возвращает файл контекста для профиля"""
        if profile in ['business_meeting', 'daily_sync', 'presentation', 'custom']:
            return 'mode_context.txt'
        return 'user_context.txt'
    
    # Тесты
    assert get_context_file('job_interview_ru') == 'user_context.txt'
    assert get_context_file('job_interview_en') == 'user_context.txt'
    assert get_context_file('business_meeting') == 'mode_context.txt'
    assert get_context_file('daily_sync') == 'mode_context.txt'
    assert get_context_file('presentation') == 'mode_context.txt'
    assert get_context_file('custom') == 'mode_context.txt'


def test_profile_prompt_content():
    """Тест содержимого промптов для разных профилей"""
    
    def get_prompt_content(profile, context):
        """Возвращает содержимое промпта"""
        if profile in ['business_meeting', 'daily_sync', 'presentation', 'custom']:
            # Для бизнес-профилей используем системный промпт
            if profile == 'business_meeting':
                return f"Ты AI-ассистент для бизнес-встреч. Контекст: {context}"
            elif profile == 'daily_sync':
                return f"Ты AI-ассистент для дейликов. Контекст: {context}"
            elif profile == 'presentation':
                return f"Ты AI-ассистент для презентаций. Контекст: {context}"
            else:  # custom
                return f"Ты AI-ассистент. Контекст: {context}"
        else:
            # Для собеседований используем STAR формат
            return "Ты AI-ассистент для технических собеседований. Формат STAR..."
    
    # Тесты
    business_prompt = get_prompt_content('business_meeting', 'Project X')
    assert 'бизнес-встреч' in business_prompt
    assert 'Project X' in business_prompt
    
    interview_prompt = get_prompt_content('job_interview_ru', 'Resume')
    assert 'собеседований' in interview_prompt
    assert 'STAR' in interview_prompt


def test_profile_priority():
    """Тест приоритета профилей"""
    
    def resolve_profile(request_profile, stored_profile):
        """Разрешает профиль: используем из запроса, иначе сохранённый"""
        return request_profile if request_profile else stored_profile
    
    # Тесты
    assert resolve_profile('business_meeting', 'job_interview_ru') == 'business_meeting'
    assert resolve_profile('', 'job_interview_ru') == 'job_interview_ru'
    assert resolve_profile(None, 'daily_sync') == 'daily_sync'


def test_profile_validation():
    """Тест валидации профилей"""
    
    VALID_PROFILES = [
        'job_interview_ru', 'job_interview_en',
        'business_meeting', 'daily_sync', 
        'presentation', 'custom'
    ]
    
    def is_valid_profile(profile):
        """Проверяет валидность профиля"""
        return profile in VALID_PROFILES
    
    # Тесты
    assert is_valid_profile('business_meeting') is True
    assert is_valid_profile('job_interview_ru') is True
    assert is_valid_profile('invalid_profile') is False
    assert is_valid_profile('') is False


def test_profile_context_combination():
    """Тест комбинации профиля и контекста"""
    
    def build_final_prompt(profile, context):
        """Строит финальный промпт"""
        # Выбираем тип промпта
        if profile in ['business_meeting', 'daily_sync', 'presentation', 'custom']:
            # Бизнес-профиль
            prompt_type = "business"
        else:
            # Профиль собеседования
            prompt_type = "interview"
        
        # Выбираем контекст
        if profile in ['business_meeting', 'daily_sync', 'presentation', 'custom']:
            context_source = "mode_context"
        else:
            context_source = "user_context"
        
        return f"Type: {prompt_type}, Context: {context_source}, Content: {context}"
    
    # Тесты
    result = build_final_prompt('business_meeting', 'Project info')
    assert 'Type: business' in result
    assert 'Context: mode_context' in result
    assert 'Project info' in result
    
    result = build_final_prompt('job_interview_ru', 'Resume info')
    assert 'Type: interview' in result
    assert 'Context: user_context' in result
    assert 'Resume info' in result
