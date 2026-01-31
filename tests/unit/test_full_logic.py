"""
Тест полной логики загрузки профиля и контекста
"""

import os
import json
from pathlib import Path


def load_user_profile():
    """Загружает профиль пользователя из настроек"""
    profile = 'job_interview_ru'  # профиль по умолчанию
    
    try:
        # Проверяем настройки в renderer/settings.json
        settings_path = os.path.join(os.path.dirname(__file__), 'renderer', 'settings.json')
        if os.path.exists(settings_path):
            with open(settings_path, 'r', encoding='utf-8') as f:
                settings = json.load(f)
                profile = settings.get('profile', 'job_interview_ru')
                print(f'[PROFILE] Загружен из settings.json: {profile}')
    except Exception as e:
        print(f'[PROFILE] Ошибка: {e}')
    
    return profile


def load_user_context():
    """Загружает контекст пользователя в зависимости от профиля"""
    profile = load_user_profile()
    
    # Определяем, какой контекст загружать
    if profile in ['business_meeting', 'daily_sync', 'presentation', 'custom']:
        # Для этих режимов загружаем mode_context если есть
        context_path = Path(__file__).parent / 'python' / 'mode_context.txt'
        if context_path.exists():
            with open(context_path, 'r', encoding='utf-8') as f:
                print(f'[CONTEXT] Загружен mode_context.txt для профиля {profile}')
                return f.read().strip()
    
    # Для собеседования или если mode_context не найден, загружаем user_context.txt
    context_path = Path(__file__).parent / 'python' / 'user_context.txt'
    if context_path.exists():
        with open(context_path, 'r', encoding='utf-8') as f:
            print(f'[CONTEXT] Загружен user_context.txt для профиля {profile}')
            return f.read().strip()
    
    print(f'[CONTEXT] Файл контекста не найден для профиля {profile}')
    return ""


def build_contextual_prompt(question_type: str, user_context: str, profile: str = 'job_interview_ru') -> str:
    """
    Строит развёрнутый промпт в зависимости от типа вопроса и профиля.
    Для собеседований использует STAR формат, для других - системный промпт из профиля.
    """
    # Для профилей не собеседований используем системный промпт из prompts.py
    if profile in ['business_meeting', 'daily_sync', 'presentation', 'custom']:
        # Имитация get_system_prompt
        if profile == 'business_meeting':
            return f"Ты AI-ассистент для бизнес-встреч. Помогаешь формулировать чёткие аргументы.\n\n## Контекст участника:\n{user_context}\n\n## ВАЖНО:\n- Говори по существу\n- Фокусируйся на бизнес-показателях"
        elif profile == 'daily_sync':
            return f"Ты AI-ассистент для дейли-митингов. Помогаешь кратко и по делу.\n\n## Контекст:\n{user_context}"
        # ... другие профили
    
    # Для собеседований используем STAR формат
    return f"Ты AI-ассистент для технических собеседований. Формат STAR...\n\n## Резюме:\n{user_context}"


if __name__ == '__main__':
    print("=== Тест логики профилей ===\n")
    
    # 1. Загружаем профиль
    profile = load_user_profile()
    print(f"Активный профиль: {profile}\n")
    
    # 2. Загружаем контекст
    context = load_user_context()
    print(f"Контекст ({len(context)} символов): {context[:100]}...\n")
    
    # 3. Строим промпт
    question_type = "general"
    prompt = build_contextual_prompt(question_type, context, profile)
    
    print(f"Сгенерированный промпт:\n{prompt[:300]}...\n")
    
    # 4. Проверяем тип промпта
    if profile in ['business_meeting', 'daily_sync', 'presentation', 'custom']:
        if "бизнес-встреч" in prompt or "дейли" in prompt:
            print("✅ ПРАВИЛЬНО: Используется промпт для бизнес-профиля")
        else:
            print("❌ ОШИБКА: Промпт не соответствует бизнес-профилю")
    else:
        if "собеседований" in prompt and "STAR" in prompt:
            print("✅ ПРАВИЛЬНО: Используется промпт для собеседования")
        else:
            print("❌ ОШИБКА: Промпт не соответствует профилю собеседования")
