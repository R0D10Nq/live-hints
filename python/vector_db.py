"""
Vector DB - Персистентное хранилище Q&A с семантическим поиском
Использует ChromaDB для хранения и поиска похожих вопросов
"""

import os
import json
import logging
from typing import Optional, List, Dict, Any
from pathlib import Path

logger = logging.getLogger('VectorDB')

# Путь к базе данных
DB_PATH = Path(__file__).parent / 'data' / 'chroma_db'
QUESTIONS_PATH = Path(__file__).parent / 'data' / 'questions_db.json'

# Порог схожести для instant response (понижен для лучшего покрытия)
INSTANT_THRESHOLD = 0.88
CONTEXT_THRESHOLD = 0.70


class VectorDB:
    """
    Векторная БД для хранения Q&A с семантическим поиском.
    - similarity > 0.90: instant response (кэшированный ответ)
    - similarity 0.75-0.90: используем как контекст для генерации
    - similarity < 0.75: генерируем новый ответ
    """
    
    def __init__(self):
        self.client = None
        self.collection = None
        self._initialized = False
        self._init_db()
    
    def _init_db(self):
        """Инициализация ChromaDB"""
        try:
            import chromadb
            from chromadb.config import Settings
            
            # Создаём директорию если нет
            DB_PATH.mkdir(parents=True, exist_ok=True)
            
            # Инициализируем клиент с персистентным хранилищем
            self.client = chromadb.PersistentClient(
                path=str(DB_PATH),
                settings=Settings(anonymized_telemetry=False)
            )
            
            # Создаём/получаем коллекцию
            self.collection = self.client.get_or_create_collection(
                name="interview_qa",
                metadata={"description": "Q&A для технических собеседований"}
            )
            
            self._initialized = True
            logger.info(f'[VectorDB] Инициализирован: {self.collection.count()} записей')
            
        except ImportError:
            logger.warning('[VectorDB] chromadb не установлен: pip install chromadb')
            self._initialized = False
        except Exception as e:
            logger.error(f'[VectorDB] Ошибка инициализации: {e}')
            self._initialized = False
    
    def search(self, question: str, n_results: int = 3) -> List[Dict[str, Any]]:
        """
        Поиск похожих вопросов.
        
        Returns:
            Список результатов с полями: question, answer, similarity, category
        """
        if not self._initialized or not self.collection:
            return []
        
        try:
            results = self.collection.query(
                query_texts=[question],
                n_results=n_results,
                include=['documents', 'metadatas', 'distances']
            )
            
            if not results['ids'][0]:
                return []
            
            output = []
            for i, doc_id in enumerate(results['ids'][0]):
                # ChromaDB возвращает distance (L2), конвертируем в similarity
                distance = results['distances'][0][i] if results['distances'] else 0
                similarity = 1.0 / (1.0 + distance)  # Преобразование distance в similarity
                
                output.append({
                    'id': doc_id,
                    'question': results['documents'][0][i] if results['documents'] else '',
                    'answer': results['metadatas'][0][i].get('answer', '') if results['metadatas'] else '',
                    'category': results['metadatas'][0][i].get('category', 'general') if results['metadatas'] else 'general',
                    'similarity': similarity
                })
            
            return output
            
        except Exception as e:
            logger.error(f'[VectorDB] Ошибка поиска: {e}')
            return []
    
    def get_instant_answer(self, question: str) -> Optional[str]:
        """
        Получить мгновенный ответ если similarity > 0.90
        """
        results = self.search(question, n_results=1)
        if results and results[0]['similarity'] >= INSTANT_THRESHOLD:
            logger.info(f'[VectorDB] INSTANT HIT: similarity={results[0]["similarity"]:.3f}')
            return results[0]['answer']
        return None
    
    def get_context_answers(self, question: str, n_results: int = 3) -> List[Dict[str, Any]]:
        """
        Получить похожие ответы для контекста (similarity 0.75-0.90)
        """
        results = self.search(question, n_results=n_results)
        return [r for r in results if CONTEXT_THRESHOLD <= r['similarity'] < INSTANT_THRESHOLD]
    
    def add(self, question: str, answer: str, category: str = 'general', doc_id: str = None):
        """Добавить Q&A в базу"""
        if not self._initialized or not self.collection:
            return False
        
        try:
            doc_id = doc_id or f"qa_{hash(question) % 10**8}"
            
            self.collection.add(
                ids=[doc_id],
                documents=[question],
                metadatas=[{
                    'answer': answer,
                    'category': category,
                    'question_preview': question[:100]
                }]
            )
            
            logger.info(f'[VectorDB] Добавлено: {question[:50]}...')
            return True
            
        except Exception as e:
            logger.error(f'[VectorDB] Ошибка добавления: {e}')
            return False
    
    def add_session_qa(self, question: str, answer: str):
        """Добавить Q&A из сессии (для обучения на лету)"""
        return self.add(question, answer, category='session')
    
    def load_prepared_questions(self) -> int:
        """
        Загрузить подготовленные вопросы из JSON файла.
        Возвращает количество загруженных вопросов.
        """
        if not self._initialized:
            return 0
        
        if not QUESTIONS_PATH.exists():
            logger.info('[VectorDB] Файл questions_db.json не найден')
            return 0
        
        try:
            with open(QUESTIONS_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            questions = data.get('questions', [])
            loaded = 0
            
            for q in questions:
                doc_id = f"prepared_{q.get('id', hash(q['question']) % 10**8)}"
                
                # Проверяем существование
                existing = self.collection.get(ids=[doc_id])
                if existing['ids']:
                    continue
                
                self.add(
                    question=q['question'],
                    answer=q['answer'],
                    category=q.get('category', 'general'),
                    doc_id=doc_id
                )
                loaded += 1
            
            logger.info(f'[VectorDB] Загружено {loaded} новых вопросов из questions_db.json')
            return loaded
            
        except Exception as e:
            logger.error(f'[VectorDB] Ошибка загрузки вопросов: {e}')
            return 0
    
    @property
    def count(self) -> int:
        """Количество записей в базе"""
        if not self._initialized or not self.collection:
            return 0
        return self.collection.count()
    
    def clear(self):
        """Очистить базу"""
        if self._initialized and self.client:
            try:
                self.client.delete_collection("interview_qa")
                self.collection = self.client.create_collection(
                    name="interview_qa",
                    metadata={"description": "Q&A для технических собеседований"}
                )
                logger.info('[VectorDB] База очищена')
            except Exception as e:
                logger.error(f'[VectorDB] Ошибка очистки: {e}')


# Глобальный инстанс
_vector_db: Optional[VectorDB] = None


def get_vector_db() -> VectorDB:
    """Получить глобальный инстанс VectorDB"""
    global _vector_db
    if _vector_db is None:
        _vector_db = VectorDB()
    return _vector_db


# CLI для тестирования
if __name__ == '__main__':
    import sys
    
    db = get_vector_db()
    print(f'VectorDB initialized: {db._initialized}')
    print(f'Total records: {db.count}')
    
    if len(sys.argv) > 1:
        query = ' '.join(sys.argv[1:])
        print(f'\nSearching: {query}')
        results = db.search(query)
        for r in results:
            print(f'\n[{r["similarity"]:.3f}] {r["question"][:80]}...')
            print(f'  Answer: {r["answer"][:100]}...')
