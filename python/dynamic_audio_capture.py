"""
Динамический захват аудио с автоматическим переключением устройств
"""

import logging
import threading
import time
from typing import Optional, Callable
import queue
import numpy as np

from device_monitor import AudioDeviceMonitor, get_device_monitor

logger = logging.getLogger('DynamicAudioCapture')


class DynamicAudioCapture:
    """Аудиозахват с автоматическим переключением устройств"""
    
    def __init__(self, mode='loopback', audio_queue: Optional[queue.Queue] = None):
        """
        Args:
            mode: 'loopback' для системного звука, 'microphone' для микрофона
            audio_queue: очередь для аудиоданных
        """
        self.mode = mode
        self.audio_queue = audio_queue or queue.Queue()
        self.running = False
        
        # Текущий захват
        self.current_capture_thread = None
        self.current_device_index = None
        self.should_restart = threading.Event()
        
        # Мониторинг устройств
        self.device_monitor = get_device_monitor()
        self.device_monitor.callback = self.on_device_changed
        
    def on_device_changed(self, device_index: int, device_info: dict):
        """Обработчик изменения устройства"""
        logger.info(f'Обнаружено изменение устройства: {device_info["name"]}')
        self.should_restart.set()
    
    def get_current_device(self):
        """Получить текущее устройство для захвата"""
        if self.mode == 'loopback':
            device_index, device_info = self.device_monitor.get_default_loopback_device()
        else:
            device_index, device_info = self.device_monitor.get_default_input_device()
            
        return device_index, device_info
    
    def capture_worker(self):
        """Рабочий поток захвата аудио"""
        while self.running:
            try:
                # Получаем текущее устройство
                device_index, device_info = self.get_current_device()
                
                if device_index is None:
                    logger.error('Устройство не найдено, ожидание...')
                    time.sleep(1)
                    continue
                
                # Если устройство изменилось, перезапускаем захват
                if (self.current_device_index != device_index or 
                    self.should_restart.is_set()):
                    
                    if self.current_capture_thread and self.current_capture_thread.is_alive():
                        logger.info('Остановка текущего захвата...')
                        # Останавливаем поток (устанавливаем флаг)
                        self.should_restart.clear()
                        time.sleep(0.5)  # Даём время на остановку
                    
                    self.current_device_index = device_index
                    logger.info(f'Начало захвата с устройства: {device_info["name"]}')
                    
                    # Создаём новый поток захвата
                    self.current_capture_thread = threading.Thread(
                        target=self._capture_with_device,
                        args=(device_index,),
                        daemon=True
                    )
                    self.current_capture_thread.start()
                
                # Проверяем, нужно ли перезапустить
                if self.should_restart.wait(timeout=0.1):
                    continue
                    
                time.sleep(0.1)
                
            except Exception as e:
                logger.error(f'Ошибка в capture_worker: {e}')
                time.sleep(1)
    
    def _capture_with_device(self, device_index: int):
        """Захват с указанного устройства"""
        try:
            if self.mode == 'loopback':
                # Для loopback используем capture_loopback с адаптером
                for chunk in self._loopback_generator(device_index):
                    if not self.running or self.should_restart.is_set():
                        break
                    self.audio_queue.put(chunk)
            else:
                # Для микрофона используем capture_microphone с адаптером
                for chunk in self._microphone_generator(device_index):
                    if not self.running or self.should_restart.is_set():
                        break
                    self.audio_queue.put(chunk)
                    
        except Exception as e:
            logger.error(f'Ошибка захвата с устройства {device_index}: {e}')
    
    def _loopback_generator(self, device_index: int):
        """Генератор для loopback захвата"""
        try:
            import pyaudiowpatch as pyaudio
            p = pyaudio.PyAudio()
            
            device_info = p.get_device_info_by_index(device_index)
            sample_rate = int(device_info['defaultSampleRate'])
            channels = 2  # Loopback обычно стерео
            
            stream = p.open(
                format=pyaudio.paInt16,
                channels=channels,
                rate=sample_rate,
                input=True,
                input_device_index=device_index,
                frames_per_buffer=1024
            )
            
            logger.info(f'Loopback захват запущен: {device_info["name"]}')
            
            while self.running and not self.should_restart.is_set():
                try:
                    data = stream.read(1024, exception_on_overflow=False)
                    audio_data = np.frombuffer(data, dtype=np.int16)
                    
                    # Конвертируем в моно если нужно
                    if channels > 1:
                        audio_data = audio_data.reshape(-1, channels)
                        audio_data = audio_data.mean(axis=1).astype(np.int16)
                    
                    # Ресемплируем в 16kHz если нужно
                    if sample_rate != 16000:
                        # Простая линейная интерполяция
                        audio_data = self._resample(audio_data, sample_rate, 16000)
                    
                    yield audio_data
                    
                except Exception as e:
                    logger.error(f'Ошибка чтения loopback: {e}')
                    break
            
            stream.stop_stream()
            stream.close()
            p.terminate()
            
        except Exception as e:
            logger.error(f'Ошибка в loopback генераторе: {e}')
    
    def _microphone_generator(self, device_index: int):
        """Генератор для захвата с микрофона"""
        try:
            import pyaudiowpatch as pyaudio
            p = pyaudio.PyAudio()
            
            device_info = p.get_device_info_by_index(device_index)
            sample_rate = int(device_info['defaultSampleRate'])
            channels = min(int(device_info['maxInputChannels']), 2)
            
            stream = p.open(
                format=pyaudio.paInt16,
                channels=channels,
                rate=sample_rate,
                input=True,
                input_device_index=device_index,
                frames_per_buffer=1024
            )
            
            logger.info(f'Захват микрофона запущен: {device_info["name"]}')
            
            while self.running and not self.should_restart.is_set():
                try:
                    data = stream.read(1024, exception_on_overflow=False)
                    audio_data = np.frombuffer(data, dtype=np.int16)
                    
                    # Конвертируем в моно если нужно
                    if channels > 1:
                        audio_data = audio_data.reshape(-1, channels)
                        audio_data = audio_data.mean(axis=1).astype(np.int16)
                    
                    # Ресемплируем в 16kHz если нужно
                    if sample_rate != 16000:
                        audio_data = self._resample(audio_data, sample_rate, 16000)
                    
                    yield audio_data
                    
                except Exception as e:
                    logger.error(f'Ошибка чтения микрофона: {e}')
                    break
            
            stream.stop_stream()
            stream.close()
            p.terminate()
            
        except Exception as e:
            logger.error(f'Ошибка в microphone генераторе: {e}')
    
    def _resample(self, audio_data: np.ndarray, from_rate: int, to_rate: int) -> np.ndarray:
        """Простой ресемплинг аудио"""
        if from_rate == to_rate:
            return audio_data
            
        # Вычисляем коэффициент
        ratio = to_rate / from_rate
        new_length = int(len(audio_data) * ratio)
        
        # Простая линейная интерполяция
        indices = np.linspace(0, len(audio_data) - 1, new_length)
        return np.interp(indices, np.arange(len(audio_data)), audio_data).astype(np.int16)
    
    def start(self):
        """Запустить захват аудио"""
        if self.running:
            logger.warning('Захват уже запущен')
            return
            
        self.running = True
        self.should_restart.clear()
        
        # Запускаем мониторинг устройств
        self.device_monitor.start_monitoring()
        
        # Запускаем рабочий поток
        self.capture_thread = threading.Thread(target=self.capture_worker, daemon=True)
        self.capture_thread.start()
        
        logger.info(f'Динамический захват аудио запущен (mode={self.mode})')
    
    def stop(self):
        """Остановить захват аудио"""
        self.running = False
        self.should_restart.set()
        
        # Останавливаем мониторинг
        self.device_monitor.stop_monitoring()
        
        # Ждём завершения потоков
        if hasattr(self, 'capture_thread'):
            self.capture_thread.join(timeout=2)
            
        logger.info('Динамический захват аудио остановлен')
    
    def get_audio_chunk(self, timeout: float = 0.1) -> Optional[np.ndarray]:
        """Получить чанк аудио из очереди"""
        try:
            return self.audio_queue.get(timeout=timeout)
        except queue.Empty:
            return None


# Тестирование
if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    
    print("Тест динамического захвата аудио...")
    print("Переключайте аудиоустройства для теста")
    
    capture = DynamicAudioCapture(mode='microphone')
    capture.start()
    
    try:
        chunk_count = 0
        while True:
            chunk = capture.get_audio_chunk()
            if chunk is not None:
                chunk_count += 1
                if chunk_count % 100 == 0:
                    print(f"Получено чанков: {chunk_count}")
    except KeyboardInterrupt:
        print("\nОстановка...")
        capture.stop()
