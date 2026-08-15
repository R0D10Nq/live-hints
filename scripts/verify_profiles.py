"""
Проверка всех профилей и промптов
"""
import sys
sys.path.insert(0, 'python')

from prompts import PROFILE_PROMPTS, get_system_prompt, get_profile_config

print("=== ПРОВЕРКА ПРОФИЛЕЙ ===")
print(f"\nДоступные профили ({len(PROFILE_PROMPTS)}):")
for profile in PROFILE_PROMPTS.keys():
    print(f"  - {profile}")

print("\n=== ПРОВЕРКА ПРОМПТОВ ===")
test_context = "Опыт работы с Python 5 лет"
for profile in ['job_interview_ru', 'job_interview_en', 'business_meeting', 'daily_sync', 'presentation', 'custom']:
    try:
        prompt = get_system_prompt(profile, test_context)
        print(f"\n{profile}:")
        print(f"  Длина промпта: {len(prompt)} символов")
        print(f"  Начало: {prompt[:50]}...")
        
        # Проверка конфига
        config = get_profile_config(profile)
        print(f"  Ключи конфига: {list(config.keys())}")
    except Exception as e:
        print(f"\n{profile}: ОШИБКА - {e}")

print("\n=== ПРОВЕРКА КЛАССИФИКАЦИИ ===")
from classification import classify_question, build_contextual_prompt

test_questions = [
    ("Расскажите о вашем опыте", "experience"),
    ("Что такое декоратор?", "technical"),
    ("Привет!", "general"),
]

for question, expected in test_questions:
    result = classify_question(question)
    status = "✓" if result == expected else "✗"
    print(f"  {status} '{question}' -> {result} (ожидалось: {expected})")

print("\n=== ВСЕ ПРОВЕРКИ ЗАВЕРШЕНЫ ===")
