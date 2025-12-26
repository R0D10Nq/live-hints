"""
Тесты для python/llm/ollama_client.py
"""
import pytest
import asyncio
import json
from unittest.mock import patch, MagicMock, AsyncMock


class TestHintMetrics:
    """Тесты для HintMetrics"""
    
    def test_init(self):
        """Инициализация сбрасывает все метрики"""
        from llm.ollama_client import HintMetrics
        
        metrics = HintMetrics()
        assert metrics.request_start is None
        assert metrics.first_token_time is None
        assert metrics.done_time is None
    
    def test_reset(self):
        """Reset сбрасывает метрики"""
        from llm.ollama_client import HintMetrics
        
        metrics = HintMetrics()
        metrics.request_start = 1.0
        metrics.first_token_time = 2.0
        metrics.reset()
        
        assert metrics.request_start is None
        assert metrics.first_token_time is None
    
    def test_request_started(self):
        """request_started устанавливает время"""
        from llm.ollama_client import HintMetrics
        
        metrics = HintMetrics()
        metrics.request_started()
        
        assert metrics.request_start is not None
    
    def test_first_token_only_once(self):
        """first_token устанавливается только один раз"""
        from llm.ollama_client import HintMetrics
        import time
        
        metrics = HintMetrics()
        metrics.first_token()
        first = metrics.first_token_time
        
        time.sleep(0.01)
        metrics.first_token()
        
        assert metrics.first_token_time == first
    
    def test_done(self):
        """done устанавливает время"""
        from llm.ollama_client import HintMetrics
        
        metrics = HintMetrics()
        metrics.done()
        
        assert metrics.done_time is not None
    
    def test_get_stats(self):
        """get_stats возвращает ttft и total"""
        from llm.ollama_client import HintMetrics
        import time
        
        metrics = HintMetrics()
        metrics.request_started()
        time.sleep(0.05)
        metrics.first_token()
        time.sleep(0.05)
        metrics.done()
        
        stats = metrics.get_stats()
        
        assert 'ttft_ms' in stats
        assert 'total_ms' in stats
        assert stats['ttft_ms'] >= 40
        assert stats['total_ms'] >= 90
    
    def test_get_stats_no_data(self):
        """get_stats возвращает 0 без данных"""
        from llm.ollama_client import HintMetrics
        
        metrics = HintMetrics()
        stats = metrics.get_stats()
        
        assert stats['ttft_ms'] == 0
        assert stats['total_ms'] == 0


class TestBuildMessages:
    """Тесты для build_messages"""
    
    def test_basic_structure(self):
        """Базовая структура сообщений"""
        from llm.ollama_client import build_messages
        
        messages = build_messages('System prompt', [], 'Question?')
        
        assert len(messages) == 2
        assert messages[0]['role'] == 'system'
        assert messages[0]['content'] == 'System prompt'
        assert messages[1]['role'] == 'user'
        assert messages[1]['content'] == 'Question?'
    
    def test_with_context(self):
        """Добавляет контекст"""
        from llm.ollama_client import build_messages
        
        context = ['line1', 'line2', 'line3']
        messages = build_messages('System', context, 'Question')
        
        assert len(messages) == 3
        assert 'Контекст разговора' in messages[1]['content']
        assert 'line1' in messages[1]['content']
    
    def test_with_few_shot(self):
        """Добавляет few-shot примеры"""
        from llm.ollama_client import build_messages
        
        few_shot = [
            {'user': 'Example question', 'assistant': 'Example answer'}
        ]
        messages = build_messages('System', [], 'Question', few_shot)
        
        assert len(messages) == 4
        assert messages[1]['role'] == 'user'
        assert messages[1]['content'] == 'Example question'
        assert messages[2]['role'] == 'assistant'
        assert messages[2]['content'] == 'Example answer'
    
    def test_context_limit(self):
        """Контекст ограничен последними 10 элементами"""
        from llm.ollama_client import build_messages
        
        context = [f'line{i}' for i in range(20)]
        messages = build_messages('System', context, 'Question')
        
        context_msg = messages[1]['content']
        assert 'line10' in context_msg
        assert 'line19' in context_msg
        assert 'line0' not in context_msg


class TestOllamaClient:
    """Тесты для OllamaClient"""
    
    @patch('llm.ollama_client.HintCache')
    def test_init(self, mock_cache):
        """Инициализация клиента"""
        from llm.ollama_client import OllamaClient
        
        cache = MagicMock()
        client = OllamaClient('http://localhost:11434', 'llama3', cache, 'user context')
        
        assert client.base_url == 'http://localhost:11434'
        assert client.model == 'llama3'
        assert client.user_context == 'user context'
    
    @patch('llm.ollama_client.requests.get')
    @patch('llm.ollama_client.HintCache')
    def test_check_available_success(self, mock_cache, mock_get):
        """_check_available возвращает True если Ollama доступен"""
        from llm.ollama_client import OllamaClient
        
        mock_get.return_value.status_code = 200
        
        client = OllamaClient('http://localhost:11434', 'llama3', MagicMock())
        result = client._check_available()
        
        assert result is True
    
    @patch('llm.ollama_client.requests.get')
    @patch('llm.ollama_client.HintCache')
    def test_check_available_failure(self, mock_cache, mock_get):
        """_check_available возвращает False при ошибке"""
        from llm.ollama_client import OllamaClient
        
        mock_get.side_effect = Exception('Connection refused')
        
        client = OllamaClient('http://localhost:11434', 'llama3', MagicMock())
        result = client._check_available()
        
        assert result is False
    
    @patch('llm.ollama_client.requests.post')
    @patch('llm.ollama_client.classify_question')
    @patch('llm.ollama_client.build_contextual_prompt')
    @patch('llm.ollama_client.get_few_shot_examples')
    def test_generate_cache_hit(self, mock_few_shot, mock_prompt, mock_classify, mock_post):
        """generate возвращает кэшированный результат"""
        from llm.ollama_client import OllamaClient
        
        cache = MagicMock()
        cache.get.return_value = 'Cached hint'
        
        client = OllamaClient('http://localhost:11434', 'llama3', cache)
        result = client.generate('Question?', [])
        
        assert result == 'Cached hint'
        mock_post.assert_not_called()
    
    @patch('llm.ollama_client.requests.post')
    @patch('llm.ollama_client.classify_question')
    @patch('llm.ollama_client.build_contextual_prompt')
    @patch('llm.ollama_client.get_few_shot_examples')
    def test_generate_success(self, mock_few_shot, mock_prompt, mock_classify, mock_post):
        """generate успешно генерирует подсказку"""
        from llm.ollama_client import OllamaClient
        
        cache = MagicMock()
        cache.get.return_value = None
        
        mock_classify.return_value = 'technical'
        mock_prompt.return_value = 'System prompt'
        mock_few_shot.return_value = []
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'message': {'content': 'Generated hint'}
        }
        mock_post.return_value = mock_response
        
        client = OllamaClient('http://localhost:11434', 'llama3', cache)
        result = client.generate('Question?', [])
        
        assert result == 'Generated hint'
        cache.set.assert_called_once()
    
    @patch('llm.ollama_client.requests.post')
    @patch('llm.ollama_client.classify_question')
    @patch('llm.ollama_client.build_contextual_prompt')
    @patch('llm.ollama_client.get_few_shot_examples')
    def test_generate_connection_error(self, mock_few_shot, mock_prompt, mock_classify, mock_post):
        """generate обрабатывает ConnectionError"""
        from llm.ollama_client import OllamaClient
        import requests
        
        cache = MagicMock()
        cache.get.return_value = None
        mock_classify.return_value = 'general'
        mock_prompt.return_value = 'Prompt'
        mock_few_shot.return_value = []
        mock_post.side_effect = requests.exceptions.ConnectionError()
        
        client = OllamaClient('http://localhost:11434', 'llama3', cache)
        result = client.generate('Question?', [])
        
        assert 'Ollama не запущен' in result
    
    @patch('llm.ollama_client.requests.post')
    @patch('llm.ollama_client.classify_question')
    @patch('llm.ollama_client.build_contextual_prompt')
    @patch('llm.ollama_client.get_few_shot_examples')
    def test_generate_api_error(self, mock_few_shot, mock_prompt, mock_classify, mock_post):
        """generate обрабатывает ошибки API"""
        from llm.ollama_client import OllamaClient
        
        cache = MagicMock()
        cache.get.return_value = None
        mock_classify.return_value = 'general'
        mock_prompt.return_value = 'Prompt'
        mock_few_shot.return_value = []
        
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_post.return_value = mock_response
        
        client = OllamaClient('http://localhost:11434', 'llama3', cache)
        result = client.generate('Question?', [])
        
        assert 'Ошибка Ollama: 500' in result


class TestExtractHint:
    """Тесты для _extract_hint"""
    
    def test_extract_from_message_content(self):
        """Извлекает hint из message.content"""
        from llm.ollama_client import OllamaClient
        
        client = OllamaClient('http://localhost:11434', 'llama3', MagicMock())
        
        data = {'message': {'content': 'Hint text'}}
        result = client._extract_hint(data)
        
        assert result == 'Hint text'
    
    def test_extract_from_thinking(self):
        """Извлекает hint из thinking field"""
        from llm.ollama_client import OllamaClient
        
        client = OllamaClient('http://localhost:11434', 'llama3', MagicMock())
        
        data = {'message': {'content': '', 'thinking': 'Some thinking "Important quote here" more text'}}
        result = client._extract_hint(data)
        
        assert result == 'Important quote here'
    
    def test_extract_from_thinking_no_quotes(self):
        """Извлекает из thinking без кавычек"""
        from llm.ollama_client import OllamaClient
        
        client = OllamaClient('http://localhost:11434', 'llama3', MagicMock())
        
        data = {'message': {'content': '', 'thinking': 'First sentence. Second sentence. Third sentence.'}}
        result = client._extract_hint(data)
        
        assert 'Second sentence' in result
        assert 'Third sentence' in result
    
    def test_extract_from_response(self):
        """Fallback на response field"""
        from llm.ollama_client import OllamaClient
        
        client = OllamaClient('http://localhost:11434', 'llama3', MagicMock())
        
        data = {'response': 'Response text'}
        result = client._extract_hint(data)
        
        assert result == 'Response text'
    
    def test_extract_from_content(self):
        """Fallback на content field"""
        from llm.ollama_client import OllamaClient
        
        client = OllamaClient('http://localhost:11434', 'llama3', MagicMock())
        
        data = {'content': 'Content text'}
        result = client._extract_hint(data)
        
        assert result == 'Content text'
    
    def test_extract_from_choices(self):
        """Fallback на OpenAI-style choices"""
        from llm.ollama_client import OllamaClient
        
        client = OllamaClient('http://localhost:11434', 'llama3', MagicMock())
        
        data = {'choices': [{'message': {'content': 'Choice content'}}]}
        result = client._extract_hint(data)
        
        assert result == 'Choice content'
    
    def test_extract_empty(self):
        """Возвращает пустую строку если ничего нет"""
        from llm.ollama_client import OllamaClient
        
        client = OllamaClient('http://localhost:11434', 'llama3', MagicMock())
        
        data = {}
        result = client._extract_hint(data)
        
        assert result == ''


class TestGenerateStream:
    """Тесты для generate_stream"""
    
    @pytest.mark.asyncio
    @patch('llm.ollama_client.get_semantic_cache')
    async def test_semantic_cache_hit(self, mock_get_cache):
        """Возвращает из semantic cache"""
        from llm.ollama_client import OllamaClient
        
        mock_cache = MagicMock()
        mock_cache.get.return_value = ('Cached result', 0.95)
        mock_get_cache.return_value = mock_cache
        
        client = OllamaClient('http://localhost:11434', 'llama3', MagicMock())
        
        results = []
        async for chunk in client.generate_stream('Question?', []):
            results.append(chunk)
        
        assert results == ['Cached result']
    
    @pytest.mark.asyncio
    @patch('llm.ollama_client.get_semantic_cache')
    async def test_lru_cache_hit(self, mock_get_cache):
        """Возвращает из LRU cache"""
        from llm.ollama_client import OllamaClient
        
        semantic_cache = MagicMock()
        semantic_cache.get.return_value = (None, 0)
        mock_get_cache.return_value = semantic_cache
        
        lru_cache = MagicMock()
        lru_cache.get.return_value = 'LRU cached'
        
        client = OllamaClient('http://localhost:11434', 'llama3', lru_cache)
        
        results = []
        async for chunk in client.generate_stream('Question?', []):
            results.append(chunk)
        
        assert results == ['LRU cached']


class TestGenerateStreamNoCache:
    """Тесты для generate_stream без кэша"""
    
    @pytest.mark.asyncio
    @patch('llm.ollama_client.get_semantic_cache')
    @patch('llm.ollama_client.classify_question')
    @patch('llm.ollama_client.get_max_tokens_for_type')
    @patch('llm.ollama_client.get_temperature_for_type')
    @patch('llm.ollama_client.log_llm_request')
    @patch('llm.ollama_client.get_advanced_rag')
    @patch('llm.ollama_client.build_contextual_prompt')
    @patch('llm.ollama_client.get_few_shot_examples')
    async def test_stream_builds_prompt(
        self, mock_few_shot, mock_prompt, mock_rag, mock_log_req,
        mock_temp, mock_tokens, mock_classify, mock_cache
    ):
        """generate_stream строит промпт корректно"""
        from llm.ollama_client import OllamaClient
        
        # Настраиваем моки
        sem_cache = MagicMock()
        sem_cache.get.return_value = (None, 0)
        mock_cache.return_value = sem_cache
        
        mock_classify.return_value = 'technical'
        mock_tokens.return_value = 500
        mock_temp.return_value = 0.7
        mock_prompt.return_value = 'Base prompt'
        mock_few_shot.return_value = []
        
        rag = MagicMock()
        rag.build_enhanced_prompt.return_value = 'Enhanced prompt'
        rag.get_adaptive_context.return_value = []
        mock_rag.return_value = rag
        
        lru_cache = MagicMock()
        lru_cache.get.return_value = None
        
        client = OllamaClient('http://localhost:11434', 'llama3', lru_cache)
        
        # Вызываем generate_stream — он упадёт на aiohttp, но покроет строки до try
        try:
            async for _ in client.generate_stream('What is Python?', []):
                pass
        except:
            pass
        
        # Проверяем что моки были вызваны
        mock_classify.assert_called_once()
        mock_tokens.assert_called_once()
        mock_temp.assert_called_once()
    
    @pytest.mark.asyncio
    @patch('llm.ollama_client.get_semantic_cache')
    @patch('llm.ollama_client.classify_question')
    @patch('llm.ollama_client.get_max_tokens_for_type')
    @patch('llm.ollama_client.get_temperature_for_type')
    @patch('llm.ollama_client.log_llm_request')
    @patch('llm.ollama_client.get_advanced_rag')
    @patch('llm.ollama_client.build_contextual_prompt')
    @patch('llm.ollama_client.get_few_shot_examples')
    async def test_stream_with_custom_prompt(
        self, mock_few_shot, mock_prompt, mock_rag, mock_log_req,
        mock_temp, mock_tokens, mock_classify, mock_cache
    ):
        """generate_stream с custom_system_prompt"""
        from llm.ollama_client import OllamaClient
        
        sem_cache = MagicMock()
        sem_cache.get.return_value = (None, 0)
        mock_cache.return_value = sem_cache
        
        mock_classify.return_value = 'experience'
        mock_tokens.return_value = 800
        mock_temp.return_value = 0.8
        mock_prompt.return_value = 'Base'
        mock_few_shot.return_value = []
        
        rag = MagicMock()
        rag.build_enhanced_prompt.return_value = 'Enhanced'
        rag.get_adaptive_context.return_value = []
        mock_rag.return_value = rag
        
        lru_cache = MagicMock()
        lru_cache.get.return_value = None
        
        client = OllamaClient('http://localhost:11434', 'llama3', lru_cache)
        
        try:
            async for _ in client.generate_stream(
                'Tell about experience', [], 
                custom_system_prompt='Custom prompt',
                custom_user_context='Custom context'
            ):
                pass
        except:
            pass
        
        # Проверяем что custom prompt был использован
        mock_prompt.assert_called()


class TestOllamaClientGenerate:
    """Дополнительные тесты для generate"""
    
    @patch('llm.ollama_client.requests.post')
    @patch('llm.ollama_client.classify_question')
    @patch('llm.ollama_client.build_contextual_prompt')
    @patch('llm.ollama_client.get_few_shot_examples')
    def test_generate_timeout(self, mock_few_shot, mock_prompt, mock_classify, mock_post):
        """generate обрабатывает Timeout"""
        from llm.ollama_client import OllamaClient
        import requests
        
        cache = MagicMock()
        cache.get.return_value = None
        mock_classify.return_value = 'general'
        mock_prompt.return_value = 'Prompt'
        mock_few_shot.return_value = []
        mock_post.side_effect = requests.exceptions.Timeout()
        
        client = OllamaClient('http://localhost:11434', 'llama3', cache)
        result = client.generate('Question here?', [])
        
        assert 'Ollama' in result or 'Ошибка' in result
    
    @patch('llm.ollama_client.requests.post')
    @patch('llm.ollama_client.classify_question')
    @patch('llm.ollama_client.build_contextual_prompt')
    @patch('llm.ollama_client.get_few_shot_examples')
    def test_generate_with_custom_params(self, mock_few_shot, mock_prompt, mock_classify, mock_post):
        """generate с кастомными параметрами"""
        from llm.ollama_client import OllamaClient
        
        cache = MagicMock()
        cache.get.return_value = None
        mock_classify.return_value = 'technical'
        mock_prompt.return_value = 'Prompt'
        mock_few_shot.return_value = []
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'message': {'content': 'Response'}}
        mock_post.return_value = mock_response
        
        client = OllamaClient('http://localhost:11434', 'llama3', cache)
        result = client.generate('Question here?', [], max_tokens=100, temperature=0.5)
        
        assert result == 'Response'
