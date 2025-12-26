"""
Тесты для python/metrics.py
"""
import pytest
import json
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock


class TestMetricEvent:
    """Тесты для MetricEvent dataclass"""
    
    def test_to_dict(self):
        """to_dict возвращает словарь"""
        from metrics import MetricEvent
        
        event = MetricEvent(
            timestamp='2024-01-01T00:00:00',
            event_type='test',
            component='unit',
            data={
                'key': 'value'
                }
        )
        
        result = event.to_dict()
        
        assert result['timestamp'] == '2024-01-01T00:00:00'
        assert result['event_type'] == 'test'
        assert result['component'] == 'unit'
        assert result['data'] == {'key': 'value'}


class TestLogMetric:
    """Тесты для log_metric"""
    
    def test_log_metric_creates_file(self, tmp_path):
        """log_metric создаёт файл если не существует"""
        with patch('metrics.METRICS_DIR', tmp_path):
            with patch('metrics.METRICS_FILE', tmp_path / 'metrics.jsonl'):
                from metrics import log_metric
                
                log_metric('test_event', 'test_component', value=42)
                
                assert (tmp_path / 'metrics.jsonl').exists()
    
    def test_log_metric_appends_jsonl(self, tmp_path):
        """log_metric добавляет JSON строку"""
        metrics_file = tmp_path / 'metrics.jsonl'
        
        with patch('metrics.METRICS_DIR', tmp_path):
            with patch('metrics.METRICS_FILE', metrics_file):
                from metrics import log_metric
                
                log_metric('event1', 'comp1', x=1)
                log_metric('event2', 'comp2', y=2)
                
                lines = metrics_file.read_text().strip().split('\n')
                assert len(lines) == 2
                
                data1 = json.loads(lines[0])
                assert data1['event_type'] == 'event1'
                assert data1['data']['x'] == 1


class TestLogSttTranscription:
    """Тесты для log_stt_transcription"""
    
    def test_logs_transcription(self, tmp_path):
        """Логирует транскрипцию с RTF"""
        metrics_file = tmp_path / 'metrics.jsonl'
        
        with patch('metrics.METRICS_DIR', tmp_path):
            with patch('metrics.METRICS_FILE', metrics_file):
                from metrics import log_stt_transcription
                
                log_stt_transcription(
                    text='Hello world',
                    latency_ms=500,
                    audio_duration_sec=2.0,
                    model='large-v3'
                )
                
                data = json.loads(metrics_file.read_text().strip())
                assert data['event_type'] == 'transcription'
                assert data['component'] == 'stt'
                assert data['data']['text_length'] == 11
                assert data['data']['latency_ms'] == 500
                assert data['data']['rtf'] == 0.25
    
    def test_rtf_zero_duration(self, tmp_path):
        """RTF = 0 если audio_duration = 0"""
        metrics_file = tmp_path / 'metrics.jsonl'
        
        with patch('metrics.METRICS_DIR', tmp_path):
            with patch('metrics.METRICS_FILE', metrics_file):
                from metrics import log_stt_transcription
                
                log_stt_transcription(text='test', latency_ms=100, audio_duration_sec=0)
                
                data = json.loads(metrics_file.read_text().strip())
                assert data['data']['rtf'] == 0


class TestLogLlmRequest:
    """Тесты для log_llm_request"""
    
    def test_logs_request(self, tmp_path):
        """Логирует LLM запрос"""
        metrics_file = tmp_path / 'metrics.jsonl'
        
        with patch('metrics.METRICS_DIR', tmp_path):
            with patch('metrics.METRICS_FILE', metrics_file):
                from metrics import log_llm_request
                
                log_llm_request(
                    text='What is Python?',
                    context_size=5,
                    question_type='technical',
                    profile='interview'
                )
                
                data = json.loads(metrics_file.read_text().strip())
                assert data['event_type'] == 'hint_request'
                assert data['component'] == 'llm'
                assert data['data']['question_type'] == 'technical'


class TestLogLlmResponse:
    """Тесты для log_llm_response"""
    
    def test_logs_response(self, tmp_path):
        """Логирует LLM ответ"""
        metrics_file = tmp_path / 'metrics.jsonl'
        
        with patch('metrics.METRICS_DIR', tmp_path):
            with patch('metrics.METRICS_FILE', metrics_file):
                from metrics import log_llm_response
                
                log_llm_response(
                    ttft_ms=2000,
                    total_ms=5000,
                    hint_length=150,
                    cached=False,
                    question_type='experience'
                )
                
                data = json.loads(metrics_file.read_text().strip())
                assert data['event_type'] == 'hint_response'
                assert data['data']['ttft_ms'] == 2000
                assert data['data']['cached'] is False


class TestLogCacheHit:
    """Тесты для log_cache_hit"""
    
    def test_logs_cache_hit(self, tmp_path):
        """Логирует попадание в кэш"""
        metrics_file = tmp_path / 'metrics.jsonl'
        
        with patch('metrics.METRICS_DIR', tmp_path):
            with patch('metrics.METRICS_FILE', metrics_file):
                from metrics import log_cache_hit
                
                log_cache_hit(text='cached query', similarity=0.95)
                
                data = json.loads(metrics_file.read_text().strip())
                assert data['event_type'] == 'cache_hit'
                assert data['data']['similarity'] == 0.95


class TestLogError:
    """Тесты для log_error"""
    
    def test_logs_error(self, tmp_path):
        """Логирует ошибку"""
        metrics_file = tmp_path / 'metrics.jsonl'
        
        with patch('metrics.METRICS_DIR', tmp_path):
            with patch('metrics.METRICS_FILE', metrics_file):
                from metrics import log_error
                
                log_error('llm', 'ConnectionError', 'Failed to connect')
                
                data = json.loads(metrics_file.read_text().strip())
                assert data['event_type'] == 'error'
                assert data['data']['error_type'] == 'ConnectionError'
    
    def test_truncates_long_message(self, tmp_path):
        """Обрезает длинные сообщения"""
        metrics_file = tmp_path / 'metrics.jsonl'
        
        with patch('metrics.METRICS_DIR', tmp_path):
            with patch('metrics.METRICS_FILE', metrics_file):
                from metrics import log_error
                
                long_message = 'x' * 1000
                log_error('stt', 'Error', long_message)
                
                data = json.loads(metrics_file.read_text().strip())
                assert len(data['data']['message']) == 500


class TestGetMetricsStats:
    """Тесты для get_metrics_stats"""
    
    def test_file_not_found(self, tmp_path):
        """Возвращает ошибку если файл не существует"""
        with patch('metrics.METRICS_FILE', tmp_path / 'nonexistent.jsonl'):
            from metrics import get_metrics_stats
            
            result = get_metrics_stats()
            assert 'error' in result
    
    def test_empty_file(self, tmp_path):
        """Возвращает ошибку если файл пустой"""
        metrics_file = tmp_path / 'metrics.jsonl'
        metrics_file.write_text('')
        
        with patch('metrics.METRICS_FILE', metrics_file):
            from metrics import get_metrics_stats
            
            result = get_metrics_stats()
            assert 'error' in result
    
    def test_calculates_stats(self, tmp_path):
        """Вычисляет статистику по метрикам"""
        metrics_file = tmp_path / 'metrics.jsonl'
        
        events = [
            {
                'timestamp': '2024-01-01T00:00:00', 
                'event_type': 'transcription', 
                'component': 'stt', 
                'data': {
                    'latency_ms': 100
                    }
                },
            {
                'timestamp': '2024-01-01T00:00:01', 
                'event_type': 'transcription', 
                'component': 'stt', 
                'data': {
                    'latency_ms': 200
                    }
                },
            {
                'timestamp': '2024-01-01T00:00:02', 
                'event_type': 'hint_response', 
                'component': 'llm', 
                'data': {
                    'ttft_ms': 2000, 
                    'total_ms': 5000, 
                    'cached': False
                    }
                },
            {
                'timestamp': '2024-01-01T00:00:03', 
                'event_type': 'hint_response', 
                'component': 'llm', 
                'data': {
                    'ttft_ms': 0, 
                    'total_ms': 10, 
                    'cached': True
                    }
                },
            {
                'timestamp': '2024-01-01T00:00:04', 
                'event_type': 'hint_request', 
                'component': 'llm', 
                'data': {
                    'question_type': 'technical'
                    }
                },
        ]
        metrics_file.write_text('\n'.join(json.dumps(e) for e in events))
        
        with patch('metrics.METRICS_FILE', metrics_file):
            from metrics import get_metrics_stats
            
            result = get_metrics_stats()
            
            assert result['total_events'] == 5
            assert result['stt']['transcriptions'] == 2
            assert result['stt']['latency_ms']['avg'] == 150
            assert result['llm']['requests'] == 2
            assert result['llm']['cache_hits'] == 1
            assert result['question_types']['technical'] == 1
    
    def test_handles_invalid_json(self, tmp_path):
        """Пропускает невалидный JSON"""
        metrics_file = tmp_path / 'metrics.jsonl'
        metrics_file.write_text('invalid json\n{"timestamp": "2024", "event_type": "test", "component": "x", "data": {}}\n')
        
        with patch('metrics.METRICS_FILE', metrics_file):
            from metrics import get_metrics_stats
            
            result = get_metrics_stats()
            assert result['total_events'] == 1


class TestClearMetrics:
    """Тесты для clear_metrics"""
    
    def test_clears_file(self, tmp_path):
        """Удаляет файл метрик"""
        metrics_file = tmp_path / 'metrics.jsonl'
        metrics_file.write_text('some data')
        
        with patch('metrics.METRICS_FILE', metrics_file):
            from metrics import clear_metrics
            
            clear_metrics()
            
            assert not metrics_file.exists()
    
    def test_no_error_if_not_exists(self, tmp_path):
        """Не падает если файл не существует"""
        with patch('metrics.METRICS_FILE', tmp_path / 'nonexistent.jsonl'):
            from metrics import clear_metrics
            
            clear_metrics()  # Не должно бросать исключение
