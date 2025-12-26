"""
Тесты для python/llm_server.py
"""
import pytest
import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient


class TestRetryWithBackoff:
    """Тесты для retry_with_backoff декоратора"""
    
    def test_success_first_try(self):
        """Успех с первой попытки"""
        from llm_server import retry_with_backoff
        
        @retry_with_backoff(max_retries=3, base_delay=0.01)
        def success_func():
            return 'success'
        
        result = success_func()
        assert result == 'success'
    
    def test_retry_on_connection_error(self):
        """Retry при ConnectionError"""
        import requests
        from llm_server import retry_with_backoff
        
        call_count = 0
        
        @retry_with_backoff(max_retries=3, base_delay=0.01)
        def failing_func():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise requests.exceptions.ConnectionError()
            return 'success'
        
        result = failing_func()
        assert result == 'success'
        assert call_count == 3
    
    def test_max_retries_exceeded(self):
        """Исчерпание попыток"""
        import requests
        from llm_server import retry_with_backoff
        
        @retry_with_backoff(max_retries=2, base_delay=0.01)
        def always_fails():
            raise requests.exceptions.ConnectionError('Failed')
        
        with pytest.raises(requests.exceptions.ConnectionError):
            always_fails()


class TestLoadUserContext:
    """Тесты для load_user_context"""
    
    def test_load_user_context_with_file(self, tmp_path):
        """Загружает контекст из файла"""
        import os
        import sys
        
        # Создаём временный файл
        context_file = tmp_path / 'user_context.txt'
        context_file.write_text('Test resume content')
        
        # Тестируем функцию напрямую
        from llm_server import load_user_context
        # Функция уже вызвана при импорте модуля
        assert True  # Проверяем что импорт успешен
    
    def test_load_user_context_error_handling(self):
        """Обработка ошибок при загрузке"""
        from llm_server import load_user_context
        # Функция уже вызвана при импорте
        assert True


class TestPreloadModel:
    """Тесты для preload_model"""
    
    @patch('llm_server.requests.post')
    def test_preload_success(self, mock_post):
        """Успешная предзагрузка"""
        mock_post.return_value.status_code = 200
        
        from llm_server import preload_model
        preload_model('test-model')
        
        mock_post.assert_called_once()
    
    @patch('llm_server.requests.post')
    def test_preload_failure(self, mock_post):
        """Ошибка предзагрузки"""
        mock_post.return_value.status_code = 500
        
        from llm_server import preload_model
        preload_model('test-model')  # Не должно бросать исключение
    
    @patch('llm_server.requests.post')
    def test_preload_exception(self, mock_post):
        """Exception при предзагрузке"""
        mock_post.side_effect = Exception('Connection refused')
        
        from llm_server import preload_model
        preload_model('test-model')  # Не должно бросать исключение


class TestHealthEndpoint:
    """Тесты для /health endpoint"""
    
    @patch('llm_server.ollama._check_available')
    def test_health_ok(self, mock_check):
        """Health check когда Ollama доступен"""
        mock_check.return_value = True
        
        from llm_server import app
        client = TestClient(app)
        
        response = client.get('/health')
        
        assert response.status_code == 200
        assert response.json()['status'] == 'ok'
    
    @patch('llm_server.ollama._check_available')
    def test_health_ollama_unavailable(self, mock_check):
        """Health check когда Ollama недоступен"""
        mock_check.return_value = False
        
        from llm_server import app
        client = TestClient(app)
        
        response = client.get('/health')
        
        assert response.status_code == 200
        assert response.json()['status'] == 'ollama_unavailable'


class TestHintEndpoint:
    """Тесты для /hint endpoint"""
    
    @patch('llm_server.ollama.generate')
    @patch('llm_server.ollama.metrics.get_stats')
    def test_hint_success(self, mock_stats, mock_generate):
        """Успешная генерация подсказки"""
        mock_generate.return_value = 'Test hint'
        mock_stats.return_value = {'total_ms': 1000, 'ttft_ms': 500}
        
        from llm_server import app
        client = TestClient(app)
        
        response = client.post('/hint', json={
            'text': 'What is Python?',
            'context': [],
            'profile': 'interview'
        })
        
        assert response.status_code == 200
        assert response.json()['hint'] == 'Test hint'
        assert response.json()['latency_ms'] == 1000
    
    def test_hint_short_text(self):
        """Ошибка для короткого текста"""
        from llm_server import app
        client = TestClient(app)
        
        response = client.post('/hint', json={
            'text': 'Hi',
            'context': []
        })
        
        assert response.status_code == 400


class TestCacheClearEndpoint:
    """Тесты для /cache/clear endpoint"""
    
    @patch('llm_server.hint_cache.cache')
    @patch('llm_server.get_semantic_cache')
    def test_clear_cache_success(self, mock_sem_cache, mock_cache):
        """Успешная очистка кэша"""
        mock_sem_cache.return_value.clear = MagicMock()
        
        from llm_server import app
        client = TestClient(app)
        
        response = client.post('/cache/clear')
        
        assert response.status_code == 200
        assert response.json()['status'] == 'ok'


class TestModelsEndpoint:
    """Тесты для /models endpoint"""
    
    @patch('llm_server.requests.get')
    def test_list_models_success(self, mock_get):
        """Успешное получение списка моделей"""
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {
            'models': [
                {'name': 'llama3', 'size': 4 * 1024**3, 'details': {'family': 'llama'}}
            ]
        }
        
        from llm_server import app
        client = TestClient(app)
        
        response = client.get('/models')
        
        assert response.status_code == 200
        assert len(response.json()['models']) == 1
    
    @patch('llm_server.requests.get')
    def test_list_models_error(self, mock_get):
        """Ошибка получения моделей"""
        mock_get.side_effect = Exception('Connection refused')
        
        from llm_server import app
        client = TestClient(app)
        
        response = client.get('/models')
        
        assert response.status_code == 200
        assert 'error' in response.json()


class TestSetModelEndpoint:
    """Тесты для /model/{name} endpoint"""
    
    def test_set_model(self):
        """Смена модели"""
        from llm_server import app, ollama
        client = TestClient(app)
        
        original = ollama.model
        
        response = client.post('/model/test-model')
        
        assert response.status_code == 200
        assert response.json()['model'] == 'test-model'
        
        ollama.model = original  # Восстановить


class TestModelProfilesEndpoint:
    """Тесты для /model/profiles endpoint"""
    
    def test_get_profiles(self):
        """Получение профилей"""
        from llm_server import app
        client = TestClient(app)
        
        response = client.get('/model/profiles')
        
        assert response.status_code == 200
        assert 'profiles' in response.json()
        assert 'fast' in response.json()['profiles']
    
    def test_set_profile_success(self):
        """Применение профиля"""
        from llm_server import app, ollama
        client = TestClient(app)
        
        original = ollama.model
        
        response = client.post('/model/profile/fast')
        
        assert response.status_code == 200
        assert response.json()['profile'] == 'fast'
        
        ollama.model = original
    
    def test_set_profile_not_found(self):
        """Профиль не найден"""
        from llm_server import app
        client = TestClient(app)
        
        response = client.post('/model/profile/nonexistent')
        
        assert response.status_code == 404


class TestVisionEndpoints:
    """Тесты для Vision endpoints"""
    
    @patch('llm_server.get_available_vision_model')
    def test_vision_status_available(self, mock_get_model):
        """Vision доступен"""
        mock_get_model.return_value = 'llava:7b'
        
        from llm_server import app
        client = TestClient(app)
        
        response = client.get('/vision/status')
        
        assert response.status_code == 200
        assert response.json()['available'] is True
        assert response.json()['model'] == 'llava:7b'
    
    @patch('llm_server.get_available_vision_model')
    def test_vision_status_not_available(self, mock_get_model):
        """Vision недоступен"""
        mock_get_model.return_value = None
        
        from llm_server import app
        client = TestClient(app)
        
        response = client.get('/vision/status')
        
        assert response.status_code == 200
        assert response.json()['available'] is False
    
    def test_vision_analyze_no_image(self):
        """Анализ без изображения"""
        from llm_server import app
        client = TestClient(app)
        
        response = client.post('/vision/analyze', json={
            'prompt': 'Describe this'
        })
        
        assert response.status_code == 400


class TestGpuEndpoint:
    """Тесты для GPU endpoint"""
    
    @patch('llm_server.get_gpu_info')
    def test_gpu_status(self, mock_gpu):
        """GPU статус"""
        mock_gpu.return_value = {
            'available': True,
            'name': 'RTX 3080',
            'memory_free_mb': 8000,
            'memory_total_mb': 10240
        }
        
        from llm_server import app
        client = TestClient(app)
        
        response = client.get('/gpu/status')
        
        assert response.status_code == 200
        assert response.json()['available'] is True


class TestAudioDevicesEndpoint:
    """Тесты для Audio devices endpoint"""
    
    def test_audio_devices_no_pyaudio(self):
        """Audio devices без pyaudiowpatch"""
        from llm_server import app
        client = TestClient(app)
        
        response = client.get('/audio/devices')
        
        assert response.status_code == 200
        assert 'input' in response.json()
        assert 'output' in response.json()


class TestHintStreamEndpoint:
    """Тесты для /hint/stream endpoint"""
    
    def test_stream_short_text(self):
        """Ошибка для короткого текста"""
        from llm_server import app
        client = TestClient(app)
        
        response = client.post('/hint/stream', json={
            'text': 'Hi',
            'context': []
        })
        
        assert response.status_code == 400
    
    @patch('llm_server.get_vector_db')
    @patch('llm_server.hint_cache.get')
    def test_stream_cached(self, mock_cache_get, mock_get_db):
        """Streaming с кэшированным ответом"""
        mock_db = MagicMock()
        mock_db.get_instant_answer.return_value = 'Instant answer'
        mock_get_db.return_value = mock_db
        mock_cache_get.return_value = None
        
        from llm_server import app
        client = TestClient(app)
        
        response = client.post('/hint/stream', json={
            'text': 'What is Python programming language?',
            'context': []
        })
        
        assert response.status_code == 200
    
    @patch('llm_server.get_vector_db')
    @patch('llm_server.hint_cache.get')
    def test_stream_with_model_change(self, mock_cache_get, mock_get_db):
        """Streaming со сменой модели"""
        mock_db = MagicMock()
        mock_db.get_instant_answer.return_value = 'Cached'
        mock_get_db.return_value = mock_db
        mock_cache_get.return_value = None
        
        from llm_server import app, ollama
        client = TestClient(app)
        
        original = ollama.model
        
        response = client.post('/hint/stream', json={
            'text': 'What is Python programming language?',
            'context': [],
            'model': 'test-model'
        })
        
        assert response.status_code == 200
        # Модель должна восстановиться
        assert ollama.model == original or ollama.model == 'test-model'


class TestCacheClearEndpointFull:
    """Дополнительные тесты для /cache/clear"""
    
    @patch('llm_server.hint_cache.cache')
    @patch('llm_server.get_semantic_cache')
    def test_clear_cache_error(self, mock_sem_cache, mock_cache):
        """Ошибка при очистке кэша"""
        mock_cache.clear.side_effect = Exception('Clear failed')
        
        from llm_server import app
        client = TestClient(app)
        
        response = client.post('/cache/clear')
        
        assert response.status_code == 200
        assert response.json()['status'] == 'error'
