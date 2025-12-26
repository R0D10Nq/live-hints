"""
Тесты для классификации вопросов
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'python'))

from classification import classify_question, build_contextual_prompt


def test_classify_experience_question():
    """Тест классификации вопросов про опыт"""
    assert classify_question('Расскажите о вашем опыте работы с Django') == 'experience'
    assert classify_question('Какой был ваш последний проект?') == 'experience'
    assert classify_question('Как вы работали в команде?') == 'experience'
    assert classify_question('Опишите ситуацию когда вы решили сложную задачу') == 'experience'


def test_classify_technical_question():
    """Тест классификации технических вопросов"""
    assert classify_question('Что такое декоратор?') == 'technical'
    assert classify_question('Как работает генератор?') == 'technical'
    assert classify_question('Объясни разницу между list и tuple') == 'technical'
    assert classify_question('Какой принцип работы алгоритма быстрой сортировки?') == 'technical'


def test_classify_general_question():
    """Тест классификации общих вопросов"""
    assert classify_question('Привет!') == 'general'
    assert classify_question('Спасибо') == 'general'
    assert classify_question('Понятно') == 'general'


def test_build_contextual_prompt_experience():
    """Тест построения промпта для вопросов про опыт"""
    context = 'Python разработчик, 3 года опыта'
    
    prompt = build_contextual_prompt('experience', context)
    assert 'резюме' in prompt.lower()
    assert context in prompt
    assert 'проект' in prompt.lower()
    assert 'технологии' in prompt.lower()


def test_build_contextual_prompt_technical():
    """Тест построения промпта для технических вопросов"""
    context = 'Python разработчик, 3 года опыта'
    
    prompt = build_contextual_prompt('technical', context)
    # Technical промпт должен содержать инструкции по формату
    assert len(prompt) > 100
    # Technical промпт теперь включает краткий контекст кандидата
    assert 'контекст' in prompt.lower() or 'кандидат' in prompt.lower()


def test_build_contextual_prompt_general():
    """Тест построения промпта для общих вопросов"""
    context = 'Python разработчик, 3 года опыта'
    
    prompt = build_contextual_prompt('general', context)
    assert context in prompt
    assert 'ассистент' in prompt.lower()


def test_build_contextual_prompt_short():
    """Тест что промпты разумного размера"""
    context = 'X' * 2000  # Длинный контекст
    
    # Technical теперь включает контекст (до 500 символов)
    tech_prompt = build_contextual_prompt('technical', context)
    assert len(tech_prompt) < 2000  # увеличен лимит
    
    # Experience должен обрезать контекст (до 2000 символов)
    exp_prompt = build_contextual_prompt('experience', context)
    assert len(exp_prompt) < 4000
    
    # General должен обрезать контекст (до 800 символов)
    gen_prompt = build_contextual_prompt('general', context)
    assert len(gen_prompt) < 2000


def test_get_max_tokens_for_type():
    """Тест get_max_tokens_for_type"""
    from classification import get_max_tokens_for_type
    
    assert get_max_tokens_for_type('experience') == 900
    assert get_max_tokens_for_type('technical') == 700
    assert get_max_tokens_for_type('general') == 500
    assert get_max_tokens_for_type('unknown') == 600  # fallback


def test_get_temperature_for_type():
    """Тест get_temperature_for_type"""
    from classification import get_temperature_for_type
    
    assert get_temperature_for_type('experience') == 0.8
    assert get_temperature_for_type('technical') == 0.5
    assert get_temperature_for_type('general') == 0.7
    assert get_temperature_for_type('unknown') == 0.7  # fallback
