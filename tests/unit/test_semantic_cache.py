"""
Модульные тесты для semantic_cache.py
"""
import pytest
import numpy as np
from unittest.mock import MagicMock, patch

from semantic_cache import (
    SemanticCache,
    CacheEntry,
    SIMILARITY_THRESHOLD,
    MAX_CACHE_SIZE,
    get_semantic_cache,
)


class TestSemanticCache:
    """Тесты семантического кэша"""

    def test_init_defaults(self):
        """Проверка инициализации со значениями по умолчанию"""
        cache = SemanticCache(threshold=0.8, maxsize=50)
        assert cache.threshold == 0.8
        assert cache.maxsize == 50
        assert cache.size == 0
        assert isinstance(cache.cache, list)

    def test_cosine_similarity(self):
        """Проверка расчета косинусного сходства"""
        cache = SemanticCache()
        v1 = np.array([1.0, 0.0, 0.0])
        v2 = np.array([1.0, 0.0, 0.0])
        v3 = np.array([0.0, 1.0, 0.0])
        zero = np.array([0.0, 0.0, 0.0])

        assert pytest.approx(cache._cosine_similarity(v1, v2), 0.001) == 1.0
        assert pytest.approx(cache._cosine_similarity(v1, v3), 0.001) == 0.0
        assert cache._cosine_similarity(v1, zero) == 0.0

    def test_context_hash(self):
        """Проверка хэширования контекста"""
        cache = SemanticCache()
        h1 = cache._context_hash(["q1", "q2", "q3"])
        h2 = cache._context_hash(["q1", "q2", "q3"])
        h3 = cache._context_hash(["q1", "q2", "other"])

        assert h1 == h2
        assert h1 != h3

    def test_set_and_get_exact_fallback(self):
        """Проверка сохранения и получения без модели (exact match fallback)"""
        cache = SemanticCache(threshold=0.8)
        cache._model_loaded = False
        cache.model = None

        cache.set("Что такое REST API?", ["контекст 1"], "REST это архитектурный стиль")
        assert cache.size == 1

        ans, sim = cache.get("Что такое REST API?", ["контекст 1"])
        assert ans == "REST это архитектурный стиль"
        assert sim == 1.0

        ans_miss, sim_miss = cache.get("Другой вопрос", ["контекст 1"])
        assert ans_miss is None
        assert sim_miss == 0.0

    def test_set_and_get_semantic_match(self):
        """Проверка семантического поиска с моком embeddings"""
        cache = SemanticCache(threshold=0.75)
        cache._model_loaded = True

        vec_base = np.array([1.0, 0.0, 0.0])
        vec_similar = np.array([0.95, 0.1, 0.0])
        vec_diff = np.array([0.0, 1.0, 0.0])

        def mock_embed(text):
            if "Python" in text:
                return vec_base
            elif "Питон" in text:
                return vec_similar
            return vec_diff

        cache._get_embedding = mock_embed

        cache.set("Что такое Python?", [], "Python это язык программирования")
        assert cache.size == 1

        ans, sim = cache.get("Расскажи про Питон", [])
        assert ans == "Python это язык программирования"
        assert sim >= 0.75

        ans_diff, sim_diff = cache.get("Что такое Docker?", [])
        assert ans_diff is None

    def test_lru_eviction(self):
        """Проверка вытеснения по LRU при превышении maxsize"""
        cache = SemanticCache(maxsize=2)
        cache._model_loaded = False

        cache.set("Вопрос 1", [], "Ответ 1")
        cache.set("Вопрос 2", [], "Ответ 2")
        assert cache.size == 2

        cache.set("Вопрос 3", [], "Ответ 3")
        assert cache.size == 2

        ans1, _ = cache.get("Вопрос 1", [])
        ans3, _ = cache.get("Вопрос 3", [])
        assert ans1 is None
        assert ans3 == "Ответ 3"

    def test_clear(self):
        """Проверка очистки кэша"""
        cache = SemanticCache()
        cache._model_loaded = False
        cache.set("В1", [], "О1")
        cache.set("В2", [], "О2")
        assert cache.size == 2

        cache.clear()
        assert cache.size == 0

    def test_get_empty_cache(self):
        """Получение из пустого кэша"""
        cache = SemanticCache()
        cache.clear()
        ans, sim = cache.get("любой вопрос")
        assert ans is None
        assert sim == 0.0

    def test_global_singleton(self):
        """Проверка глобального синглтона get_semantic_cache"""
        c1 = get_semantic_cache()
        c2 = get_semantic_cache()
        assert c1 is c2
