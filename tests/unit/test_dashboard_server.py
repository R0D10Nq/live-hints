"""
Тесты для python/dashboard_server.py
"""
import pytest
import json
import tempfile
from pathlib import Path
from datetime import datetime
from unittest.mock import patch
from fastapi.testclient import TestClient


class TestLoadMetrics:
    """Тесты для load_metrics"""
    
    def test_file_not_exists(self, tmp_path):
        """Возвращает пустой список если файл не существует"""
        with patch('dashboard_server.METRICS_FILE', tmp_path / 'nonexistent.jsonl'):
            from dashboard_server import load_metrics
            result = load_metrics(24)
            assert result == []
    
    def test_loads_recent_metrics(self, tmp_path):
        """Загружает только недавние метрики"""
        metrics_file = tmp_path / 'metrics.jsonl'
        
        now = datetime.now().isoformat()
        old = '2020-01-01T00:00:00'
        
        metrics_file.write_text(
            json.dumps(
                {
                    'timestamp': now, 
                    'event': 'test1'
                    }
                ) + '\n' +
            json.dumps(
                {
                    'timestamp': old, 
                    'event': 'test2'
                    }
                ) + '\n'
            )
        
        with patch('dashboard_server.METRICS_FILE', metrics_file):
            from dashboard_server import load_metrics
            result = load_metrics(24)
            
            assert len(result) == 1
            assert result[0]['event'] == 'test1'
    
    def test_handles_invalid_json(self, tmp_path):
        """Пропускает невалидный JSON"""
        metrics_file = tmp_path / 'metrics.jsonl'
        now = datetime.now().isoformat()
        
        metrics_file.write_text(
            'invalid json\n' +
            json.dumps(
                {
                    'timestamp': now, 
                    'event': 'valid'
                    }
                ) + '\n'
            )
        
        with patch('dashboard_server.METRICS_FILE', metrics_file):
            from dashboard_server import load_metrics
            result = load_metrics(24)
            
            assert len(result) == 1


class TestLoadSessions:
    """Тесты для load_sessions"""
    
    def test_file_not_exists(self, tmp_path):
        """Возвращает пустой список если файл не существует"""
        with patch('dashboard_server.SESSIONS_FILE', tmp_path / 'nonexistent.json'):
            from dashboard_server import load_sessions
            result = load_sessions()
            assert result == []
    
    def test_loads_sessions(self, tmp_path):
        """Загружает сессии"""
        sessions_file = tmp_path / 'sessions.json'
        sessions = [
            {
                'id': '1', 
                'date': '2024-01-01'
            }
        ]
        sessions_file.write_text(json.dumps(sessions))
        
        with patch('dashboard_server.SESSIONS_FILE', sessions_file):
            from dashboard_server import load_sessions
            result = load_sessions()
            
            assert len(result) == 1
            assert result[0]['id'] == '1'
    
    def test_handles_invalid_json(self, tmp_path):
        """Возвращает пустой список при невалидном JSON"""
        sessions_file = tmp_path / 'sessions.json'
        sessions_file.write_text('invalid json')
        
        with patch('dashboard_server.SESSIONS_FILE', sessions_file):
            from dashboard_server import load_sessions
            result = load_sessions()
            assert result == []


class TestCalculateStats:
    """Тесты для calculate_stats"""
    
    def test_empty_metrics(self):
        """Пустые метрики"""
        from dashboard_server import calculate_stats
        
        result = calculate_stats([])
        
        assert result['stt']['count'] == 0
        assert result['llm']['count'] == 0
        assert result['cache']['hits'] == 0
    
    def test_stt_metrics(self):
        """Статистика STT"""
        from dashboard_server import calculate_stats
        
        metrics = [
            {
                'event': 'stt_transcription', 
                'latency_ms': 100
                },
            {
                'event': 'stt_transcription', 
                'latency_ms': 200
                },
            {
                'event': 'stt_transcription', 
                'latency_ms': 300
                },
        ]
        
        result = calculate_stats(metrics)
        
        assert result['stt']['count'] == 3
        assert result['stt']['avg_ms'] == 200
        assert result['stt']['min_ms'] == 100
        assert result['stt']['max_ms'] == 300
    
    def test_llm_metrics(self):
        """Статистика LLM"""
        from dashboard_server import calculate_stats
        
        metrics = [
            {
                'event': 'llm_response', 
                'latency_ms': 2000, 
                'question_type': 'technical', 
                'cached': False
                },
            {
                'event': 'llm_response', 
                'latency_ms': 100, 
                'question_type': 'experience', 
                'cached': True
                },
        ]
        
        result = calculate_stats(metrics)
        
        assert result['llm']['count'] == 2
        assert result['question_types']['technical'] == 1
        assert result['question_types']['experience'] == 1
        assert result['cache']['hits'] == 1
        assert result['cache']['misses'] == 1
        assert result['cache']['hit_rate'] == 50.0
    
    def test_error_metrics(self):
        """Статистика ошибок"""
        from dashboard_server import calculate_stats
        
        metrics = [
            {
                'event': 'error', 
                'timestamp': '2024-01-01', 
                'component': 'llm', 
                'message': 'Test error'
                },
        ]
        
        result = calculate_stats(metrics)
        
        assert len(result['errors']) == 1
        assert result['errors'][0]['message'] == 'Test error'


class TestLoadDashboardTemplate:
    """Тесты для load_dashboard_template"""
    
    def test_template_exists(self, tmp_path):
        """Загружает шаблон если существует"""
        template = tmp_path / 'dashboard.html'
        template.write_text('<html>Test</html>')
        
        with patch('dashboard_server.TEMPLATE_FILE', template):
            from dashboard_server import load_dashboard_template
            result = load_dashboard_template()
            
            assert result == '<html>Test</html>'
    
    def test_template_not_exists(self, tmp_path):
        """Возвращает fallback если шаблон не существует"""
        with patch('dashboard_server.TEMPLATE_FILE', tmp_path / 'nonexistent.html'):
            from dashboard_server import load_dashboard_template
            result = load_dashboard_template()
            
            assert 'Шаблон не найден' in result


class TestDashboardEndpoints:
    """Тесты для API endpoints"""
    
    def test_dashboard_page(self, tmp_path):
        """GET / возвращает HTML"""
        template = tmp_path / 'dashboard.html'
        template.write_text('<html>Dashboard</html>')
        
        with patch('dashboard_server.TEMPLATE_FILE', template):
            from dashboard_server import app
            client = TestClient(app)
            
            response = client.get('/')
            
            assert response.status_code == 200
            assert 'Dashboard' in response.text
    
    def test_get_stats(self, tmp_path):
        """GET /api/stats возвращает статистику"""
        metrics_file = tmp_path / 'metrics.jsonl'
        now = datetime.now().isoformat()
        metrics_file.write_text(
            json.dumps(
                {
                    'timestamp': now, 
                    'event': 'stt_transcription', 
                    'latency_ms': 100
                    }
                ) + '\n'
        )
        
        with patch('dashboard_server.METRICS_FILE', metrics_file):
            from dashboard_server import app
            client = TestClient(app)
            
            response = client.get('/api/stats?hours=24')
            
            assert response.status_code == 200
            data = response.json()
            assert 'stt' in data
            assert 'llm' in data
    
    def test_get_sessions(self, tmp_path):
        """GET /api/sessions возвращает сессии"""
        sessions_file = tmp_path / 'sessions.json'
        sessions_file.write_text(
            json.dumps(
                [
                    {
                        'id': '1'
                        }
                    ]
                )
            )
        
        with patch('dashboard_server.SESSIONS_FILE', sessions_file):
            from dashboard_server import app
            client = TestClient(app)
            
            response = client.get('/api/sessions')
            
            assert response.status_code == 200
            data = response.json()
            assert data['count'] == 1
    
    def test_get_session_found(self, tmp_path):
        """GET /api/session/{id} возвращает сессию"""
        sessions_file = tmp_path / 'sessions.json'
        sessions_file.write_text(
            json.dumps(
                [
                    {
                        'id': 'abc123', 
                        'transcript': 'test'
                        }
                    ]
                )
            )
        
        with patch('dashboard_server.SESSIONS_FILE', sessions_file):
            from dashboard_server import app
            client = TestClient(app)
            
            response = client.get('/api/session/abc123')
            
            assert response.status_code == 200
            assert response.json()['id'] == 'abc123'
    
    def test_get_session_not_found(self, tmp_path):
        """GET /api/session/{id} возвращает 404"""
        sessions_file = tmp_path / 'sessions.json'
        sessions_file.write_text(json.dumps([]))
        
        with patch('dashboard_server.SESSIONS_FILE', sessions_file):
            from dashboard_server import app
            client = TestClient(app)
            
            response = client.get('/api/session/nonexistent')
            
            assert response.status_code == 404
    
    def test_export_metrics_empty(self, tmp_path):
        """GET /api/metrics/export без данных"""
        with patch('dashboard_server.METRICS_FILE', tmp_path / 'nonexistent.jsonl'):
            from dashboard_server import app
            client = TestClient(app)
            
            response = client.get('/api/metrics/export')
            
            assert response.status_code == 200
            assert response.json()['error'] == 'Нет данных'
    
    def test_export_metrics_with_data(self, tmp_path):
        """GET /api/metrics/export с данными"""
        metrics_file = tmp_path / 'metrics.jsonl'
        now = datetime.now().isoformat()
        metrics_file.write_text(
            json.dumps(
                {
                    'timestamp': now, 
                    'event': 'test', 
                    'latency_ms': 100
                    }
                ) + '\n'
            )
        
        with patch('dashboard_server.METRICS_FILE', metrics_file):
            from dashboard_server import app
            client = TestClient(app)
            
            response = client.get('/api/metrics/export')
            
            assert response.status_code == 200
            assert 'csv' in response.json()


class TestEnsureDataDir:
    """Тесты для ensure_data_dir"""
    
    def test_creates_dir(self, tmp_path):
        """Создаёт директорию"""
        data_dir = tmp_path / 'new_data'
        
        with patch('dashboard_server.DATA_DIR', data_dir):
            from dashboard_server import ensure_data_dir
            ensure_data_dir()
            
            assert data_dir.exists()
