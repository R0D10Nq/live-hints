"""
Тесты для python/prompts.py
"""
import pytest


class TestGetProfileConfig:
    """Тесты для get_profile_config"""
    
    def test_interview_profile(self):
        """Возвращает interview профиль"""
        from prompts import get_profile_config
        
        config = get_profile_config('interview')
        
        assert 'system' in config
        assert 'few_shot_examples' in config
        assert 'max_tokens' in config
    
    def test_job_interview_ru(self):
        """Возвращает русский профиль"""
        from prompts import get_profile_config
        
        config = get_profile_config('job_interview_ru')
        
        assert 'AI-ассистент' in config['system']
    
    def test_job_interview_en(self):
        """Возвращает английский профиль"""
        from prompts import get_profile_config
        
        config = get_profile_config('job_interview_en')
        
        assert 'AI assistant' in config['system']
    
    def test_custom_profile(self):
        """Возвращает custom профиль"""
        from prompts import get_profile_config
        
        config = get_profile_config('custom')
        
        assert len(config['few_shot_examples']) == 0
    
    def test_unknown_profile_fallback(self):
        """Fallback на interview для неизвестного профиля"""
        from prompts import get_profile_config
        
        config = get_profile_config('nonexistent')
        
        assert 'AI-ассистент' in config['system']


class TestGetSystemPrompt:
    """Тесты для get_system_prompt"""
    
    def test_substitutes_context(self):
        """Подставляет user_context"""
        from prompts import get_system_prompt
        
        prompt = get_system_prompt('interview', 'Python Developer, 5 лет опыта')
        
        assert 'Python Developer, 5 лет опыта' in prompt
    
    def test_interview_profile(self):
        """Промпт содержит инструкции для интервью"""
        from prompts import get_system_prompt
        
        prompt = get_system_prompt('interview', 'Test resume')
        
        assert 'STAR' in prompt
        assert 'markdown' in prompt
    
    def test_custom_profile(self):
        """Custom профиль"""
        from prompts import get_system_prompt
        
        prompt = get_system_prompt('custom', 'Custom context')
        
        assert 'Custom context' in prompt
    
    def test_english_profile(self):
        """Английский профиль"""
        from prompts import get_system_prompt
        
        prompt = get_system_prompt('job_interview_en', 'English resume')
        
        assert 'English resume' in prompt
        assert 'STAR' in prompt


class TestGetFewShotExamples:
    """Тесты для get_few_shot_examples"""
    
    def test_interview_has_examples(self):
        """Interview профиль имеет примеры"""
        from prompts import get_few_shot_examples
        
        examples = get_few_shot_examples('interview')
        
        assert len(examples) >= 3
        assert 'user' in examples[0]
        assert 'assistant' in examples[0]
    
    def test_custom_no_examples(self):
        """Custom профиль без примеров"""
        from prompts import get_few_shot_examples
        
        examples = get_few_shot_examples('custom')
        
        assert examples == []
    
    def test_english_has_examples(self):
        """Английский профиль имеет примеры"""
        from prompts import get_few_shot_examples
        
        examples = get_few_shot_examples('job_interview_en')
        
        assert len(examples) >= 1
        assert 'Tell me about yourself' in examples[0]['user']


class TestProfilePrompts:
    """Тесты для PROFILE_PROMPTS"""
    
    def test_all_profiles_have_required_keys(self):
        """Все профили имеют обязательные ключи"""
        from prompts import PROFILE_PROMPTS
        
        required_keys = ['system', 'few_shot_examples', 'max_tokens', 'temperature']
        
        for profile_name, config in PROFILE_PROMPTS.items():
            for key in required_keys:
                assert key in config, f'{profile_name} missing {key}'
    
    def test_all_prompts_have_placeholder(self):
        """Все system prompts имеют placeholder для контекста"""
        from prompts import PROFILE_PROMPTS
        
        for profile_name, config in PROFILE_PROMPTS.items():
            assert '{user_context}' in config['system'], f'{profile_name} missing placeholder'
