"""
Классификация вопросов для LLM сервера
Без зависимостей от FastAPI - для тестирования
"""


def classify_question(text: str) -> str:
    """
    Классифицирует вопрос по типу: experience / technical / general
    """
    text_lower = text.lower()
    
    experience_keywords = [
        'опыт', 'работал', 'проект', 'делал', 'команда', 'задача',
        'ситуация', 'пример', 'как вы', 'расскажите о себе',
        'почему вы', 'ваш опыт', 'последний проект', 'достижения',
        'опишите', 'решили', 'сложную', 'справились', 'столкнулись'
    ]
    
    technical_keywords = [
        'что такое', 'как работает', 'объясни', 'разница между',
        'чем отличается', 'принцип', 'алгоритм', 'структура данных',
        'паттерн', 'зачем нужен', 'когда использовать', 'определение'
    ]
    
    exp_score = sum(1 for kw in experience_keywords if kw in text_lower)
    tech_score = sum(1 for kw in technical_keywords if kw in text_lower)
    
    if exp_score > tech_score and exp_score > 0:
        return 'experience'
    elif tech_score > exp_score and tech_score > 0:
        return 'technical'
    else:
        return 'general'


def build_contextual_prompt(question_type: str, user_context: str) -> str:
    """
    Строит промпт в зависимости от типа вопроса
    """
    base = (
        'Ты ассистент для собеседований. Отвечай КРАТКО (1-2 предложения). '
        'Используй markdown для важного. '
    )
    
    if question_type == 'experience':
        return base + (
            'Вопрос про опыт кандидата — используй контекст резюме:\n\n'
            f'{user_context}\n\n'
            'Назови конкретный проект, технологии и результат.'
        )
    elif question_type == 'technical':
        return base + (
            'Технический вопрос — дай краткое определение с примером кода если нужно. '
            'Без отсылок к резюме.'
        )
    else:
        return base + f'Контекст резюме:\n{user_context}'
