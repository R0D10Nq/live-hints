"""
Advanced RAG - Production-quality Retrieval-Augmented Generation
Использует ChromaDB для semantic search, reranking и adaptive context window
"""

import os
import logging
import hashlib
from typing import List, Optional, Dict, Tuple
from pathlib import Path
from dataclasses import dataclass, field
from datetime import datetime
import json

logger = logging.getLogger('AdvancedRAG')

# Конфигурация
CHROMA_PERSIST_DIR = Path(__file__).parent.parent / 'data' / 'chroma'
USER_CONTEXT_PATH = Path(__file__).parent / 'user_context.txt'
SESSION_MEMORY_PATH = Path(__file__).parent.parent / 'data' / 'session_memory.json'

# Adaptive context window настройки
CONTEXT_SIMPLE = 3      # Для простых вопросов
CONTEXT_MEDIUM = 5      # Для средних вопросов  
CONTEXT_COMPLEX = 8     # Для сложных вопросов


@dataclass
class RetrievedChunk:
    """Найденный чанк с метаданными"""
    text: str
    source: str  # 'resume', 'session_memory', 'context'
    score: float
    metadata: Dict = field(default_factory=dict)


@dataclass  
class SessionMemory:
    """Долгосрочная память сессии"""
    key_facts: List[str] = field(default_factory=list)
    discussed_topics: List[str] = field(default_factory=list)
    candidate_strengths: List[str] = field(default_factory=list)
    candidate_weaknesses: List[str] = field(default_factory=list)
    last_updated: str = ""


class AdvancedRAG:
    """
    Production-quality RAG система с:
    - ChromaDB для semantic search
    - Reranking для повышения точности
    - Adaptive context window
    - Memory consolidation
    """
    
    def __init__(self):
        self.embedding_model = None
        self.chroma_client = None
        self.collection = None
        self.session_memory = SessionMemory()
        self._model_loaded = False
        
        self._init_embedding_model()
        self._init_chromadb()
        self._load_user_context()
        self._load_session_memory()
    
    def _init_embedding_model(self):
        """Инициализация модели embeddings"""
        try:
            from sentence_transformers import SentenceTransformer
            # Многоязычная модель для русского и английского
            self.embedding_model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
            self._model_loaded = True
            logger.info('[RAG] Модель embeddings загружена')
        except ImportError:
            logger.warning('[RAG] sentence-transformers не установлен')
        except Exception as e:
            logger.error(f'[RAG] Ошибка загрузки модели: {e}')
    
    def _init_chromadb(self):
        """Инициализация ChromaDB"""
        try:
            import chromadb
            from chromadb.config import Settings
            
            # Создаём директорию для персистентного хранения
            CHROMA_PERSIST_DIR.mkdir(parents=True, exist_ok=True)
            
            self.chroma_client = chromadb.Client(Settings(
                chroma_db_impl="duckdb+parquet",
                persist_directory=str(CHROMA_PERSIST_DIR),
                anonymized_telemetry=False
            ))
            
            # Создаём или получаем коллекцию
            self.collection = self.chroma_client.get_or_create_collection(
                name="live_hints_knowledge",
                metadata={"hnsw:space": "cosine"}
            )
            
            logger.info(f'[RAG] ChromaDB инициализирован, документов: {self.collection.count()}')
            
        except ImportError:
            logger.warning('[RAG] ChromaDB не установлен, используем fallback')
            self._init_fallback_storage()
        except Exception as e:
            logger.error(f'[RAG] Ошибка ChromaDB: {e}')
            self._init_fallback_storage()
    
    def _init_fallback_storage(self):
        """Fallback хранилище если ChromaDB недоступен"""
        self.fallback_documents: List[Tuple[str, str, List[float]]] = []
        logger.info('[RAG] Используется fallback хранилище')
    
    def _load_user_context(self):
        """Загрузка и индексация контекста пользователя"""
        try:
            if USER_CONTEXT_PATH.exists():
                content = USER_CONTEXT_PATH.read_text(encoding='utf-8')
                chunks = self._smart_chunk(content, chunk_size=300, overlap=50)
                
                if self.collection:
                    # Проверяем хэш контента для избежания дубликатов
                    content_hash = hashlib.md5(content.encode()).hexdigest()
                    
                    # Удаляем старые документы если контент изменился
                    existing = self.collection.get(where={"source": "resume"})
                    if existing['ids']:
                        self.collection.delete(ids=existing['ids'])
                    
                    # Добавляем новые чанки
                    for i, chunk in enumerate(chunks):
                        self.collection.add(
                            documents=[chunk],
                            ids=[f"resume_{content_hash}_{i}"],
                            metadatas=[{"source": "resume", "chunk_idx": i}]
                        )
                    
                    logger.info(f'[RAG] Загружено {len(chunks)} чанков из резюме')
                else:
                    # Fallback
                    for chunk in chunks:
                        emb = self._get_embedding(chunk)
                        if emb:
                            self.fallback_documents.append((chunk, 'resume', emb))
                            
        except Exception as e:
            logger.error(f'[RAG] Ошибка загрузки контекста: {e}')
    
    def _load_session_memory(self):
        """Загрузка долгосрочной памяти сессии"""
        try:
            if SESSION_MEMORY_PATH.exists():
                data = json.loads(SESSION_MEMORY_PATH.read_text(encoding='utf-8'))
                self.session_memory = SessionMemory(**data)
                logger.info(f'[RAG] Загружена память сессии: {len(self.session_memory.key_facts)} фактов')
        except Exception as e:
            logger.warning(f'[RAG] Не удалось загрузить память сессии: {e}')
    
    def _save_session_memory(self):
        """Сохранение памяти сессии"""
        try:
            SESSION_MEMORY_PATH.parent.mkdir(parents=True, exist_ok=True)
            self.session_memory.last_updated = datetime.now().isoformat()
            SESSION_MEMORY_PATH.write_text(
                json.dumps(self.session_memory.__dict__, ensure_ascii=False, indent=2),
                encoding='utf-8'
            )
        except Exception as e:
            logger.error(f'[RAG] Ошибка сохранения памяти: {e}')
    
    def _smart_chunk(self, text: str, chunk_size: int = 300, overlap: int = 50) -> List[str]:
        """Умная разбивка текста на чанки с сохранением смысла"""
        chunks = []
        lines = text.split('\n')
        current_chunk = []
        current_size = 0
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Если строка слишком длинная - разбиваем по предложениям
            if len(line) > chunk_size:
                sentences = line.replace('. ', '.|').replace('! ', '!|').replace('? ', '?|').split('|')
                for sentence in sentences:
                    if current_size + len(sentence) > chunk_size and current_chunk:
                        chunks.append(' '.join(current_chunk))
                        # Overlap: оставляем последние N символов
                        overlap_text = ' '.join(current_chunk)[-overlap:] if overlap > 0 else ''
                        current_chunk = [overlap_text] if overlap_text else []
                        current_size = len(overlap_text)
                    current_chunk.append(sentence)
                    current_size += len(sentence)
            else:
                if current_size + len(line) > chunk_size and current_chunk:
                    chunks.append(' '.join(current_chunk))
                    overlap_text = ' '.join(current_chunk)[-overlap:] if overlap > 0 else ''
                    current_chunk = [overlap_text] if overlap_text else []
                    current_size = len(overlap_text)
                current_chunk.append(line)
                current_size += len(line)
        
        if current_chunk:
            chunks.append(' '.join(current_chunk))
        
        return [c for c in chunks if len(c.strip()) > 20]
    
    def _get_embedding(self, text: str) -> Optional[List[float]]:
        """Получить embedding для текста"""
        if not self._model_loaded or not self.embedding_model:
            return None
        try:
            return self.embedding_model.encode(text).tolist()
        except Exception as e:
            logger.error(f'[RAG] Ошибка embedding: {e}')
            return None
    
    def _classify_complexity(self, question: str, context: List[str]) -> str:
        """Определение сложности вопроса для adaptive context"""
        question_lower = question.lower()
        
        # Сложные вопросы - требуют много контекста
        complex_indicators = [
            'архитектур', 'систем', 'дизайн', 'проектирован', 'масштабир',
            'оптимизац', 'производительност', 'сравни', 'отличи', 'преимуществ',
            'недостатк', 'когда использ', 'почему', 'объясни подробн'
        ]
        
        # Простые вопросы - минимум контекста
        simple_indicators = [
            'что такое', 'определени', 'назови', 'перечисли', 'какой',
            'да или нет', 'верно ли', 'правда ли'
        ]
        
        for indicator in complex_indicators:
            if indicator in question_lower:
                return 'complex'
        
        for indicator in simple_indicators:
            if indicator in question_lower:
                return 'simple'
        
        # Если много контекста - средняя сложность
        if len(context) > 5:
            return 'medium'
        
        return 'simple'
    
    def _get_context_window_size(self, complexity: str) -> int:
        """Размер контекстного окна по сложности"""
        return {
            'simple': CONTEXT_SIMPLE,
            'medium': CONTEXT_MEDIUM,
            'complex': CONTEXT_COMPLEX
        }.get(complexity, CONTEXT_MEDIUM)
    
    def retrieve(self, query: str, top_k: int = 5) -> List[RetrievedChunk]:
        """
        Semantic search с reranking.
        
        Args:
            query: Текст запроса
            top_k: Количество результатов
            
        Returns:
            Отсортированный список релевантных чанков
        """
        results = []
        
        if self.collection:
            try:
                # ChromaDB semantic search
                search_results = self.collection.query(
                    query_texts=[query],
                    n_results=min(top_k * 2, 10),  # Берём больше для reranking
                    include=['documents', 'metadatas', 'distances']
                )
                
                if search_results['documents'] and search_results['documents'][0]:
                    for i, doc in enumerate(search_results['documents'][0]):
                        distance = search_results['distances'][0][i] if search_results['distances'] else 0
                        score = 1 - distance  # Конвертируем distance в similarity
                        metadata = search_results['metadatas'][0][i] if search_results['metadatas'] else {}
                        
                        results.append(RetrievedChunk(
                            text=doc,
                            source=metadata.get('source', 'unknown'),
                            score=score,
                            metadata=metadata
                        ))
                        
            except Exception as e:
                logger.error(f'[RAG] Ошибка поиска ChromaDB: {e}')
        
        elif hasattr(self, 'fallback_documents') and self.fallback_documents:
            # Fallback поиск
            query_emb = self._get_embedding(query)
            if query_emb:
                import numpy as np
                for doc, source, emb in self.fallback_documents:
                    score = float(np.dot(query_emb, emb) / (np.linalg.norm(query_emb) * np.linalg.norm(emb)))
                    results.append(RetrievedChunk(text=doc, source=source, score=score))
        
        # Reranking: сортируем по score и фильтруем низкорелевантные
        results.sort(key=lambda x: x.score, reverse=True)
        results = [r for r in results if r.score > 0.3]  # Порог релевантности
        
        # Дополнительный reranking: проверяем пересечение ключевых слов
        query_words = set(query.lower().split())
        for result in results:
            doc_words = set(result.text.lower().split())
            keyword_overlap = len(query_words & doc_words) / max(len(query_words), 1)
            result.score = result.score * 0.7 + keyword_overlap * 0.3  # Комбинированный скор
        
        results.sort(key=lambda x: x.score, reverse=True)
        
        return results[:top_k]
    
    def consolidate_memory(self, question: str, answer: str, question_type: str):
        """
        Memory consolidation - извлечение и сохранение важных фактов.
        
        Вызывается после каждого ответа для обновления долгосрочной памяти.
        """
        # Извлекаем тему вопроса
        topic_keywords = ['python', 'django', 'fastapi', 'sql', 'docker', 'kubernetes',
                         'react', 'javascript', 'typescript', 'aws', 'git', 'ci/cd',
                         'rest', 'api', 'база данных', 'тестирование', 'архитектура']
        
        question_lower = question.lower()
        for keyword in topic_keywords:
            if keyword in question_lower and keyword not in self.session_memory.discussed_topics:
                self.session_memory.discussed_topics.append(keyword)
        
        # Ограничиваем размер памяти
        if len(self.session_memory.discussed_topics) > 20:
            self.session_memory.discussed_topics = self.session_memory.discussed_topics[-20:]
        
        self._save_session_memory()
    
    def build_enhanced_prompt(self, question: str, context: List[str], 
                               question_type: str, base_prompt: str) -> str:
        """
        Строит улучшенный промпт с RAG контекстом и adaptive window.
        
        Args:
            question: Текущий вопрос
            context: История диалога
            question_type: Тип вопроса
            base_prompt: Базовый промпт
            
        Returns:
            Улучшенный системный промпт
        """
        # Определяем сложность и размер контекста
        complexity = self._classify_complexity(question, context)
        context_size = self._get_context_window_size(complexity)
        
        logger.info(f'[RAG] Сложность: {complexity}, контекст: {context_size} элементов')
        
        # Получаем релевантные чанки из резюме
        relevant_chunks = self.retrieve(question, top_k=3)
        
        # Строим промпт
        enhanced_prompt = base_prompt
        
        # Добавляем релевантную информацию из резюме
        if relevant_chunks and question_type in ['experience', 'general']:
            enhanced_prompt += '\n\n─── РЕЛЕВАНТНАЯ ИНФОРМАЦИЯ ИЗ РЕЗЮМЕ ───\n'
            for chunk in relevant_chunks:
                enhanced_prompt += f'• {chunk.text}\n'
            enhanced_prompt += '─── КОНЕЦ ИНФОРМАЦИИ ───'
        
        # Добавляем память сессии если есть
        if self.session_memory.discussed_topics:
            enhanced_prompt += f'\n\nОбсуждённые темы в этой сессии: {", ".join(self.session_memory.discussed_topics[-5:])}'
        
        # КРИТИЧНО: Акцент на текущий вопрос
        enhanced_prompt += '''

═══════════════════════════════════════════════════════════════
⚠️ КРИТИЧЕСКИ ВАЖНО:
1. Отвечай ТОЛЬКО на ПОСЛЕДНИЙ вопрос в диалоге
2. Предыдущие вопросы даны ТОЛЬКО для контекста - НЕ отвечай на них
3. Если вопрос связан с предыдущим обсуждением, учитывай контекст
4. Ответ должен быть чётким, структурированным и по делу
═══════════════════════════════════════════════════════════════'''
        
        return enhanced_prompt
    
    def get_adaptive_context(self, context: List[str], question: str) -> List[str]:
        """
        Возвращает адаптивный контекст нужного размера.
        Для простых вопросов - меньше контекста (быстрее),
        для сложных - больше (точнее).
        """
        complexity = self._classify_complexity(question, context)
        window_size = self._get_context_window_size(complexity)
        return context[-window_size:] if context else []
    
    def clear_session_memory(self):
        """Очистка памяти сессии при старте новой"""
        self.session_memory = SessionMemory()
        if SESSION_MEMORY_PATH.exists():
            SESSION_MEMORY_PATH.unlink()
        logger.info('[RAG] Память сессии очищена')


# Глобальный инстанс
_advanced_rag: Optional[AdvancedRAG] = None


def get_advanced_rag() -> AdvancedRAG:
    """Получить глобальный инстанс Advanced RAG"""
    global _advanced_rag
    if _advanced_rag is None:
        _advanced_rag = AdvancedRAG()
    return _advanced_rag
