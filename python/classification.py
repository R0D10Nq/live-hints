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
    Строит короткий промпт в зависимости от типа вопроса.
    Цель: 200-400 символов без user_context, экономия токенов.
    """
    if question_type == 'experience':
        # Для вопросов про опыт — добавляем сокращённый контекст
        context_short = user_context[:500] if user_context else ''
        return (
            'Ассистент собеседований. Ответ: 1-3 пункта, markdown. '
            f'Резюме:\n{context_short}\n\n'
            'Назови проект, технологии, результат.'
        )
    elif question_type == 'technical':
        # Для технических — БЕЗ резюме, экономим токены
        return (
            'Ассистент собеседований. Технический вопрос. '
            'Дай краткое определение (1-2 предложения) + пример кода если нужно. '
            'Формат: markdown, без воды.'
        )
    else:
        # General — минимальный контекст
        context_short = user_context[:300] if user_context else ''
        return (
            'Ассистент собеседований. Ответ: 1-2 предложения, markdown. '
            f'Контекст:\n{context_short}'
        )
