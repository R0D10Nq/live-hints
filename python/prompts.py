"""
Оптимизированные системные промпты (300 символов)
Few-shot примеры для быстрой генерации
"""

PROFILE_PROMPTS = {
    'interview': {
        'system': (
            'Ты ассистент для собеседований. Отвечай КРАТКО (1-2 предложения, макс 3). '
            'Используй markdown (жирный для важного). '
            'Фокусируйся на ПОСЛЕДНЕМ вопросе интервьюера. '
            'Если вопрос про опыт — используй контекст резюме.\n\n'
            'Контекст пользователя:\n{user_context}'
        ),
        'few_shot_examples': [
            {
                'user': 'Расскажите о себе',
                'assistant': 'Python разработчик, **3+ года** опыта. Основной стек: **Django, FastAPI, PostgreSQL**. Последний проект — микросервисная архитектура для fintech.'
            },
            {
                'user': 'Что такое декоратор?',
                'assistant': 'Декоратор — функция которая оборачивает другую функцию, добавляя функциональность. Пример: `@login_required` для проверки авторизации.'
            },
            {
                'user': 'Чем генератор отличается от итератора?',
                'assistant': 'Генератор — упрощённый итератор через `yield`. Отличия:\n- Автоматический `__iter__`/`__next__`\n- Ленивое вычисление\n- Методы `send()`/`throw()`/`close()`'
            }
        ]
    },
}


def get_system_prompt(profile: str, user_context: str) -> str:
    """Возвращает system prompt с подстановкой контекста"""
    template = PROFILE_PROMPTS[profile]['system']
    return template.format(user_context=user_context)


def get_few_shot_examples(profile: str) -> list:
    """Возвращает few-shot примеры"""
    return PROFILE_PROMPTS[profile].get('few_shot_examples', [])


# Для быстрого тестирования
if __name__ == '__main__':
    # Пример резюме
    test_resume = """
Программист, Python Backend Developer (Middle).
Опыт: 3+ года (Django, DRF, PostgreSQL, Redis, Celery).
Ключевые проекты:
- Мультитенантная платформа на 400+ лендингов
- Интеграции с AmoCRM, CallTouch, Telegram
- Оптимизация legacy кода, миграция на Swiper
Образование: Томский техникум информационных технологий.
Цель: Middle/Fullstack Python Developer → Senior.
"""
    
    prompt = get_system_prompt('interview', test_resume)
    print('=== SYSTEM PROMPT ===')
    print(prompt)
    print('\n=== LENGTH:', len(prompt), 'chars ===')
