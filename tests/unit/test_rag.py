"""
Тесты для python/rag.py
"""
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock


class TestSimpleRAG:
    """Тесты для SimpleRAG"""
    
    @patch.object(Path, 'exists', return_value=False)
    def test_init_no_context(self, mock_exists):
        """Инициализация без файла контекста"""
        from rag import SimpleRAG
        
        rag = SimpleRAG()
        
        assert rag.documents == []
        assert rag.user_context == ""
    
    @patch.object(Path, 'exists', return_value=True)
    @patch.object(Path, 'read_text', return_value="Line 1\nLine 2\nLine 3")
    def test_init_with_context(self, mock_read, mock_exists):
        """Инициализация с файлом контекста"""
        from rag import SimpleRAG
        
        rag = SimpleRAG()
        
        assert rag.user_context != ""
        assert len(rag.documents) >= 1
    
    def test_chunk_context_empty(self):
        """Чанкинг пустого контекста"""
        from rag import SimpleRAG
        
        with patch.object(Path, 'exists', return_value=False):
            rag = SimpleRAG()
        
        rag.user_context = ""
        rag._chunk_context()
        
        assert rag.documents == []
    
    def test_chunk_context_small(self):
        """Чанкинг маленького контекста"""
        from rag import SimpleRAG
        
        with patch.object(Path, 'exists', return_value=False):
            rag = SimpleRAG()
        
        rag.user_context = "Line 1\nLine 2\nLine 3"
        rag.documents = []
        rag._chunk_context(chunk_size=100)
        
        assert len(rag.documents) >= 1
    
    def test_chunk_context_large(self):
        """Чанкинг большого контекста"""
        from rag import SimpleRAG
        
        with patch.object(Path, 'exists', return_value=False):
            rag = SimpleRAG()
        
        rag.user_context = "A" * 100 + "\n" + "B" * 100 + "\n" + "C" * 100
        rag.documents = []
        rag._chunk_context(chunk_size=50)
        
        assert len(rag.documents) >= 2
    
    def test_chunk_context_with_empty_lines(self):
        """Чанкинг с пустыми строками"""
        from rag import SimpleRAG
        
        with patch.object(Path, 'exists', return_value=False):
            rag = SimpleRAG()
        
        rag.user_context = "Line1\n\n\nLine2\n  \nLine3"
        rag.documents = []
        rag._chunk_context(chunk_size=1000)
        
        # Пустые строки должны быть пропущены
        assert len(rag.documents) >= 1
    
    def test_extract_keywords(self):
        """Извлечение ключевых слов"""
        from rag import SimpleRAG
        
        with patch.object(Path, 'exists', return_value=False):
            rag = SimpleRAG()
        
        keywords = rag._extract_keywords("Python Django PostgreSQL")
        
        assert 'python' in keywords
        assert 'django' in keywords
        assert 'postgresql' in keywords
    
    def test_extract_keywords_filters_stopwords(self):
        """Фильтрация стоп-слов"""
        from rag import SimpleRAG
        
        with patch.object(Path, 'exists', return_value=False):
            rag = SimpleRAG()
        
        keywords = rag._extract_keywords("что такое Python и Django")
        
        assert 'что' not in keywords
        assert 'такое' not in keywords
        assert 'python' in keywords
    
    def test_extract_keywords_filters_short(self):
        """Фильтрация коротких слов"""
        from rag import SimpleRAG
        
        with patch.object(Path, 'exists', return_value=False):
            rag = SimpleRAG()
        
        keywords = rag._extract_keywords("a ab abc Python")
        
        assert 'a' not in keywords
        assert 'ab' not in keywords
        assert 'abc' in keywords
    
    def test_retrieve_empty_documents(self):
        """Поиск в пустом списке документов"""
        from rag import SimpleRAG
        
        with patch.object(Path, 'exists', return_value=False):
            rag = SimpleRAG()
        
        results = rag.retrieve("Python Django", top_k=3)
        
        assert results == []
    
    def test_retrieve_empty_query(self):
        """Поиск с пустым запросом"""
        from rag import SimpleRAG
        
        with patch.object(Path, 'exists', return_value=False):
            rag = SimpleRAG()
        
        rag.documents = [('chunk_0', 'Python Developer')]
        
        results = rag.retrieve("", top_k=3)
        
        assert results == []
    
    def test_retrieve_finds_relevant(self):
        """Находит релевантные чанки"""
        from rag import SimpleRAG
        
        with patch.object(Path, 'exists', return_value=False):
            rag = SimpleRAG()
        
        rag.documents = [
            ('chunk_0', 'Python Developer опыт работы'),
            ('chunk_1', 'Java Spring Framework'),
            ('chunk_2', 'Django REST Framework PostgreSQL'),
        ]
        
        results = rag.retrieve("Python Django", top_k=2)
        
        assert len(results) >= 1
        assert any('Python' in r or 'Django' in r for r in results)
    
    def test_retrieve_respects_top_k(self):
        """Учитывает top_k лимит"""
        from rag import SimpleRAG
        
        with patch.object(Path, 'exists', return_value=False):
            rag = SimpleRAG()
        
        rag.documents = [
            ('chunk_0', 'Python Developer'),
            ('chunk_1', 'Python Engineer'),
            ('chunk_2', 'Python Architect'),
        ]
        
        results = rag.retrieve("Python", top_k=1)
        
        assert len(results) <= 1
    
    def test_build_enhanced_prompt_no_chunks(self):
        """Улучшенный промпт без релевантных чанков"""
        from rag import SimpleRAG
        
        with patch.object(Path, 'exists', return_value=False):
            rag = SimpleRAG()
        
        result = rag.build_enhanced_prompt(
            question="What is Python?",
            context=[],
            question_type="technical",
            base_prompt="Base prompt"
        )
        
        assert "Base prompt" in result
        assert "ВАЖНО" in result
    
    def test_build_enhanced_prompt_with_chunks(self):
        """Улучшенный промпт с релевантными чанками"""
        from rag import SimpleRAG
        
        with patch.object(Path, 'exists', return_value=False):
            rag = SimpleRAG()
        
        rag.documents = [('chunk_0', 'Python Developer опыт 5 лет')]
        
        result = rag.build_enhanced_prompt(
            question="расскажите про опыт Python",
            context=[],
            question_type="experience",
            base_prompt="Base prompt"
        )
        
        assert "Base prompt" in result
        assert "РЕЛЕВАНТНАЯ ИНФОРМАЦИЯ" in result
    
    def test_build_enhanced_prompt_technical_no_chunks(self):
        """Технические вопросы не добавляют чанки"""
        from rag import SimpleRAG
        
        with patch.object(Path, 'exists', return_value=False):
            rag = SimpleRAG()
        
        rag.documents = [('chunk_0', 'Python Developer')]
        
        result = rag.build_enhanced_prompt(
            question="Python",
            context=[],
            question_type="technical",
            base_prompt="Base"
        )
        
        assert "РЕЛЕВАНТНАЯ ИНФОРМАЦИЯ" not in result


class TestGetRag:
    """Тесты для get_rag singleton"""
    
    def test_returns_singleton(self):
        """Возвращает один и тот же инстанс"""
        import rag
        
        # Reset singleton
        rag._rag_instance = None
        
        with patch.object(Path, 'exists', return_value=False):
            instance1 = rag.get_rag()
            instance2 = rag.get_rag()
        
        assert instance1 is instance2
