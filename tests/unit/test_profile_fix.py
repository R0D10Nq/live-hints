"""
Тесты для исправлений профилей
"""

import pytest
from unittest.mock import patch, mock_open, MagicMock
import sys
import os

# Добавляем путь к python модулям
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'python'))

def test_build_contextual_prompt_uses_profile():
    """Тест: build_contextual_prompt использует профиль"""
    from classification import build_contextual_prompt
    
    # Для бизнес-встречи
    result = build_contextual_prompt("general", "context", "business_meeting")
    assert "бизнес-встреч" in result
    assert "## ВАЖНО: Отвечай на ПОСЛЕДНИЙ вопрос" not in result
    
    # Для собеседования должен использовать STAR формат только для вопросов про опыт
    result = build_contextual_prompt("experience", "context", "job_interview_ru")
    assert "технических собеседований" in result
    assert "STAR" in result
    
    # Для других типов вопросов в собеседовании
    result = build_contextual_prompt("general", "context", "job_interview_ru")
    assert "технических собеседований" in result
    assert "## ВАЖНО: Отвечай на ПОСЛЕДНИЙ вопрос" in result
    
    # Для других профилей
    result = build_contextual_prompt("general", "context", "daily_sync")
    assert "командных созвонов" in result
    
    result = build_contextual_prompt("general", "context", "presentation")
    assert "презентаций" in result


def test_ollama_client_uses_profile():
    """Тест: OllamaClient сохраняет и использует профиль"""
    from llm.ollama_client import OllamaClient
    from cache import HintCache
    
    cache = HintCache(maxsize=10)
    client = OllamaClient("http://localhost:11434", "model", cache, "context", "business_meeting")
    
    assert client.profile == "business_meeting"
    
    # Проверяем, что профиль по умолчанию правильный
    client_default = OllamaClient("http://localhost:11434", "model", cache, "context")
    assert client_default.profile == "job_interview_ru"


def test_load_user_profile():
    """Тест загрузки профиля из файла"""
    with patch('builtins.open', mock_open(read_data='{"profile": "business_meeting"}')):
        with patch('os.path.exists', return_value=True):
            from llm_server import load_user_profile
            
            profile = load_user_profile()
            assert profile == "business_meeting"


def test_profile_context_flow():
    """Тест полного потока: профиль -> контекст -> промпт"""
    
    # 1. Загружаем профиль
    with patch('builtins.open', mock_open(read_data='{"profile": "business_meeting"}')):
        with patch('os.path.exists', return_value=True):
            with patch('json.load', return_value={"profile": "business_meeting"}):
                from llm_server import load_user_profile, load_user_context
                
                # 2. Загружаем контекст в соответствии с профилем
                with patch('builtins.open', mock_open(read_data='Business context data')):
                    with patch('os.path.exists', return_value=True):
                        profile = load_user_profile()
                        context = load_user_context()
                        
                        assert profile == "business_meeting"
                        assert context == "Business context data"


def test_different_profiles_use_different_prompts():
    """Тест: разные профили используют разные промпты"""
    from classification import build_contextual_prompt
    
    # Бизнес встреча
    business_prompt = build_contextual_prompt("question", "context", "business_meeting")
    assert "бизнес-встреч" in business_prompt.lower()
    
    # Собеседование - STAR только для опыта
    interview_prompt = build_contextual_prompt("experience", "context", "job_interview_ru")
    assert "технических собеседований" in interview_prompt.lower()
    assert "star" in interview_prompt.lower()
    
    # Презентация
    presentation_prompt = build_contextual_prompt("question", "context", "presentation")
    assert "презентаций" in presentation_prompt.lower()
    
    # Ежедневный синк
    daily_prompt = build_contextual_prompt("question", "context", "daily_sync")
    assert "командных созвонов" in daily_prompt.lower()


def test_profile_update_in_endpoints():
    """Тест обновления профиля в приложении"""
    # Проверяем, что профиль можно загрузить и сохранить
    from llm_server import load_user_profile
    
    # Загрузка профиля по умолчанию
    profile = load_user_profile()
    assert profile in ["business_meeting", "job_interview_ru", "daily_sync", "presentation"]
    
    # В реальном приложении профиль обновляется через UI
    # и сохраняется в renderer/settings.json
