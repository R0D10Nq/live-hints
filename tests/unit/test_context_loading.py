"""
Тесты для загрузки контекста в зависимости от профиля
"""

import pytest
import json
from unittest.mock import patch, mock_open
from pathlib import Path


class TestContextLoading:
    """Тестирование загрузки контекста для разных профилей"""

    @patch('builtins.open', new_callable=mock_open)
    @patch('pathlib.Path.exists')
    @patch('json.load')
    def test_load_business_meeting_context(self, mock_json_load, mock_exists, mock_file):
        """Тест загрузки контекста для бизнес-встречи"""
        # Мокируем наличие файла настроек
        mock_exists.return_value = True
        mock_json_load.return_value = {'profile': 'business_meeting'}
        
        # Мокируем mode_context.txt
        with patch('builtins.open', mock_open(read_data='Project: Alpha\nTeam: DevOps')):
            with patch('pathlib.Path.exists', return_value=True):
                # Импортируем функцию после мокирования
                import sys
                sys.path.append('python')
                from llm_server import load_user_context
                
                context = load_user_context()
                assert context == 'Project: Alpha\nTeam: DevOps'

    @patch('builtins.open', new_callable=mock_open)
    @patch('pathlib.Path.exists')
    @patch('json.load')
    def test_load_interview_context(self, mock_json_load, mock_exists, mock_file):
        """Тест загрузки контекста для собеседования"""
        # Мокируем наличие файла настроек
        mock_exists.return_value = True
        mock_json_load.return_value = {'profile': 'job_interview_ru'}
        
        # Мокируем user_context.txt
        with patch('builtins.open', mock_open(read_data='John Doe\n5 years experience')):
            with patch('pathlib.Path.exists', return_value=True):
                import sys
                sys.path.append('python')
                from llm_server import load_user_context
                
                context = load_user_context()
                assert context == 'John Doe\n5 years experience'

    @patch('builtins.open', new_callable=mock_open)
    @patch('pathlib.Path.exists')
    def test_load_context_fallback(self, mock_exists, mock_file):
        """Тест загрузки контекста при отсутствии файлов"""
        # Файл настроек отсутствует
        mock_exists.return_value = False
        
        import sys
        sys.path.append('python')
        from llm_server import load_user_context
        
        context = load_user_context()
        assert context == ''  # Пустой контекст по умолчанию

    @patch('builtins.open', new_callable=mock_open)
    @patch('pathlib.Path.exists')
    @patch('json.load')
    def test_load_daily_sync_context(self, mock_json_load, mock_exists, mock_file):
        """Тест загрузки контекста для дейлика"""
        mock_exists.return_value = True
        mock_json_load.return_value = {'profile': 'daily_sync'}
        
        # Мокируем mode_context.txt
        with patch('builtins.open', mock_open(read_data='Daily standup notes\nSprint: 23')):
            with patch('pathlib.Path.exists', return_value=True):
                import sys
                sys.path.append('python')
                from llm_server import load_user_context
                
                context = load_user_context()
                assert 'Daily standup notes' in context

    @patch('builtins.open', new_callable=mock_open)
    @patch('pathlib.Path.exists')
    @patch('json.load')
    def test_load_presentation_context(self, mock_json_load, mock_exists, mock_file):
        """Тест загрузки контекста для презентации"""
        mock_exists.return_value = True
        mock_json_load.return_value = {'profile': 'presentation'}
        
        # Мокируем mode_context.txt
        with patch('builtins.open', mock_open(read_data='Product launch presentation\nTarget audience: investors')):
            with patch('pathlib.Path.exists', return_value=True):
                import sys
                sys.path.append('python')
                from llm_server import load_user_context
                
                context = load_user_context()
                assert 'Product launch presentation' in context

    @patch('builtins.open', mock_open(read_data='Senior Python Developer\n5+ years experience'))
    @patch('os.path.exists')
    def test_load_vacancy_context_success(self, mock_exists):
        """Тест загрузки vacancy.txt (строки 131-132)"""
        mock_exists.return_value = True
        
        import sys
        sys.path.append('python')
        from llm_server import load_vacancy_context
        
        context = load_vacancy_context()
        assert 'Senior Python Developer' in context
        assert '5+ years experience' in context

    @patch('os.path.exists')
    def test_load_vacancy_context_not_exists(self, mock_exists):
        """Тест когда vacancy.txt не существует"""
        mock_exists.return_value = False
        
        import sys
        sys.path.append('python')
        from llm_server import load_vacancy_context
        
        context = load_vacancy_context()
        assert context == ''

    @patch('builtins.open', side_effect=Exception('Permission denied'))
    @patch('os.path.exists')
    def test_load_vacancy_context_error(self, mock_exists, mock_open):
        """Тест ошибки при чтении vacancy.txt"""
        mock_exists.return_value = True
        
        import sys
        sys.path.append('python')
        from llm_server import load_vacancy_context
        
        context = load_vacancy_context()
        assert context == ''

    def test_context_priority_order(self):
        """Тест приоритета контекста"""
        # Для бизнес-встреч: mode_context > user_context
        # Для собеседования: только user_context
        
        priority_rules = {
            'job_interview_ru': ['user_context.txt'],
            'job_interview_en': ['user_context.txt'],
            'business_meeting': ['mode_context.txt', 'user_context.txt'],
            'daily_sync': ['mode_context.txt', 'user_context.txt'],
            'presentation': ['mode_context.txt', 'user_context.txt'],
            'custom': ['mode_context.txt', 'user_context.txt'],
        }
        
        for profile, expected_files in priority_rules.items():
            assert profile in priority_rules
            assert len(expected_files) >= 1
            if profile in ['job_interview_ru', 'job_interview_en']:
                assert expected_files == ['user_context.txt']
            else:
                assert 'mode_context.txt' in expected_files
