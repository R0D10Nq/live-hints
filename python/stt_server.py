"""
STT Server с динамическим захватом аудио
Автоматически подхватывает изменения устройства по умолчанию
"""

import os
import sys
import asyncio
import json
import logging
import time
import threading
import queue
from typing import Optional

import numpy as np
import websockets

from stt import StreamingTranscriber
from dynamic_audio_capture import DynamicAudioCapture
from audio_mode_detector import get_audio_mode

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger('STT-Dynamic')

# Конфигурация
WEBSOCKET_HOST = 'localhost'
WEBSOCKET_PORT = 8765
SAMPLE_RATE = 16000


class DynamicSTTServer:
    """STT сервер с динамическим захватом аудио"""
    
    def __init__(self, mode='auto'):
        """
        Args:
            mode: 'loopback', 'microphone', или 'auto' для автоматического определения
        """
        if mode == 'auto':
            self.mode = get_audio_mode()
            logger.info(f'Auto-detected audio mode: {self.mode}')
        else:
            self.mode = mode
            
        self.transcriber: Optional[StreamingTranscriber] = None
        self.clients = set()
        self.audio_capture: Optional[DynamicAudioCapture] = None
        self.running = False
        
    def init_model(self):
        """Загрузка модели при старте сервера"""
        if self.transcriber is None:
            self.transcriber = StreamingTranscriber()
            logger.info(f'Model loaded: {self.transcriber.model_name}')
    
    def start_audio_capture(self):
        """Запустить захват аудио"""
        if self.audio_capture is None:
            self.audio_capture = DynamicAudioCapture(mode=self.mode)
            self.audio_capture.start()
            
            # Запускаем поток обработки аудио
            self.audio_thread = threading.Thread(target=self._audio_processing_loop, daemon=True)
            self.audio_thread.start()
            
            logger.info(f'Audio capture started (mode={self.mode})')
    
    def stop_audio_capture(self):
        """Остановить захват аудио"""
        if self.audio_capture:
            self.audio_capture.stop()
            self.audio_capture = None
            logger.info('Audio capture stopped')
    
    def _audio_processing_loop(self):
        """Поток обработки аудио"""
        while self.running:
            if self.audio_capture:
                chunk = self.audio_capture.get_audio_chunk(timeout=0.1)
                if chunk is not None and self.transcriber:
                    # Конвертируем в float32 для транскрибера
                    audio_float = chunk.astype(np.float32) / 32768.0
                    
                    if self.transcriber.add_audio(audio_float):
                        text = self.transcriber.transcribe()
                        if text and self.clients:
                            msg = json.dumps({
                                'type': 'transcript',
                                'text': text,
                                'source': self.mode,
                                'timestamp': time.time(),
                                'latency_ms': self.transcriber.metrics.get_latency_ms()
                            }, ensure_ascii=False)
                            
                            # Отправляем всем клиентам
                            asyncio.run_coroutine_threadsafe(
                                self._broadcast_to_clients(msg),
                                self.loop
                            )
            
            if not self.running:
                break
    
    async def _broadcast_to_clients(self, message: str):
        """Отправить сообщение всем клиентам"""
        if self.clients:
            await asyncio.gather(
                *[client.send(message) for client in self.clients],
                return_exceptions=True
            )
    
    async def handle_client(self, websocket, path=None):
        """Обработчик WebSocket клиента"""
        self.clients.add(websocket)
        logger.info(f'[WS] Client connected ({len(self.clients)})')
        
        # Отправляем статус
        await websocket.send(json.dumps({
            'type': 'status',
            'mode': self.mode,
            'message': f'STT server running in {self.mode} mode'
        }, ensure_ascii=False))
        
        try:
            async for message in websocket:
                # Обработка команд от клиента
                try:
                    data = json.loads(message)
                    if data.get('type') == 'get_status':
                        await websocket.send(json.dumps({
                            'type': 'status',
                            'mode': self.mode,
                            'clients': len(self.clients),
                            'model': self.transcriber.model_name if self.transcriber else None
                        }))
                except json.JSONDecodeError:
                    pass
                    
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.clients.remove(websocket)
            logger.info(f'[WS] Client disconnected ({len(self.clients)})')
    
    async def start_server(self):
        """Запустить сервер"""
        self.init_model()
        self.start_audio_capture()
        self.running = True
        
        # Сохраняем loop для использования из других потоков
        self.loop = asyncio.get_event_loop()
        
        logger.info(f'Starting STT server on {WEBSOCKET_HOST}:{WEBSOCKET_PORT}')
        
        async with websockets.serve(
            self.handle_client,
            WEBSOCKET_HOST,
            WEBSOCKET_PORT,
            ping_interval=20,
            ping_timeout=10
        ):
            logger.info(f'STT server ready (mode={self.mode})')
            await asyncio.Future()  # Бесконечный цикл
    
    async def stop_server(self):
        """Остановить сервер"""
        self.running = False
        self.stop_audio_capture()
        logger.info('STT server stopped')


async def main():
    """Главная функция"""
    import argparse
    
    parser = argparse.ArgumentParser(description='STT Server with Dynamic Audio Capture')
    parser.add_argument('--mode', choices=['loopback', 'microphone', 'auto'], default='auto',
                       help='Audio capture mode')
    parser.add_argument('--port', type=int, default=8765,
                       help='WebSocket port')
    
    args = parser.parse_args()
    
    # Создаём сервер
    server = DynamicSTTServer(mode=args.mode)
    
    try:
        await server.start_server()
    except KeyboardInterrupt:
        logger.info('Shutting down...')
        await server.stop_server()


if __name__ == '__main__':
    asyncio.run(main())
