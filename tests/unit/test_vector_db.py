"""
Модульные тесты для vector_db.py
"""
import pytest
from unittest.mock import MagicMock, patch

from vector_db import VectorDB, INSTANT_THRESHOLD, CONTEXT_THRESHOLD


class TestVectorDB:
    """Тесты векторной БД"""

    def test_init_uses_safe_disabled_backend(self):
        """Инициализация не активирует уязвимое постоянное хранилище."""
        db = VectorDB()

        assert db._initialized is False
        assert db.client is None
        assert db.collection is None

    def test_search_not_initialized(self):
        """Поиск при неинициализированной БД возвращает пустой список"""
        with patch.object(VectorDB, "_init_db"):
            db = VectorDB()
            db._initialized = False
            db.collection = None

            assert db.search("Тестовый вопрос") == []

    def test_search_with_results(self):
        """Поиск с возвратом результатов и расчетом similarity"""
        with patch.object(VectorDB, "_init_db"):
            db = VectorDB()
            db._initialized = True
            mock_collection = MagicMock()
            db.collection = mock_collection

            # Мокируем ответ chroma query: distance 0.1 => similarity 1 / (1 + 0.1) ≈ 0.909
            mock_collection.query.return_value = {
                "ids": [["doc_1"]],
                "documents": [["Что такое GIL?"]],
                "metadatas": [[{"answer": "Global Interpreter Lock", "category": "python"}]],
                "distances": [[0.1]],
            }

            results = db.search("Что такое GIL?", n_results=1)
            assert len(results) == 1
            assert results[0]["id"] == "doc_1"
            assert results[0]["question"] == "Что такое GIL?"
            assert results[0]["answer"] == "Global Interpreter Lock"
            assert results[0]["category"] == "python"
            assert results[0]["similarity"] > 0.9

    def test_get_instant_answer_hit(self):
        """Мгновенный ответ при similarity >= INSTANT_THRESHOLD"""
        with patch.object(VectorDB, "_init_db"):
            db = VectorDB()
            db._initialized = True
            mock_collection = MagicMock()
            db.collection = mock_collection

            mock_collection.query.return_value = {
                "ids": [["doc_1"]],
                "documents": [["Вопрос"]],
                "metadatas": [[{"answer": "Мгновенный ответ"}]],
                "distances": [[0.05]],  # similarity ~ 0.952 >= INSTANT_THRESHOLD
            }

            answer = db.get_instant_answer("Вопрос")
            assert answer == "Мгновенный ответ"

    def test_get_instant_answer_miss(self):
        """Отсутствие мгновенного ответа при низкой схожести"""
        with patch.object(VectorDB, "_init_db"):
            db = VectorDB()
            db._initialized = True
            mock_collection = MagicMock()
            db.collection = mock_collection

            mock_collection.query.return_value = {
                "ids": [["doc_1"]],
                "documents": [["Другой вопрос"]],
                "metadatas": [[{"answer": "Другой ответ"}]],
                "distances": [[0.5]],  # similarity ~ 0.667 < INSTANT_THRESHOLD
            }

            answer = db.get_instant_answer("Вопрос")
            assert answer is None

    def test_get_context_answers(self):
        """Получение похожих ответов для контекста"""
        with patch.object(VectorDB, "_init_db"):
            db = VectorDB()
            db._initialized = True
            mock_collection = MagicMock()
            db.collection = mock_collection

            # 1 попадает в диапазон [CONTEXT_THRESHOLD, INSTANT_THRESHOLD), 1 ниже, 1 выше
            # CONTEXT_THRESHOLD = 0.70 (distance ~ 0.428)
            # INSTANT_THRESHOLD = 0.88 (distance ~ 0.136)
            mock_collection.query.return_value = {
                "ids": [["doc_1", "doc_2", "doc_3"]],
                "documents": [["В1", "В2", "В3"]],
                "metadatas": [[{"answer": "О1"}, {"answer": "О2"}, {"answer": "О3"}]],
                "distances": [[0.25, 0.05, 0.8]],  # sim: 0.80 (match), 0.952 (instant), 0.55 (low)
            }

            answers = db.get_context_answers("Вопрос", n_results=3)
            assert len(answers) == 1
            assert answers[0]["id"] == "doc_1"

    def test_add_success(self):
        """Добавление записи в базу"""
        with patch.object(VectorDB, "_init_db"):
            db = VectorDB()
            db._initialized = True
            mock_collection = MagicMock()
            db.collection = mock_collection

            success = db.add("Новый вопрос", "Новый ответ", category="algorithms", doc_id="custom_1")

            assert success is True
            mock_collection.add.assert_called_once()
