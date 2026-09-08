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


def get_max_tokens_for_type(question_type: str) -> int:
    """Возвращает рекомендуемое количество токенов по типу вопроса (краткие тезисы)"""
    return {
        'experience': 160,   # Опорные тезисы STAR
        'technical': 140,    # Определение + механизм + нюанс
        'general': 100       # Сверхкраткие тезисы
    }.get(question_type, 130)


def get_temperature_for_type(question_type: str) -> float:
    """Возвращает рекомендуемую temperature по типу вопроса"""
    return {
        'experience': 0.7,   # Опыт и кейсы
        'technical': 0.4,    # Точные технические определения
        'general': 0.6
    }.get(question_type, 0.6)


def build_contextual_prompt(question_type: str, user_context: str, profile: str = 'job_interview_ru') -> str:
    """
    Строит краткий опорный промпт в зависимости от типа вопроса и профиля.
    Для собеседований использует телеграфные опорные пункты, для других - системный промпт из профиля.
    """
    # Для профилей не собеседований используем системный промпт из prompts.py
    if profile in ['business_meeting', 'daily_sync', 'presentation', 'custom']:
        from prompts import get_system_prompt
        return get_system_prompt(profile, user_context)
    
    # Разделяем резюме и вакансию если они объединены
    resume_part = user_context
    vacancy_part = ''
    if '## Вакансия:' in user_context:
        parts = user_context.split('## Вакансия:', 1)
        resume_part = parts[0].strip()
        vacancy_part = parts[1].strip() if len(parts) > 1 else ''
    
    if question_type == 'experience':
        context_full = resume_part[:2000] if resume_part else ''
        vacancy_info = f'\n\n## Вакансия (подчёркивай релевантный опыт):\n{vacancy_part[:500]}' if vacancy_part else ''
        return (
            'Ты AI-ассистент для технических собеседований. Твоя задача — мгновенный опорный каркас ответа.\n\n'
            '## ВАЖНО: Отвечай на ПОСЛЕДНИЙ вопрос интервьюера!\n\n'
            '## Формат ответа (СТРОГО 3-4 пункта, до 8 слов в строке):\n'
            '• Роль и контекст: позиция, стек и масштаб проекта\n'
            '• Проблема/задача: с чем столкнулись и цель\n'
            '• Действия: конкретные технологии и решения\n'
            '• Результат: метрика (%, время, деньги), чему научился\n\n'
            '## Требования:\n'
            '- Только факты и технологии из резюме кандидата\n'
            '- Без длинных предложений и вводных слов\n\n'
            f'## Резюме кандидата:\n{context_full}'
            f'{vacancy_info}'
        )
    elif question_type == 'technical':
        context_short = resume_part[:500] if resume_part else ''
        return (
            'Ты AI-ассистент для технических собеседований. Даёшь мгновенную экспертную шпаргалку.\n\n'
            '## ВАЖНО: Отвечай на ПОСЛЕДНИЙ вопрос интервьюера!\n\n'
            '## Формат ответа (СТРОГО 3-4 пункта, до 8 слов в строке):\n'
            '• Определение: суть концепции/паттерна в одной фразе\n'
            '• Механизм: как работает под капотом или ключевое свойство\n'
            '• Практика: где и как применяется в реальных проектах\n'
            '• Подводный камень: краевой случай, компромисс или частая ошибка\n\n'
            '## Требования:\n'
            '- Никаких развернутых лекций, только емкие тезисы\n'
            '- Код упоминать только при острой необходимости в 1 строку\n\n'
            f'## Контекст кандидата:\n{context_short}'
        )
    else:
        context_short = resume_part[:800] if resume_part else ''
        return (
            'Ты AI-ассистент для технических собеседований.\n\n'
            '## ВАЖНО: Отвечай на ПОСЛЕДНИЙ вопрос интервьюера!\n\n'
            '## Формат ответа (СТРОГО 3 пункта, до 7-10 слов в каждом):\n'
            '• Главный тезис по вопросу\n'
            '• Практический пример или аргумент\n'
            '• Резюме или вывод\n\n'
            f'## Контекст кандидата:\n{context_short}'
        )
