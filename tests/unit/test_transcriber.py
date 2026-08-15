"""
Модульные тесты для stt/transcriber.py
"""
import pytest
import numpy as np
from unittest.mock import MagicMock, patch

from stt.transcriber import (
    StreamingTranscriber,
    SAMPLE_RATE,
    MIN_CHUNK_SECONDS,
    MAX_BUFFER_SECONDS,
    SILENCE_THRESHOLD,
    SILENCE_TRIGGER_SEC,
)


class TestStreamingTranscriber:
    """Тесты компонента потоковой транскрипции"""

    @patch("stt.transcriber.WhisperModel")
    def test_init_success(self, mock_whisper):
        """Проверка успешной инициализации с GPU моделью"""
        mock_instance = MagicMock()
        mock_whisper.return_value = mock_instance

        transcriber = StreamingTranscriber()
        assert transcriber.model is not None
        assert transcriber.total_samples == 0
        assert len(transcriber.audio_buffer) == 0
        assert not transcriber.is_speaking

    @patch("stt.transcriber.WhisperModel")
    def test_add_audio_silence(self, mock_whisper):
        """Проверка добавления тишины (RMS ниже порога)"""
        mock_whisper.return_value = MagicMock()
        transcriber = StreamingTranscriber()

        # Тихий чанк (нули)
        silent_chunk = np.zeros(SAMPLE_RATE // 4, dtype=np.float32)
        should_transcribe = transcriber.add_audio(silent_chunk)

        assert not should_transcribe
        assert not transcriber.is_speaking
        assert transcriber.total_samples == len(silent_chunk)

    @patch("stt.transcriber.WhisperModel")
    def test_add_audio_speech_and_silence_trigger(self, mock_whisper):
        """Проверка детекции речи и срабатывания триггера тишины"""
        mock_whisper.return_value = MagicMock()
        transcriber = StreamingTranscriber()

        # Громкий чанк (речь)
        speech_chunk = np.ones(SAMPLE_RATE, dtype=np.float32) * 0.1
        transcriber.add_audio(speech_chunk)
        assert transcriber.is_speaking

        # Имитируем паузу после речи > SILENCE_TRIGGER_SEC
        transcriber.last_sound_time -= 1.0
        silent_chunk = np.zeros(SAMPLE_RATE // 4, dtype=np.float32)
        should_transcribe = transcriber.add_audio(silent_chunk)

        assert should_transcribe
        assert not transcriber.is_speaking

    @patch("stt.transcriber.WhisperModel")
    def test_add_audio_max_buffer_trigger(self, mock_whisper):
        """Проверка принудительной транскрипции при переполнении буфера"""
        mock_whisper.return_value = MagicMock()
        transcriber = StreamingTranscriber()

        large_chunk = np.ones(int(SAMPLE_RATE * (MAX_BUFFER_SECONDS + 0.1)), dtype=np.float32) * 0.05
        should_transcribe = transcriber.add_audio(large_chunk)

        assert should_transcribe

    @patch("stt.transcriber.WhisperModel")
    def test_transcribe_short_buffer(self, mock_whisper):
        """Транскрипция слишком короткого буфера возвращает None"""
        mock_whisper.return_value = MagicMock()
        transcriber = StreamingTranscriber()

        # Меньше MIN_CHUNK_SECONDS
        transcriber.total_samples = 100
        result = transcriber.transcribe()
        assert result is None

    @patch("stt.transcriber.WhisperModel")
    def test_transcribe_success(self, mock_whisper):
        """Успешная транскрипция сегментов"""
        mock_model = MagicMock()
        seg1 = MagicMock()
        seg1.text = "Привет мир"
        mock_model.transcribe.return_value = ([seg1], MagicMock())
        mock_whisper.return_value = mock_model

        transcriber = StreamingTranscriber()
        # Добавляем 1 секунду аудио
        chunk = np.ones(SAMPLE_RATE, dtype=np.float32) * 0.05
        transcriber.add_audio(chunk)

        result = transcriber.transcribe()
        assert result == "Привет мир"
        assert transcriber.total_samples == 0
        assert len(transcriber.audio_buffer) == 0

    @patch("stt.transcriber.WhisperModel")
    def test_clear(self, mock_whisper):
        """Проверка сброса состояния буфера"""
        mock_whisper.return_value = MagicMock()
        transcriber = StreamingTranscriber()

        transcriber.add_audio(np.ones(1000, dtype=np.float32) * 0.1)
        assert transcriber.total_samples > 0

        transcriber.clear()
        assert transcriber.total_samples == 0
        assert len(transcriber.audio_buffer) == 0
        assert not transcriber.is_speaking
