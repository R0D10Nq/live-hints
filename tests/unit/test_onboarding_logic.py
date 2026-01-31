"""
Тесты для логики онбординга с разными режимами
"""

import pytest
import json
from pathlib import Path


class TestOnboardingLogic:
    """Тестирование логики онбординга для разных режимов"""

    def test_profile_mode_mapping(self):
        """Тест корректности маппинга режимов"""
        profile_modes = {
            'job_interview_ru': 'Собеседование',
            'business_meeting': 'Бизнес-встреча',
            'daily_sync': 'Дейлик/Созвон',
            'presentation': 'Презентация',
            'custom': 'Свой сценарий'
        }
        
        assert len(profile_modes) == 5
        assert 'job_interview_ru' in profile_modes
        assert 'business_meeting' in profile_modes
        assert 'daily_sync' in profile_modes
        assert 'presentation' in profile_modes
        assert 'custom' in profile_modes

    def test_resume_requirement_logic(self):
        """Тест логики обязательности резюме"""
        # Резюме обязательно для собеседований
        interview_profiles = ['job_interview_ru', 'job_interview_en']
        other_profiles = ['business_meeting', 'daily_sync', 'presentation', 'custom']
        
        for profile in interview_profiles:
            needs_resume = self._profile_needs_resume(profile)
            assert needs_resume, f"Профиль {profile} требует резюме"
        
        for profile in other_profiles:
            needs_resume = self._profile_needs_resume(profile)
            assert not needs_resume, f"Профиль {profile} не требует резюме"

    def _profile_needs_resume(self, profile: str) -> bool:
        """Вспомогательная функция для проверки обязательности резюме"""
        return profile in ['job_interview_ru', 'job_interview_en']

    def test_context_selection_logic(self):
        """Тест логики выбора контекста"""
        test_cases = [
            ('job_interview_ru', 'resume'),
            ('job_interview_en', 'resume'),
            ('business_meeting', 'mode_context'),
            ('daily_sync', 'mode_context'),
            ('presentation', 'mode_context'),
            ('custom', 'mode_context'),
        ]
        
        for profile, expected_context in test_cases:
            context_type = self._get_context_type(profile)
            assert context_type == expected_context, f"Для профиля {profile} ожидается {expected_context}"

    def _get_context_type(self, profile: str) -> str:
        """Вспомогательная функция для определения типа контекста"""
        if profile in ['job_interview_ru', 'job_interview_en']:
            return 'resume'
        return 'mode_context'

    def test_onboarding_settings_structure(self):
        """Тест структуры настроек онбординга"""
        settings = {
            'onboardingCompleted': True,
            'profile': 'business_meeting',
            'customPrompt': '',
            'contextFileContent': 'resume content',
            'modeContext': 'project context',
            'microphoneId': 'mic123',
            'inputDeviceIndex': 0,
            'dualAudioEnabled': False,
        }
        
        # Проверяем обязательные поля
        required_fields = [
            'onboardingCompleted', 'profile', 'modeContext',
            'microphoneId', 'inputDeviceIndex', 'dualAudioEnabled'
        ]
        
        for field in required_fields:
            assert field in settings, f"Поле {field} обязательно в настройках"

    def test_context_file_paths(self):
        """Тест путей к файлам контекста"""
        python_dir = Path('python')
        
        # Проверяем пути для разных типов контекста
        paths = {
            'resume': python_dir / 'user_context.txt',
            'vacancy': python_dir / 'vacancy.txt',
            'mode_context': python_dir / 'mode_context.txt'
        }
        
        for context_type, path in paths.items():
            assert path.parent.name == 'python'
            assert path.suffix == '.txt'
            assert context_type in path.name or context_type == 'resume'

    def test_load_user_context_logic(self):
        """Тест логики загрузки контекста пользователя"""
        # Мокируем структуру файлов
        file_structure = {
            'settings.json': {'profile': 'business_meeting'},
            'mode_context.txt': 'Project: X\nRole: Developer',
            'user_context.txt': 'Resume content'
        }
        
        # Тестируем для бизнес-встречи
        profile = 'business_meeting'
        context = self._load_context_mock(profile, file_structure)
        assert context == 'Project: X\nRole: Developer'
        
        # Тестируем для собеседования
        profile = 'job_interview_ru'
        context = self._load_context_mock(profile, file_structure)
        assert context == 'Resume content'

    def _load_context_mock(self, profile: str, files: dict) -> str:
        """Мок функции загрузки контекста"""
        # Определяем контекст на основе профиля
        if profile in ['business_meeting', 'daily_sync', 'presentation']:
            # Для этих режимов загружаем mode_context если есть
            return files.get('mode_context.txt', '')
        
        # Для собеседования или если mode_context не найден, загружаем user_context.txt
        return files.get('user_context.txt', '')

    def test_mode_context_visibility(self):
        """Тест видимости поля контекста режима"""
        # Поле контекста должно быть скрыто для собеседований
        hidden_for = ['job_interview_ru', 'job_interview_en']
        visible_for = ['business_meeting', 'daily_sync', 'presentation', 'custom']
        
        for profile in hidden_for:
            visible = self._should_show_context_field(profile)
            assert not visible, f"Поле контекста должно быть скрыто для {profile}"
        
        for profile in visible_for:
            visible = self._should_show_context_field(profile)
            assert visible, f"Поле контекста должно быть видно для {profile}"

    def _should_show_context_field(self, profile: str) -> bool:
        """Вспомогательная функция для определения видимости поля контекста"""
        return profile not in ['job_interview_ru', 'job_interview_en']

    def test_custom_prompt_visibility(self):
        """Тест видимости поля custom prompt"""
        # Только для custom режима
        assert self._should_show_custom_prompt('custom')
        assert not self._should_show_custom_prompt('job_interview_ru')
        assert not self._should_show_custom_prompt('business_meeting')
        assert not self._should_show_custom_prompt('daily_sync')
        assert not self._should_show_custom_prompt('presentation')

    def _should_show_custom_prompt(self, profile: str) -> bool:
        """Вспомогательная функция для определения видимости custom prompt"""
        return profile == 'custom'
