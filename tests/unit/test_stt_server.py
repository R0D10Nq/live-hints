"""
Тесты для python/stt_server.py
"""
import pytest
import json
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock


class TestSTTServer:
    """Тесты для DynamicSTTServer"""
    
    @patch('stt_server.StreamingTranscriber')
    def test_init(self, mock_transcriber):
        """Инициализация сервера"""
        from stt_server import DynamicSTTServer
        
        server = DynamicSTTServer()
        
        assert server.transcriber is None
        assert server.clients == set()
    
    @patch('stt_server.StreamingTranscriber')
    def test_init_model(self, mock_transcriber):
        """Загрузка модели"""
        mock_instance = MagicMock()
        mock_transcriber.return_value = mock_instance
        
        from stt_server import DynamicSTTServer
        server = DynamicSTTServer()
        server.init_model()
        
        mock_transcriber.assert_called_once()
        assert server.transcriber == mock_instance
    
    @patch('stt_server.StreamingTranscriber')
    def test_init_model_only_once(self, mock_transcriber):
        """Модель загружается один раз"""
        mock_instance = MagicMock()
        mock_transcriber.return_value = mock_instance
        
        from stt_server import DynamicSTTServer
        server = DynamicSTTServer()
        
        server.init_model()
        server.init_model()
        
        mock_transcriber.assert_called_once()
    


class TestMain:
    """Тесты для main функции"""
    
    @pytest.mark.asyncio
    @patch('stt_server.DynamicSTTServer')
    @patch('sys.argv', ['stt_server.py', '--mode', 'auto'])
    async def test_main_creates_server(self, mock_server_class):
        """main создаёт и запускает сервер"""
        mock_server = MagicMock()
        mock_server.start_server = AsyncMock()
        mock_server_class.return_value = mock_server
        
        from stt_server import main
        
        # Запускаем с таймаутом чтобы не зависнуть
        try:
            await asyncio.wait_for(main(), timeout=0.1)
        except asyncio.TimeoutError:
            pass
        
        mock_server.start_server.assert_called_once()


class TestGracefulShutdown:
    """Тесты для graceful shutdown"""
    
    @pytest.mark.asyncio
    @patch('stt_server.StreamingTranscriber')
    async def test_stop_server_closes_clients(self, mock_transcriber):
        """stop_server закрывает все WebSocket клиенты"""
        from stt_server import DynamicSTTServer
        
        server = DynamicSTTServer()
        
        # Создаём mock клиентов
        mock_client1 = AsyncMock()
        mock_client2 = AsyncMock()
        server.clients = {mock_client1, mock_client2}
        
        await server.stop_server()
        
        mock_client1.close.assert_called_once_with(1001, "Server shutting down")
        mock_client2.close.assert_called_once_with(1001, "Server shutting down")
        assert server.running is False
    
    @pytest.mark.asyncio
    @patch('stt_server.StreamingTranscriber')
    async def test_stop_server_handles_already_closed(self, mock_transcriber):
        """stop_server обрабатывает уже закрытых клиентов"""
        from stt_server import DynamicSTTServer
        
        server = DynamicSTTServer()
        
        # Клиент который бросит исключение
        mock_client = AsyncMock()
        mock_client.close.side_effect = Exception("Already closed")
        server.clients = {mock_client}
        
        # Не должен упасть
        await server.stop_server()
        
        assert server.running is False
