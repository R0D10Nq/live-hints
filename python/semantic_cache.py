"""
Semantic Cache - кэширование по семантической схожести вопросов
Использует sentence-transformers для embeddings и cosine similarity
"""

import os
import logging
from typing import Optional, Tuple, List
from dataclasses import dataclass
import numpy as np

logger = logging.getLogger('SemanticCache')

# Порог схожести для cache hit (77% — немного понижен для лучшего покрытия)
SIMILARITY_THRESHOLD = 0.77

# Максимальный размер кэша (увеличен для большего покрытия)
MAX_CACHE_SIZE = 200


@dataclass
class CacheEntry:
    """Запись в кэше"""
    question: str
    answer: str
    embedding: np.ndarray
    context_hash: str


class SemanticCache:
    """
    Semantic кэш с поиском по схожести embeddings.
    Fallback на простой LRU если sentence-transformers недоступен.
    """
    
    def __init__(self, threshold: float = SIMILARITY_THRESHOLD, maxsize: int = MAX_CACHE_SIZE):
        self.threshold = threshold
        self.maxsize = maxsize
        self.cache: List[CacheEntry] = []
        self.model = None
        self._model_loaded = False
        self._load_model()
    
    def _load_model(self):
        """Ленивая загрузка модели embeddings"""
        try:
            from sentence_transformers import SentenceTransformer
            # Используем компактную многоязычную модель
            model_name = 'paraphrase-multilingual-MiniLM-L12-v2'
            logger.info(f'[SemanticCache] Загрузка модели {model_name}...')
            self.model = SentenceTransformer(model_name)
            self._model_loaded = True
            logger.info('[SemanticCache] Модель загружена')
        except ImportError:
            logger.warning('[SemanticCache] sentence-transformers не установлен, используем fallback')
            self._model_loaded = False
        except Exception as e:
            logger.error(f'[SemanticCache] Ошибка загрузки модели: {e}')
            self._model_loaded = False
    
    def _get_embedding(self, text: str) -> Optional[np.ndarray]:
        """Получить embedding для текста"""
        if not self._model_loaded or self.model is None:
            return None
        try:
            return self.model.encode(text, convert_to_numpy=True)
        except Exception as e:
            logger.error(f'[SemanticCache] Ошибка embedding: {e}')
            return None
    
    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Косинусное сходство между векторами"""
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))
    
    def _context_hash(self, context: list) -> str:
        """Хэш контекста для учёта при поиске"""
        return str(hash(tuple(context[-3:])))  # Последние 3 элемента контекста
    
    def get(self, question: str, context: list = None) -> Tuple[Optional[str], float]:
        """
        Поиск в кэше по семантической схожести.
        
        Returns:
            (answer, similarity) или (None, 0.0)
        """
        if not self.cache:
            return None, 0.0
        
        ctx_hash = self._context_hash(context or [])
        
        # Если модель недоступна - fallback на exact match
        if not self._model_loaded:
            question_lower = question.lower().strip()
            for entry in self.cache:
                if entry.question.lower().strip() == question_lower:
                    if entry.context_hash == ctx_hash or not context:
                        return entry.answer, 1.0
            return None, 0.0
        
        # Semantic search
        query_embedding = self._get_embedding(question)
        if query_embedding is None:
            return None, 0.0
        
        best_match: Optional[CacheEntry] = None
        best_similarity = 0.0
        
        for entry in self.cache:
            # Учитываем контекст
            if context and entry.context_hash != ctx_hash:
                continue
            
            similarity = self._cosine_similarity(query_embedding, entry.embedding)
            if similarity > best_similarity:
                best_similarity = similarity
                best_match = entry
        
        if best_match and best_similarity >= self.threshold:
            logger.info(f'[SemanticCache] HIT: similarity={best_similarity:.3f}')
            return best_match.answer, best_similarity
        
        return None, best_similarity
    
    def set(self, question: str, context: list, answer: str):
        """Добавить в кэш"""
        if not answer or not answer.strip():
            return
        
        ctx_hash = self._context_hash(context or [])
        
        # Получаем embedding
        embedding = self._get_embedding(question)
        if embedding is None:
            # Fallback: используем нулевой вектор
            embedding = np.zeros(384)
        
        entry = CacheEntry(
            question=question,
            answer=answer,
            embedding=embedding,
            context_hash=ctx_hash
        )
        
        # Проверяем дубликаты (exact match)
        for i, existing in enumerate(self.cache):
            if existing.question.lower().strip() == question.lower().strip():
                self.cache[i] = entry
                return
        
        # Добавляем
        self.cache.append(entry)
        
        # LRU eviction
        if len(self.cache) > self.maxsize:
            self.cache.pop(0)
        
        logger.info(f'[SemanticCache] SET: {question[:50]}... (cache size: {len(self.cache)})')
    
    def clear(self):
        """Очистить кэш"""
        self.cache = []
    
    @property
    def size(self) -> int:
        return len(self.cache)


# Глобальный инстанс
_semantic_cache: Optional[SemanticCache] = None


def get_semantic_cache() -> SemanticCache:
    """Получить глобальный инстанс semantic cache"""
    global _semantic_cache
    if _semantic_cache is None:
        _semantic_cache = SemanticCache()
    return _semantic_cache
