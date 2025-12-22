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
from metrics import log_stt_transcription, log_error

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
WEBSOCKET_PORT_MIC = 8764  # Порт для микрофона
SAMPLE_RATE = 16000

# GPU настройки - RTX 5060 Ti 16GB
MODEL_PRIORITY = ['whisper-large-v3-russian', 'large-v3', 'medium', 'small']  # distil-large-v3 только для английского
DEVICE = 'cuda'
COMPUTE_TYPE = 'float16'

# Streaming параметры - оптимизировано для низкой латентности
MIN_CHUNK_SECONDS = 0.3   # Минимальный чанк для транскрипции (было 0.5)
MAX_BUFFER_SECONDS = 5.0  # Максимальный буфер (было 8 сек)
SILENCE_THRESHOLD = 0.01  # RMS порог тишины
SILENCE_TRIGGER_SEC = 1.0 # Пауза для запуска транскрипции (было 1.5 сек)

# Стоп-фразы которые нужно фильтровать
BANNED_PHRASES = [
    'продолжение следует',
    'continuation follows',
    'to be continued',
    'продолжение',
]


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


def filter_banned_phrases(text: str) -> str:
    """
    Фильтрует запрещённые фразы из текста
    """
    text_lower = text.lower()
    
    for phrase in BANNED_PHRASES:
        # Проверяем точное вхождение (как отдельное слово/фразу)
        if phrase.lower() in text_lower:
            logger.warning(f'[FILTER] Найдена запрещённая фраза: "{phrase}" в тексте: "{text}"')
            # Удаляем фразу (case-insensitive)
            import re
            pattern = re.compile(re.escape(phrase), re.IGNORECASE)
            text = pattern.sub('', text)
            # Очищаем лишние пробелы
            text = ' '.join(text.split())
    
    return text.strip()


# ========== STREAMING TRANSCRIBER ==========
class StreamingTranscriber:
    """Streaming STT - весь текст подряд, пауза 5+ сек = новое сообщение"""
    
    def __init__(self):
        self.model = None
        self.device_used = None
        self._load_model()
        
        # Аудио буфер
        self.audio_buffer = []
        self.total_samples = 0
        
        # Tracking тишины
        self.last_sound_time = time.time()
        self.is_speaking = False
        
        # Метрики
        self.metrics = LatencyMetrics()
    
    def _load_model(self):
        """Загрузка модели - ТОЛЬКО GPU"""
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
        """
        Добавляет аудио, возвращает True если нужна транскрипция
        Транскрипция запускается при паузе 1.5 сек
        """
        self.metrics.audio_received()
        
        # Вычисляем RMS (громкость)
        rms = np.sqrt(np.mean(audio_chunk ** 2)) if len(audio_chunk) > 0 else 0
        has_sound = rms > SILENCE_THRESHOLD
        
        if has_sound:
            self.last_sound_time = time.time()
            self.is_speaking = True
        
        # Добавляем в буфер
        silence_duration = time.time() - self.last_sound_time
        
        if has_sound or silence_duration < 2.0:
            self.audio_buffer.append(audio_chunk)
            self.total_samples += len(audio_chunk)
        
        buffer_duration = self.total_samples / SAMPLE_RATE
        
        # Условия для транскрипции
        should_transcribe = False
        
        # Пауза 1.5 сек
        if self.is_speaking and silence_duration >= SILENCE_TRIGGER_SEC and buffer_duration >= MIN_CHUNK_SECONDS:
            should_transcribe = True
            self.is_speaking = False
        
        # Переполнение буфера
        if buffer_duration >= MAX_BUFFER_SECONDS:
            should_transcribe = True
        
        return should_transcribe
    
    def transcribe(self) -> Optional[str]:
        """Транскрибирует буфер и отправляет ВСЁ"""
        if self.total_samples < int(SAMPLE_RATE * MIN_CHUNK_SECONDS):
            return None
        
        self.metrics.transcribe_started()
        
        try:
            # Собираем аудио
            audio = np.concatenate(self.audio_buffer).astype(np.float32)
            duration = len(audio) / SAMPLE_RATE
            
            logger.info(f'[STT] Транскрипция {duration:.1f}с...')
            
            # Транскрипция с параметрами против "Продолжение следует"
            segments, info = self.model.transcribe(
                audio,
                language='ru',
                beam_size=1,
                best_of=1,
                temperature=0.0,
                vad_filter=True,  # ВКЛЮЧИЛ VAD для лучшего определения границ
                condition_on_previous_text=False,  # ВАЖНО: отключает контекст предыдущего текста
                no_speech_threshold=0.6,  # Порог "нет речи" — увеличил
                compression_ratio_threshold=2.4,  # Порог сжатия — стандарт
                initial_prompt=None,  # Без начального промпта
            )
            
            # Собираем текст
            text_parts = []
            for seg in segments:
                t = seg.text.strip()
                if t and len(t) > 1:
                    text_parts.append(t)
            
            result = ' '.join(text_parts)
            
            # ФИЛЬТРУЕМ ЗАПРЕЩЁННЫЕ ФРАЗЫ
            result = filter_banned_phrases(result)
            
            # Сохраняем длительность до очистки
            audio_duration = self.total_samples / SAMPLE_RATE if self.total_samples > 0 else 0
            
            # Очищаем буфер
            self.audio_buffer = []
            self.total_samples = 0
            
            self.metrics.transcribe_done()
            
            if result:
                stats = self.metrics.get_stats()
                logger.info(f'[STT] "{result}" (latency: {stats["latency_ms"]}ms, transcribe: {stats["transcribe_time_ms"]}ms)')
                
                # Логируем метрику
                log_stt_transcription(
                    text=result,
                    latency_ms=stats["latency_ms"],
                    audio_duration_sec=audio_duration,
                    model=self.model_name if hasattr(self, 'model_name') else 'large-v3'
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
                    
                    # Проверяем нужна ли транскрипция
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
        logger.info(f'[SERVER] Запуск ws://{WEBSOCKET_HOST}:{WEBSOCKET_PORT} (система)')
        logger.info(f'[SERVER] Запуск ws://{WEBSOCKET_HOST}:{WEBSOCKET_PORT_MIC} (микрофон)')
        logger.info(f'[SERVER] Пауза для транскрипции: {SILENCE_TRIGGER_SEC}s')
        
        self.init_model()
        model_name = getattr(self.transcriber, 'model_name', 'unknown')
        logger.info(f'[SERVER] Модель {model_name} готова, ожидание клиентов...')
        
        # Запускаем оба сервера параллельно
        async with websockets.serve(
            lambda ws: self.handle_client(ws, source='interviewer'),
            WEBSOCKET_HOST,
            WEBSOCKET_PORT,
            max_size=10 * 1024 * 1024
        ):
            async with websockets.serve(
                lambda ws: self.handle_client(ws, source='candidate'),
                WEBSOCKET_HOST,
                WEBSOCKET_PORT_MIC,
                max_size=10 * 1024 * 1024
            ):
                await asyncio.Future()

    async def handle_client(self, websocket, path=None, source='interviewer'):
        """Обработчик с указанием источника аудио"""
        if self.transcriber is None:
            self.init_model()
        
        self.clients.add(websocket)
        
        # Для микрофона создаём отдельный транскрибер
        if source == 'candidate':
            transcriber = StreamingTranscriber()
            transcriber.model = self.transcriber.model  # Переиспользуем модель
        else:
            transcriber = self.transcriber
            transcriber.clear()
        
        logger.info(f'[WS] Клиент подключен: {source} ({len(self.clients)})')
        
        chunk_count = 0
        
        try:
            async for message in websocket:
                if isinstance(message, bytes):
                    audio = np.frombuffer(message, dtype=np.float32)
                    chunk_count += 1
                    
                    if chunk_count % 100 == 0:
                        buf_sec = transcriber.total_samples / SAMPLE_RATE
                        logger.info(f'[WS:{source}] chunks={chunk_count}, buffer={buf_sec:.1f}s')
                    
                    if transcriber.add_audio(audio):
                        text = transcriber.transcribe()
                        if text:
                            msg = json.dumps({
                                'type': 'transcript',
                                'text': text,
                                'source': source,
                                'timestamp': time.time(),
                                'latency_ms': transcriber.metrics.get_latency_ms()
                            }, ensure_ascii=False)
                            await websocket.send(msg)
                
                elif isinstance(message, str):
                    try:
                        cmd = json.loads(message)
                        if cmd.get('command') == 'clear':
                            transcriber.clear()
                    except json.JSONDecodeError:
                        pass
        
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.clients.discard(websocket)
            logger.info(f'[WS:{source}] Клиент отключён ({len(self.clients)})')


async def main():
    server = STTServer()
    await server.start()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info('[SERVER] Остановлен')
