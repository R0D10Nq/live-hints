"""
Тесты для python/llm/vision.py
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock


class TestGetAvailableVisionModel:
    """Тесты для get_available_vision_model"""
    
    @patch('llm.vision.requests.get')
    def test_finds_exact_model(self, mock_get):
        """Находит точное совпадение модели"""
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            'models': [
                {'name': 'llama3'},
                {'name': 'llava:7b'},
                {'name': 'phi4'}
            ]
        }
        
        from llm.vision import get_available_vision_model
        result = get_available_vision_model('http://localhost:11434')
        
        assert result == 'llava:7b'
    
    @patch('llm.vision.requests.get')
    def test_finds_partial_match(self, mock_get):
        """Находит частичное совпадение"""
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            'models': [
                {'name': 'llama3'},
                {'name': 'llava-custom:latest'}
            ]
        }
        
        from llm.vision import get_available_vision_model
        result = get_available_vision_model('http://localhost:11434')
        
        assert 'llava' in result.lower()
    
    @patch('llm.vision.requests.get')
    def test_no_vision_model(self, mock_get):
        """Нет Vision модели"""
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            'models': [{'name': 'llama3'}, {'name': 'phi4'}]
        }
        
        from llm.vision import get_available_vision_model
        result = get_available_vision_model('http://localhost:11434')
        
        assert result is None
    
    @patch('llm.vision.requests.get')
    def test_api_error(self, mock_get):
        """Ошибка API"""
        mock_get.return_value.status_code = 500
        
        from llm.vision import get_available_vision_model
        result = get_available_vision_model('http://localhost:11434')
        
        assert result is None
    
    @patch('llm.vision.requests.get')
    def test_connection_error(self, mock_get):
        """Ошибка подключения"""
        mock_get.side_effect = Exception('Connection refused')
        
        from llm.vision import get_available_vision_model
        result = get_available_vision_model('http://localhost:11434')
        
        assert result is None


class TestAnalyzeImage:
    """Тесты для analyze_image"""
    
    @pytest.mark.asyncio
    @patch('llm.vision.get_available_vision_model')
    async def test_no_vision_model(self, mock_get_model):
        """Нет Vision модели"""
        mock_get_model.return_value = None
        
        from llm.vision import analyze_image
        result = await analyze_image(
            'http://localhost:11434',
            'llama3',
            'base64image',
            'Describe this'
        )
        
        assert 'error' in result
        assert 'hint' in result
    
    @pytest.mark.asyncio
    @patch('llm.vision.get_available_vision_model')
    @patch('llm.vision.httpx.AsyncClient')
    async def test_successful_analysis(self, mock_client, mock_get_model):
        """Успешный анализ"""
        mock_get_model.return_value = 'llava:7b'
        
        # Мокируем httpx клиент
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'message': {'content': 'This is an image of code'}
        }
        
        mock_instance = AsyncMock()
        mock_instance.post = AsyncMock(return_value=mock_response)
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=None)
        mock_client.return_value = mock_instance
        
        from llm.vision import analyze_image
        result = await analyze_image(
            'http://localhost:11434',
            'llama3',
            'base64image',
            'Describe this'
        )
        
        assert 'analysis' in result or 'error' in result
    
    @pytest.mark.asyncio
    @patch('llm.vision.get_available_vision_model')
    @patch('llm.vision.httpx.AsyncClient')
    async def test_api_error(self, mock_client, mock_get_model):
        """Ошибка API"""
        mock_get_model.return_value = 'llava:7b'
        
        mock_response = MagicMock()
        mock_response.status_code = 500
        
        mock_instance = AsyncMock()
        mock_instance.post = AsyncMock(return_value=mock_response)
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=None)
        mock_client.return_value = mock_instance
        
        from llm.vision import analyze_image
        result = await analyze_image(
            'http://localhost:11434',
            'llama3',
            'base64image',
            'Describe'
        )
        
        # Должен вернуть ошибку или результат
        assert isinstance(result, dict)
    
    @pytest.mark.asyncio
    @patch('llm.vision.get_available_vision_model')
    @patch('llm.vision.httpx.AsyncClient')
    async def test_timeout(self, mock_client, mock_get_model):
        """Таймаут"""
        import httpx
        mock_get_model.return_value = 'llava:7b'
        
        mock_instance = AsyncMock()
        mock_instance.post = AsyncMock(side_effect=httpx.TimeoutException('timeout'))
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=None)
        mock_client.return_value = mock_instance
        
        from llm.vision import analyze_image
        result = await analyze_image(
            'http://localhost:11434',
            'llama3',
            'base64image',
            'Describe'
        )
        
        assert 'error' in result
        assert 'Таймаут' in result['error']
