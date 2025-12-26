"""
STT Latency - метрики и фильтрация
"""

import logging
import re
import time

logger = logging.getLogger('STT')

# Стоп-фразы которые нужно фильтровать
BANNED_PHRASES = [
    'продолжение следует',
    'continuation follows',
    'to be continued',
    'продолжение',
    'Субтитры сделал DimaTorzok',
]


class LatencyMetrics:
    """Измерение задержек STT"""
    
    def __init__(self):
        self.reset()
    
    def reset(self):
        self.t_audio_first = None
        self.t_audio_last = None
        self.t_transcribe_start = None
        self.t_transcribe_done = None
    
    def audio_received(self):
        now = time.time()
        if self.t_audio_first is None:
            self.t_audio_first = now
        self.t_audio_last = now
    
    def transcribe_started(self):
        self.t_transcribe_start = time.time()
    
    def transcribe_done(self):
        self.t_transcribe_done = time.time()
    
    def get_latency_ms(self) -> int:
        if self.t_audio_last and self.t_transcribe_done:
            return int((self.t_transcribe_done - self.t_audio_last) * 1000)
        return 0
    
    def get_stats(self) -> dict:
        return {
            'latency_ms': self.get_latency_ms(),
            'audio_duration_ms': int((self.t_audio_last - self.t_audio_first) * 1000) if self.t_audio_first and self.t_audio_last else 0,
            'transcribe_time_ms': int((self.t_transcribe_done - self.t_transcribe_start) * 1000) if self.t_transcribe_start and self.t_transcribe_done else 0
        }


def filter_banned_phrases(text: str) -> str:
    """Фильтрует запрещённые фразы из текста"""
    text_lower = text.lower()
    
    for phrase in BANNED_PHRASES:
        if phrase.lower() in text_lower:
            logger.warning(f'[FILTER] Найдена запрещённая фраза: "{phrase}"')
            pattern = re.compile(re.escape(phrase), re.IGNORECASE)
            text = pattern.sub('', text)
            text = ' '.join(text.split())
    
    return text.strip()
