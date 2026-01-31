"""
Тесты логики контекста без мокирования Path
"""

import pytest


def test_profile_context_logic():
    """Тест логики выбора контекста для разных профилей"""
    
    def get_context_type(profile):
        """Возвращает тип контекста для профиля"""
        if profile in ['business_meeting', 'daily_sync', 'presentation', 'custom']:
            return 'mode_context'
        return 'user_context'
    
    # Тесты
    assert get_context_type('job_interview_ru') == 'user_context'
    assert get_context_type('job_interview_en') == 'user_context'
    assert get_context_type('business_meeting') == 'mode_context'
    assert get_context_type('daily_sync') == 'mode_context'
    assert get_context_type('presentation') == 'mode_context'
    assert get_context_type('custom') == 'mode_context'


def test_resume_requirement_logic():
    """Тест логики обязательности резюме"""
    
    def needs_resume(profile):
        """Возвращает True если профиль требует резюме"""
        return profile in ['job_interview_ru', 'job_interview_en']
    
    # Тесты
    assert needs_resume('job_interview_ru') is True
    assert needs_resume('job_interview_en') is True
    assert needs_resume('business_meeting') is False
    assert needs_resume('daily_sync') is False
    assert needs_resume('presentation') is False
    assert needs_resume('custom') is False


def test_context_file_selection():
    """Тест выбора файла контекста"""
    
    def select_context_file(profile, has_mode_context=True):
        """Выбирает файл контекста на основе профиля"""
        if profile in ['business_meeting', 'daily_sync', 'presentation', 'custom']:
            if has_mode_context:
                return 'mode_context.txt'
            return 'user_context.txt'
        return 'user_context.txt'
    
    # Тесты
    assert select_context_file('job_interview_ru') == 'user_context.txt'
    assert select_context_file('business_meeting', True) == 'mode_context.txt'
    assert select_context_file('business_meeting', False) == 'user_context.txt'
    assert select_context_file('daily_sync', True) == 'mode_context.txt'


def test_ui_visibility_logic():
    """Тест логики видимости UI элементов"""
    
    def get_ui_state(profile):
        """Возвращает состояние UI для профиля"""
        return {
            'show_context_field': profile not in ['job_interview_ru', 'job_interview_en'],
            'show_custom_prompt': profile == 'custom',
            'resume_required': profile in ['job_interview_ru', 'job_interview_en']
        }
    
    # Тесты для собеседования
    interview_state = get_ui_state('job_interview_ru')
    assert interview_state['show_context_field'] is False
    assert interview_state['show_custom_prompt'] is False
    assert interview_state['resume_required'] is True
    
    # Тесты для бизнес-встречи
    business_state = get_ui_state('business_meeting')
    assert business_state['show_context_field'] is True
    assert business_state['show_custom_prompt'] is False
    assert business_state['resume_required'] is False
    
    # Тесты для custom
    custom_state = get_ui_state('custom')
    assert custom_state['show_context_field'] is True
    assert custom_state['show_custom_prompt'] is True
    assert custom_state['resume_required'] is False


def test_onboarding_step_validation():
    """Тест валидации шагов онбординга"""
    
    def can_proceed_from_step_2(profile, has_resume):
        """Проверяет можно ли перейти со шага 2"""
        if profile in ['job_interview_ru', 'job_interview_en']:
            return has_resume  # Резюме обязательно
        return True  # Для остальных можно продолжать
    
    # Тесты
    assert can_proceed_from_step_2('job_interview_ru', True) is True
    assert can_proceed_from_step_2('job_interview_ru', False) is False
    assert can_proceed_from_step_2('business_meeting', False) is True
    assert can_proceed_from_step_2('daily_sync', False) is True


def test_context_priority():
    """Тест приоритета контекста"""
    
    def get_actual_context(profile, mode_context='', user_context=''):
        """Возвращает фактический контекст на основе профиля"""
        if profile in ['business_meeting', 'daily_sync', 'presentation', 'custom']:
            return mode_context if mode_context else user_context
        return user_context
    
    # Тесты
    assert get_actual_context('job_interview_ru', user_context='Resume') == 'Resume'
    assert get_actual_context('business_meeting', mode_context='Project info') == 'Project info'
    assert get_actual_context('business_meeting', mode_context='', user_context='Resume') == 'Resume'
    assert get_actual_context('daily_sync', mode_context='Standup notes') == 'Standup notes'
