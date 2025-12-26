"""
STT Server - Streaming транскрипция с минимальной задержкой
GPU-only режим для RTX 5060 Ti 16GB
Рефакторинг: использует модули из stt/
"""

import os
import sys

# Добавляем пути к CUDA DLL
_site_packages = os.path.join(os.path.dirname(sys.executable), '..', 'Lib', 'site-packages')
_cuda_paths = [
    os.path.join(_site_packages, 'nvidia', 'cudnn', 'bin'),
    os.path.join(_site_packages, 'nvidia', 'cublas', 'bin'),
    os.path.join(_site_packages, 'nvidia', 'cuda_runtime', 'bin'),
]
for _path in _cuda_paths:
    if os.path.exists(_path):
        os.add_dll_directory(_path)
        os.environ['PATH'] = _path + os.pathsep + os.environ.get('PATH', '')

import asyncio
import json
import logging
import time
from typing import Optional

import numpy as np
import websockets

from stt import StreamingTranscriber

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger('STT')

# Конфигурация
WEBSOCKET_HOST = 'localhost'
WEBSOCKET_PORT = 8765
WEBSOCKET_PORT_MIC = 8764
SAMPLE_RATE = 16000


class STTServer:
    """WebSocket сервер для STT"""
    
    def __init__(self):
        self.transcriber: Optional[StreamingTranscriber] = None
        self.clients = set()
    
    def init_model(self):
        """Загрузка модели при старте сервера"""
        if self.transcriber is None:
            self.transcriber = StreamingTranscriber()
    
    async def handle_client(self, websocket, path=None, source='interviewer'):
        """Обработчик с указанием источника аудио"""
        if self.transcriber is None:
            self.init_model()
        
        self.clients.add(websocket)
        
        # Для микрофона создаём отдельный транскрибер
        if source == 'candidate':
            transcriber = StreamingTranscriber()
            transcriber.model = self.transcriber.model
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
    
    async def start(self):
        logger.info(f'[SERVER] Запуск ws://{WEBSOCKET_HOST}:{WEBSOCKET_PORT} (система)')
        logger.info(f'[SERVER] Запуск ws://{WEBSOCKET_HOST}:{WEBSOCKET_PORT_MIC} (микрофон)')
        
        self.init_model()
        model_name = getattr(self.transcriber, 'model_name', 'unknown')
        logger.info(f'[SERVER] Модель {model_name} готова')
        
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


async def main():
    server = STTServer()
    await server.start()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info('[SERVER] Остановлен')
