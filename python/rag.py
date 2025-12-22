"""
RAG (Retrieval-Augmented Generation) для улучшения точности ответов
Использует semantic search для поиска релевантного контекста из резюме
"""

import os
import logging
from typing import List, Optional, Tuple
from pathlib import Path

logger = logging.getLogger('RAG')


class SimpleRAG:
    """
    Простая RAG система без внешних зависимостей.
    Использует keyword matching и TF-IDF подобный подход.
    """
    
    def __init__(self):
        self.documents: List[Tuple[str, str]] = []  # (chunk_id, text)
        self.user_context = ""
        self._load_user_context()
    
    def _load_user_context(self):
        """Загрузка контекста пользователя"""
        context_path = Path(__file__).parent / 'user_context.txt'
        try:
            if context_path.exists():
                self.user_context = context_path.read_text(encoding='utf-8')
                self._chunk_context()
                logger.info(f'[RAG] Загружено {len(self.documents)} чанков контекста')
        except Exception as e:
            logger.warning(f'[RAG] Ошибка загрузки контекста: {e}')
    
    def _chunk_context(self, chunk_size: int = 200):
        """Разбивка контекста на чанки"""
        if not self.user_context:
            return
        
        lines = self.user_context.split('\n')
        current_chunk = []
        current_size = 0
        chunk_id = 0
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            current_chunk.append(line)
            current_size += len(line)
            
            if current_size >= chunk_size:
                self.documents.append((f'chunk_{chunk_id}', ' '.join(current_chunk)))
                current_chunk = []
                current_size = 0
                chunk_id += 1
        
        if current_chunk:
            self.documents.append((f'chunk_{chunk_id}', ' '.join(current_chunk)))
    
    def _extract_keywords(self, text: str) -> set:
        """Извлечение ключевых слов из текста"""
        # Стоп-слова
        stop_words = {
            'и', 'в', 'на', 'с', 'по', 'для', 'из', 'к', 'о', 'об', 'от',
            'что', 'как', 'это', 'то', 'не', 'да', 'но', 'а', 'или', 'же',
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'can', 'could', 'should', 'may', 'might', 'must', 'shall',
            'про', 'при', 'над', 'под', 'между', 'через', 'после', 'до',
            'такое', 'какой', 'какая', 'какие', 'чем', 'когда', 'где', 'кто',
            'расскажи', 'объясни', 'опиши', 'покажи', 'приведи', 'пример'
        }
        
        # Токенизация
        words = text.lower().replace('?', ' ').replace('.', ' ').replace(',', ' ').split()
        
        # Фильтрация
        keywords = {w for w in words if len(w) > 2 and w not in stop_words}
        
        return keywords
    
    def retrieve(self, query: str, top_k: int = 3) -> List[str]:
        """
        Поиск релевантных чанков для вопроса.
        
        Args:
            query: Текст вопроса
            top_k: Количество результатов
            
        Returns:
            Список релевантных текстов
        """
        if not self.documents:
            return []
        
        query_keywords = self._extract_keywords(query)
        if not query_keywords:
            return []
        
        scores = []
        for chunk_id, text in self.documents:
            doc_keywords = self._extract_keywords(text)
            
            # Jaccard similarity
            intersection = len(query_keywords & doc_keywords)
            union = len(query_keywords | doc_keywords)
            score = intersection / union if union > 0 else 0
            
            scores.append((score, text))
        
        # Сортировка по релевантности
        scores.sort(key=lambda x: x[0], reverse=True)
        
        # Возвращаем top_k с score > 0
        results = [text for score, text in scores[:top_k] if score > 0]
        
        if results:
            logger.info(f'[RAG] Найдено {len(results)} релевантных чанков для: {query[:50]}...')
        
        return results
    
    def build_enhanced_prompt(self, question: str, context: List[str], 
                               question_type: str, base_prompt: str) -> str:
        """
        Строит улучшенный промпт с RAG контекстом.
        
        Args:
            question: Текущий вопрос
            context: История диалога
            question_type: Тип вопроса (technical/experience/general)
            base_prompt: Базовый системный промпт
            
        Returns:
            Улучшенный промпт
        """
        # Получаем релевантный контекст из резюме
        relevant_chunks = self.retrieve(question, top_k=2)
        
        # Формируем промпт
        enhanced_prompt = base_prompt
        
        if relevant_chunks and question_type in ['experience', 'general']:
            enhanced_prompt += '\n\n--- РЕЛЕВАНТНАЯ ИНФОРМАЦИЯ ИЗ РЕЗЮМЕ ---\n'
            enhanced_prompt += '\n'.join(relevant_chunks)
            enhanced_prompt += '\n--- КОНЕЦ РЕЛЕВАНТНОЙ ИНФОРМАЦИИ ---'
        
        # Добавляем акцент на текущий вопрос
        enhanced_prompt += '\n\nВАЖНО: Отвечай СТРОГО на последний вопрос пользователя.'
        enhanced_prompt += ' Предыдущие вопросы даны только для контекста.'
        
        return enhanced_prompt


# Глобальный инстанс
_rag_instance: Optional[SimpleRAG] = None


def get_rag() -> SimpleRAG:
    """Получить глобальный инстанс RAG"""
    global _rag_instance
    if _rag_instance is None:
        _rag_instance = SimpleRAG()
    return _rag_instance
