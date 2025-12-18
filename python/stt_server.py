"""
STT Server - Streaming транскрипция с минимальной задержкой
GPU-only режим для RTX 5060 Ti 16GB
"""

import asyncio
import json
import logging
import sys
import time
from typing import Optional

import numpy as np
import websockets
from faster_whisper import WhisperModel

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger('STT')

# ========== КОНФИГУРАЦИЯ ==========
WEBSOCKET_HOST = 'localhost'
WEBSOCKET_PORT = 8765
SAMPLE_RATE = 16000

# GPU настройки - RTX 5060 Ti 16GB
# Приоритет моделей: small (быстрый старт) -> medium -> large-v3
# small уже скачана, medium/large-v3 скачиваются при необходимости
MODEL_PRIORITY = ['small', 'medium', 'large-v3']
DEVICE = 'cuda'
COMPUTE_TYPE = 'float16'

# Streaming параметры - минимальная задержка
MIN_CHUNK_SECONDS = 0.5   # Минимальный чанк для транскрипции
MAX_BUFFER_SECONDS = 5.0  # Максимальный буфер
SILENCE_THRESHOLD = 0.01  # RMS порог тишины
SILENCE_TRIGGER_MS = 400  # мс тишины для запуска транскрипции


# ========== МЕТРИКИ ==========
class LatencyMetrics:
    """Измерение задержек"""
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


# ========== STREAMING TRANSCRIBER ==========
class StreamingTranscriber:
    """Streaming STT с минимальной задержкой"""
    
    def __init__(self):
        self.model = None
        self.device_used = None
        self._load_model()
        
        # Аудио буфер
        self.audio_buffer = []
        self.total_samples = 0
        
        # Tracking
        self.last_sound_time = time.time()
        self.is_speaking = False
        
        # Метрики
        self.metrics = LatencyMetrics()
    
    def _load_model(self):
        """Загрузка модели - ТОЛЬКО GPU, с fallback на меньшие модели"""
        last_error = None
        
        for model_name in MODEL_PRIORITY:
            logger.info(f'[GPU] Загрузка {model_name} на {DEVICE}...')
            
            try:
                self.model = WhisperModel(
                    model_name,
                    device=DEVICE,
                    compute_type=COMPUTE_TYPE
                )
                self.device_used = DEVICE
                self.model_name = model_name
                logger.info(f'[GPU] Модель {model_name} загружена: device={DEVICE}, compute={COMPUTE_TYPE}')
                return
            except Exception as e:
                last_error = e
                logger.warning(f'[GPU] Не удалось загрузить {model_name}: {e}')
                continue
        
        logger.error('[GPU] Все модели недоступны. Проверьте: cuDNN, CUDA 12.x, nvidia-cudnn-cu12')
        raise RuntimeError(f'GPU недоступен: {last_error}')
    
    def add_audio(self, audio_chunk: np.ndarray) -> bool:
        """Добавляет аудио, возвращает True если нужна транскрипция"""
        self.metrics.audio_received()
        
        # Вычисляем RMS (громкость)
        rms = np.sqrt(np.mean(audio_chunk ** 2)) if len(audio_chunk) > 0 else 0
        
        # Определяем есть ли звук
        has_sound = rms > SILENCE_THRESHOLD
        
        if has_sound:
            self.last_sound_time = time.time()
            self.is_speaking = True
        
        # Добавляем в буфер только если есть звук или недавно был
        silence_duration = time.time() - self.last_sound_time
        
        if has_sound or silence_duration < 1.0:
            self.audio_buffer.append(audio_chunk)
            self.total_samples += len(audio_chunk)
        
        # Условия для транскрипции
        buffer_duration = self.total_samples / SAMPLE_RATE
        silence_ms = silence_duration * 1000
        
        should_transcribe = False
        
        # Условие 1: Пауза после речи
        if self.is_speaking and silence_ms >= SILENCE_TRIGGER_MS and buffer_duration >= MIN_CHUNK_SECONDS:
            should_transcribe = True
            self.is_speaking = False
        
        # Условие 2: Буфер переполнен
        if buffer_duration >= MAX_BUFFER_SECONDS:
            should_transcribe = True
        
        return should_transcribe
    
    def transcribe(self) -> Optional[str]:
        """Транскрибирует буфер"""
        if self.total_samples < int(SAMPLE_RATE * MIN_CHUNK_SECONDS):
            return None
        
        self.metrics.transcribe_started()
        
        try:
            # Собираем аудио
            audio = np.concatenate(self.audio_buffer).astype(np.float32)
            duration = len(audio) / SAMPLE_RATE
            
            logger.info(f'[STT] Транскрипция {duration:.1f}с...')
            
            # Транскрипция - оптимизировано для скорости
            segments, info = self.model.transcribe(
                audio,
                language='ru',
                beam_size=1,        # Минимум для скорости
                best_of=1,
                temperature=0.0,
                vad_filter=False,   # Отключен - сами фильтруем
                condition_on_previous_text=False,
                no_speech_threshold=0.5
            )
            
            # Собираем текст
            text_parts = []
            for seg in segments:
                t = seg.text.strip()
                if t and len(t) > 1:
                    text_parts.append(t)
            
            result = ' '.join(text_parts)
            
            # Очищаем буфер
            self.audio_buffer = []
            self.total_samples = 0
            
            self.metrics.transcribe_done()
            
            if result:
                stats = self.metrics.get_stats()
                logger.info(f'[STT] "{result}" (latency: {stats["latency_ms"]}ms, transcribe: {stats["transcribe_time_ms"]}ms)')
                self.metrics.reset()
                return result
            
            return None
            
        except Exception as e:
            logger.error(f'[STT] Ошибка: {e}')
            self.audio_buffer = []
            self.total_samples = 0
            return None
    
    def clear(self):
        """Очистка буфера"""
        self.audio_buffer = []
        self.total_samples = 0
        self.is_speaking = False
        self.metrics.reset()


# ========== WEBSOCKET SERVER ==========
class STTServer:
    def __init__(self):
        self.transcriber: Optional[StreamingTranscriber] = None
        self.clients = set()
    
    def init_model(self):
        """Загрузка модели при старте сервера"""
        if self.transcriber is None:
            self.transcriber = StreamingTranscriber()
    
    async def handle_client(self, websocket, path=None):
        # Модель уже загружена при старте
        if self.transcriber is None:
            self.init_model()
        
        self.clients.add(websocket)
        self.transcriber.clear()
        
        logger.info(f'[WS] Клиент подключен ({len(self.clients)})')
        
        chunk_count = 0
        
        try:
            async for message in websocket:
                if isinstance(message, bytes):
                    audio = np.frombuffer(message, dtype=np.float32)
                    chunk_count += 1
                    
                    # Логируем каждые 100 чанков
                    if chunk_count % 100 == 0:
                        buf_sec = self.transcriber.total_samples / SAMPLE_RATE
                        logger.info(f'[WS] chunks={chunk_count}, buffer={buf_sec:.1f}s')
                    
                    # Добавляем и проверяем
                    if self.transcriber.add_audio(audio):
                        text = self.transcriber.transcribe()
                        if text:
                            msg = json.dumps({
                                'type': 'transcript',
                                'text': text,
                                'timestamp': time.time(),
                                'latency_ms': self.transcriber.metrics.get_latency_ms()
                            }, ensure_ascii=False)
                            await websocket.send(msg)
                
                elif isinstance(message, str):
                    try:
                        cmd = json.loads(message)
                        if cmd.get('command') == 'clear':
                            self.transcriber.clear()
                    except json.JSONDecodeError:
                        pass
        
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.clients.discard(websocket)
            logger.info(f'[WS] Клиент отключён ({len(self.clients)})')
    
    async def start(self):
        logger.info(f'[SERVER] Запуск ws://{WEBSOCKET_HOST}:{WEBSOCKET_PORT}')
        logger.info(f'[SERVER] GPU: {DEVICE}, Модели: {MODEL_PRIORITY}, Compute: {COMPUTE_TYPE}')
        
        # Загружаем модель СРАЗУ при старте (не при подключении клиента)
        self.init_model()
        model_name = getattr(self.transcriber, 'model_name', 'unknown')
        logger.info(f'[SERVER] Модель {model_name} готова, ожидание клиентов...')
        
        async with websockets.serve(
            self.handle_client,
            WEBSOCKET_HOST,
            WEBSOCKET_PORT,
            max_size=10 * 1024 * 1024
        ):
            await asyncio.Future()


async def main():
    server = STTServer()
    await server.start()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info('[SERVER] Остановлен')