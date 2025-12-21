"""
Тесты для LRU кэша подсказок
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'python'))

from cache import HintCache


def test_cache_hit():
    """Тест попадания в кэш"""
    cache = HintCache(maxsize=5)
    
    cache.set('Question 1', [], 'Answer 1')
    result = cache.get('Question 1', [])
    
    assert result == 'Answer 1'


def test_cache_miss():
    """Тест промаха кэша"""
    cache = HintCache(maxsize=5)
    
    result = cache.get('Unknown question', [])
    assert result is None


def test_cache_lru_eviction():
    """Тест вытеснения старых записей (LRU)"""
    cache = HintCache(maxsize=3)
    
    cache.set('Q1', [], 'A1')
    cache.set('Q2', [], 'A2')
    cache.set('Q3', [], 'A3')
    cache.set('Q4', [], 'A4')  # Вытеснит Q1
    
    assert cache.get('Q1', []) is None
    assert cache.get('Q2', []) == 'A2'
    assert cache.get('Q3', []) == 'A3'
    assert cache.get('Q4', []) == 'A4'


def test_cache_case_insensitive():
    """Тест что кэш игнорирует регистр"""
    cache = HintCache()
    
    cache.set('Question', [], 'Answer')
    assert cache.get('QUESTION', []) == 'Answer'
    assert cache.get('question', []) == 'Answer'


def test_cache_with_context():
    """Тест кэширования с контекстом"""
    cache = HintCache()
    
    cache.set('Question', ['ctx1', 'ctx2'], 'Answer with context')
    
    # Тот же вопрос с тем же контекстом
    assert cache.get('Question', ['ctx1', 'ctx2']) == 'Answer with context'
    
    # Тот же вопрос с другим контекстом
    assert cache.get('Question', ['ctx3', 'ctx4']) is None


def test_cache_access_order_update():
    """Тест обновления порядка доступа при чтении"""
    cache = HintCache(maxsize=3)
    
    cache.set('Q1', [], 'A1')
    cache.set('Q2', [], 'A2')
    cache.set('Q3', [], 'A3')
    
    # Обращаемся к Q1 (обновляем порядок)
    cache.get('Q1', [])
    
    # Добавляем Q4 (должен вытеснить Q2, т.к. Q1 теперь свежий)
    cache.set('Q4', [], 'A4')
    
    assert cache.get('Q1', []) == 'A1'  # Остался
    assert cache.get('Q2', []) is None  # Вытеснен
    assert cache.get('Q3', []) == 'A3'  # Остался
    assert cache.get('Q4', []) == 'A4'  # Новый


def test_cache_clear():
    """Тест очистки кэша"""
    cache = HintCache()
    
    cache.set('Q1', [], 'A1')
    cache.set('Q2', [], 'A2')
    
    cache.clear()
    
    assert cache.get('Q1', []) is None
    assert cache.get('Q2', []) is None
    assert len(cache.cache) == 0
    assert len(cache.access_order) == 0


def test_cache_key_generation():
    """Тест генерации ключей кэша"""
    cache = HintCache()
    
    key1 = cache._make_key('Question 1', [])
    key2 = cache._make_key('Question 1', [])
    key3 = cache._make_key('Question 2', [])
    
    # Одинаковые вопросы должны давать одинаковые ключи
    assert key1 == key2
    
    # Разные вопросы должны давать разные ключи
    assert key1 != key3
