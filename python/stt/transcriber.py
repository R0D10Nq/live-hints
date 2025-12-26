"""
STT Transcriber - Streaming транскрипция с Whisper
"""

import logging
import time
from typing import Optional

import numpy as np
from faster_whisper import WhisperModel

from .latency import LatencyMetrics, filter_banned_phrases
from metrics import log_stt_transcription, log_error

logger = logging.getLogger('STT')

# Конфигурация
SAMPLE_RATE = 16000
MODEL_PRIORITY = ['distil-large-v3', 'large-v3-turbo', 'large-v3', 'medium']
DEVICE = 'cuda'
COMPUTE_TYPE = 'float16'

# Streaming параметры
MIN_CHUNK_SECONDS = 0.25
MAX_BUFFER_SECONDS = 4.0
SILENCE_THRESHOLD = 0.015
SILENCE_TRIGGER_SEC = 0.8


class StreamingTranscriber:
    """Streaming STT - весь текст подряд, пауза 5+ сек = новое сообщение"""
    
    def __init__(self):
        self.model = None
        self.model_name = None
        self.device_used = None
        self._load_model()
        
        self.audio_buffer = []
        self.total_samples = 0
        self.last_sound_time = time.time()
        self.is_speaking = False
        self.metrics = LatencyMetrics()
    
    def _load_model(self):
        """Загрузка модели - ТОЛЬКО GPU"""
        last_error = None
        
        for model_name in MODEL_PRIORITY:
            logger.info(f'[GPU] Загрузка {model_name} на {DEVICE}...')
            
            try:
                self.model = WhisperModel(model_name, device=DEVICE, compute_type=COMPUTE_TYPE)
                self.device_used = DEVICE
                self.model_name = model_name
                logger.info(f'[GPU] Модель {model_name} загружена')
                return
            except Exception as e:
                last_error = e
                logger.warning(f'[GPU] Не удалось загрузить {model_name}: {e}')
                continue
        
        logger.error('[GPU] Все модели недоступны')
        raise RuntimeError(f'GPU недоступен: {last_error}')
    
    def add_audio(self, audio_chunk: np.ndarray) -> bool:
        """Добавляет аудио, возвращает True если нужна транскрипция"""
        self.metrics.audio_received()
        
        rms = np.sqrt(np.mean(audio_chunk ** 2)) if len(audio_chunk) > 0 else 0
        has_sound = rms > SILENCE_THRESHOLD
        
        if has_sound:
            self.last_sound_time = time.time()
            self.is_speaking = True
        
        silence_duration = time.time() - self.last_sound_time
        
        if has_sound or silence_duration < 2.0:
            self.audio_buffer.append(audio_chunk)
            self.total_samples += len(audio_chunk)
        
        buffer_duration = self.total_samples / SAMPLE_RATE
        should_transcribe = False
        
        if self.is_speaking and silence_duration >= SILENCE_TRIGGER_SEC and buffer_duration >= MIN_CHUNK_SECONDS:
            should_transcribe = True
            self.is_speaking = False
        
        if buffer_duration >= MAX_BUFFER_SECONDS:
            should_transcribe = True
        
        return should_transcribe
    
    def transcribe(self) -> Optional[str]:
        """Транскрибирует буфер"""
        if self.total_samples < int(SAMPLE_RATE * MIN_CHUNK_SECONDS):
            return None
        
        self.metrics.transcribe_started()
        
        try:
            audio = np.concatenate(self.audio_buffer).astype(np.float32)
            duration = len(audio) / SAMPLE_RATE
            
            logger.info(f'[STT] Транскрипция {duration:.1f}с...')
            
            segments, info = self.model.transcribe(
                audio,
                language='ru',
                beam_size=1,
                best_of=1,
                temperature=0.0,
                vad_filter=True,
                condition_on_previous_text=False,
                no_speech_threshold=0.6,
                compression_ratio_threshold=2.4,
                initial_prompt=None,
            )
            
            text_parts = []
            for seg in segments:
                t = seg.text.strip()
                if t and len(t) > 1:
                    text_parts.append(t)
            
            result = ' '.join(text_parts)
            result = filter_banned_phrases(result)
            
            audio_duration = self.total_samples / SAMPLE_RATE if self.total_samples > 0 else 0
            
            self.audio_buffer = []
            self.total_samples = 0
            self.metrics.transcribe_done()
            
            if result:
                stats = self.metrics.get_stats()
                logger.info(f'[STT] "{result}" (latency: {stats["latency_ms"]}ms)')
                
                log_stt_transcription(
                    text=result,
                    latency_ms=stats["latency_ms"],
                    audio_duration_sec=audio_duration,
                    model=self.model_name or 'large-v3'
                )
                
                self.metrics.reset()
                return result
            
            return None
            
        except Exception as e:
            logger.error(f'[STT] Ошибка: {e}')
            log_error('stt', 'transcription_error', str(e))
            self.audio_buffer = []
            self.total_samples = 0
            return None
    
    def clear(self):
        """Очистка буфера"""
        self.audio_buffer = []
        self.total_samples = 0
        self.is_speaking = False
        self.metrics.reset()
