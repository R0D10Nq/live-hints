"""
Финальный smoke test для проверки всего проекта
"""
import sys
sys.path.insert(0, 'python')

print("="*60)
print("FINAL SMOKE TEST - Live Hints")
print("="*60)

# 1. Проверка импортов всех модулей
print("\n[1/5] Проверка импортов модулей...")
try:
    from cache import HintCache
    from classification import classify_question, build_contextual_prompt
    from prompts import get_system_prompt, get_profile_config
    from rag import SimpleRAG
    print("  OK: Все модули импортируются успешно")
except Exception as e:
    print(f"  ERROR: Ошибка импорта: {e}")
    sys.exit(1)

# 2. Проверка классификации
print("\n[2/5] Проверка классификации вопросов...")
test_cases = [
    ("Расскажи о своем опыте", "experience"),
    ("Что такое Python?", "technical"),
    ("Привет!", "general"),
]
all_passed = True
for question, expected in test_cases:
    result = classify_question(question)
    if result == expected:
        print(f"  OK: '{question[:30]}' -> {result}")
    else:
        print(f"  FAIL: '{question[:30]}' -> {result} (ожидалось: {expected})")
        all_passed = False

# 3. Проверка кэша
print("\n[3/5] Проверка кэша...")
cache = HintCache(maxsize=10)
cache.set("test_key", [], "test_value")
if cache.get("test_key", []) == "test_value":
    print("  OK: Кэш работает корректно")
else:
    print("  FAIL: Кэш не работает")
    all_passed = False

# 4. Проверка RAG
print("\n[4/5] Проверка RAG...")
try:
    rag = SimpleRAG()
    # Проверяем что RAG загрузился (документы могут быть пустыми если нет user_context.txt)
    print(f"  OK: RAG инициализирован, документов: {len(rag.documents)}")
except Exception as e:
    print(f"  FAIL: Ошибка RAG: {e}")
    all_passed = False

# 5. Проверка промптов для всех профилей
print("\n[5/5] Проверка промптов...")
profiles = ['job_interview_ru', 'business_meeting', 'daily_sync', 'presentation']
for profile in profiles:
    try:
        prompt = get_system_prompt(profile, "test context")
        if len(prompt) > 100:
            print(f"  OK: {profile}: {len(prompt)} символов")
        else:
            print(f"  FAIL: {profile}: промпт слишком короткий")
            all_passed = False
    except Exception as e:
        print(f"  FAIL: {profile}: {e}")
        all_passed = False

print("\n" + "="*60)
if all_passed:
    print("SMOKE TEST PASSED")
    print("Все компоненты работают корректно!")
else:
    print("SMOKE TEST FAILED")
    print("Обнаружены проблемы!")
print("="*60)
