"""
Тесты для python/stt/latency.py
"""
import pytest
import time
from unittest.mock import patch


class TestLatencyMetrics:
    """Тесты для LatencyMetrics"""
    
    def test_init(self):
        """Инициализация сбрасывает метрики"""
        from stt.latency import LatencyMetrics
        
        metrics = LatencyMetrics()
        assert metrics.t_audio_first is None
        assert metrics.t_audio_last is None
        assert metrics.t_transcribe_start is None
        assert metrics.t_transcribe_done is None
    
    def test_reset(self):
        """Reset сбрасывает все метрики"""
        from stt.latency import LatencyMetrics
        
        metrics = LatencyMetrics()
        metrics.t_audio_first = 1.0
        metrics.t_audio_last = 2.0
        metrics.reset()
        
        assert metrics.t_audio_first is None
        assert metrics.t_audio_last is None
    
    def test_audio_received_first_call(self):
        """Первый вызов audio_received устанавливает t_audio_first"""
        from stt.latency import LatencyMetrics
        
        metrics = LatencyMetrics()
        metrics.audio_received()
        
        assert metrics.t_audio_first is not None
        assert metrics.t_audio_last is not None
        assert metrics.t_audio_first == metrics.t_audio_last
    
    def test_audio_received_subsequent_calls(self):
        """Последующие вызовы обновляют только t_audio_last"""
        from stt.latency import LatencyMetrics
        
        metrics = LatencyMetrics()
        metrics.audio_received()
        first = metrics.t_audio_first
        
        time.sleep(0.01)
        metrics.audio_received()
        
        assert metrics.t_audio_first == first
        assert metrics.t_audio_last > first
    
    def test_transcribe_started(self):
        """transcribe_started устанавливает время начала"""
        from stt.latency import LatencyMetrics
        
        metrics = LatencyMetrics()
        metrics.transcribe_started()
        
        assert metrics.t_transcribe_start is not None
    
    def test_transcribe_done(self):
        """transcribe_done устанавливает время окончания"""
        from stt.latency import LatencyMetrics
        
        metrics = LatencyMetrics()
        metrics.transcribe_done()
        
        assert metrics.t_transcribe_done is not None
    
    def test_get_latency_ms(self):
        """get_latency_ms возвращает латентность в мс"""
        from stt.latency import LatencyMetrics
        
        metrics = LatencyMetrics()
        metrics.audio_received()
        time.sleep(0.05)
        metrics.transcribe_done()
        
        latency = metrics.get_latency_ms()
        assert latency >= 40  # ~50ms
        assert latency < 200
    
    def test_get_latency_ms_no_data(self):
        """get_latency_ms возвращает 0 если нет данных"""
        from stt.latency import LatencyMetrics
        
        metrics = LatencyMetrics()
        assert metrics.get_latency_ms() == 0
    
    def test_get_stats(self):
        """get_stats возвращает словарь с метриками"""
        from stt.latency import LatencyMetrics
        
        metrics = LatencyMetrics()
        metrics.audio_received()
        time.sleep(0.02)
        metrics.audio_received()
        metrics.transcribe_started()
        time.sleep(0.01)
        metrics.transcribe_done()
        
        stats = metrics.get_stats()
        
        assert 'latency_ms' in stats
        assert 'audio_duration_ms' in stats
        assert 'transcribe_time_ms' in stats
        assert stats['audio_duration_ms'] >= 15
        assert stats['transcribe_time_ms'] >= 5
    
    def test_get_stats_no_data(self):
        """get_stats возвращает нули если нет данных"""
        from stt.latency import LatencyMetrics
        
        metrics = LatencyMetrics()
        stats = metrics.get_stats()
        
        assert stats['latency_ms'] == 0
        assert stats['audio_duration_ms'] == 0
        assert stats['transcribe_time_ms'] == 0


class TestFilterBannedPhrases:
    """Тесты для filter_banned_phrases"""
    
    def test_no_banned_phrases(self):
        """Текст без запрещённых фраз не изменяется"""
        from stt.latency import filter_banned_phrases
        
        text = "Привет, как дела?"
        result = filter_banned_phrases(text)
        assert result == text
    
    def test_filter_russian_phrase(self):
        """Фильтрует русские запрещённые фразы"""
        from stt.latency import filter_banned_phrases
        
        text = "Интересный вопрос. Продолжение следует..."
        result = filter_banned_phrases(text)
        assert 'продолжение следует' not in result.lower()
    
    def test_filter_english_phrase(self):
        """Фильтрует английские запрещённые фразы"""
        from stt.latency import filter_banned_phrases
        
        text = "This is interesting. To be continued..."
        result = filter_banned_phrases(text)
        assert 'to be continued' not in result.lower()
    
    def test_filter_case_insensitive(self):
        """Фильтрация регистронезависимая"""
        from stt.latency import filter_banned_phrases
        
        text = "ПРОДОЛЖЕНИЕ СЛЕДУЕТ"
        result = filter_banned_phrases(text)
        assert result == ""
    
    def test_filter_removes_extra_spaces(self):
        """После фильтрации убираются лишние пробелы"""
        from stt.latency import filter_banned_phrases
        
        text = "Начало  продолжение следует  конец"
        result = filter_banned_phrases(text)
        assert "  " not in result
    
    def test_filter_multiple_phrases(self):
        """Фильтрует несколько фраз"""
        from stt.latency import filter_banned_phrases
        
        text = "Продолжение. Continuation follows. To be continued."
        result = filter_banned_phrases(text)
        assert 'продолжение' not in result.lower()
        assert 'continuation' not in result.lower()
        assert 'continued' not in result.lower()
