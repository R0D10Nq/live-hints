"""
LRU кэш для подсказок
Без зависимостей от FastAPI - для тестирования
"""
import hashlib
import logging

logger = logging.getLogger('Cache')


class HintCache:
    """LRU кэш для подсказок"""
    
    def __init__(self, maxsize=20):
        self.cache = {}
        self.access_order = []
        self.maxsize = maxsize
    
    def _make_key(self, text: str, context: list) -> str:
        """Создаёт ключ кэша из текста и контекста"""
        context_str = ' | '.join(context[-3:]) if context else ''
        combined = f'{text.strip().lower()}|{context_str}'
        return hashlib.md5(combined.encode()).hexdigest()
    
    def get(self, text: str, context: list):
        """Получает из кэша или None"""
        key = self._make_key(text, context)
        
        if key in self.cache:
            # Обновляем порядок доступа
            self.access_order.remove(key)
            self.access_order.append(key)
            logger.info(f'[CACHE] HIT: {text[:50]}...')
            return self.cache[key]
        
        logger.info(f'[CACHE] MISS: {text[:50]}...')
        return None
    
    def set(self, text: str, context: list, hint: str):
        """Сохраняет в кэш"""
        key = self._make_key(text, context)
        
        # Вытесняем старые если превышен лимит
        if len(self.cache) >= self.maxsize:
            oldest = self.access_order.pop(0)
            del self.cache[oldest]
        
        self.cache[key] = hint
        self.access_order.append(key)
        logger.info(f'[CACHE] SET: {text[:50]}...')
    
    def clear(self):
        """Очищает кэш"""
        self.cache.clear()
        self.access_order.clear()
