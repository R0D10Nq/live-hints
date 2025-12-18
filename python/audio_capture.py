<<<<<<< HEAD
"""
Audio Capture - Захват системного звука через WASAPI loopback
Отправляет PCM чанки на stdout для обработки в Electron
"""

import sys
import time
import logging
from threading import Thread, Event

import numpy as np

# Настройка логирования в stderr (stdout используется для данных)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stderr)]
)
logger = logging.getLogger('AudioCapture')

# Конфигурация
SAMPLE_RATE = 16000
CHANNELS = 1
CHUNK_SIZE = 1024
DTYPE = np.float32


def capture_wasapi_loopback():
    """
    Захват системного аудио через WASAPI loopback
    Использует pyaudiowpatch для Windows
    """
    try:
        import pyaudiowpatch as pyaudio
    except ImportError:
        logger.error('pyaudiowpatch не установлен. Установите: pip install pyaudiowpatch')
        sys.exit(1)
    
    p = pyaudio.PyAudio()
    
    # Ищем loopback устройство
    wasapi_info = None
    for i in range(p.get_device_count()):
        device_info = p.get_device_info_by_index(i)
        if device_info.get('isLoopbackDevice', False):
            wasapi_info = device_info
            break
    
    if wasapi_info is None:
        # Пробуем найти default loopback
        try:
            wasapi_info = p.get_default_wasapi_loopback()
        except Exception as e:
            logger.error(f'Не удалось найти loopback устройство: {e}')
            # Пробуем использовать стандартный output как loopback
            try:
                default_speakers = p.get_default_output_device_info()
                wasapi_info = p.get_device_info_by_index(default_speakers['index'])
                wasapi_info['isLoopbackDevice'] = True
            except Exception as e2:
                logger.error(f'Не удалось получить устройство вывода: {e2}')
                p.terminate()
                sys.exit(1)
    
    logger.info(f'Используем устройство: {wasapi_info["name"]}')
    logger.info(f'Частота: {wasapi_info["defaultSampleRate"]} Hz, Каналы: {wasapi_info["maxInputChannels"]}')
    
    # Открываем поток
    device_sample_rate = int(wasapi_info['defaultSampleRate'])
    device_channels = int(wasapi_info['maxInputChannels'])
    
    if device_channels < 1:
        device_channels = 2  # Стерео по умолчанию
    
    stop_event = Event()
    
    def audio_callback(in_data, frame_count, time_info, status):
        """Callback для обработки аудио"""
        if status:
            logger.warning(f'Статус: {status}')
        
        if in_data:
            # Конвертируем в numpy
            audio_data = np.frombuffer(in_data, dtype=np.float32)
            
            # Если стерео - конвертируем в моно
            if device_channels > 1:
                audio_data = audio_data.reshape(-1, device_channels)
                audio_data = np.mean(audio_data, axis=1)
            
            # Ресемплинг если нужно
            if device_sample_rate != SAMPLE_RATE:
                # Простой ресемплинг через интерполяцию
                ratio = SAMPLE_RATE / device_sample_rate
                new_length = int(len(audio_data) * ratio)
                indices = np.linspace(0, len(audio_data) - 1, new_length)
                audio_data = np.interp(indices, np.arange(len(audio_data)), audio_data)
            
            # Конвертируем в float32 и отправляем в stdout
            audio_data = audio_data.astype(np.float32)
            
            # Пишем только данные (без префикса длины)
            data_bytes = audio_data.tobytes()
            
            try:
                sys.stdout.buffer.write(data_bytes)
                sys.stdout.buffer.flush()
            except BrokenPipeError:
                stop_event.set()
                return (None, pyaudio.paComplete)
        
        return (None, pyaudio.paContinue)
    
    try:
        stream = p.open(
            format=pyaudio.paFloat32,
            channels=device_channels,
            rate=device_sample_rate,
            input=True,
            input_device_index=wasapi_info['index'],
            frames_per_buffer=CHUNK_SIZE,
            stream_callback=audio_callback
        )
        
        logger.info('Начинаю захват аудио...')
        stream.start_stream()
        
        # Ждём пока поток активен
        while stream.is_active() and not stop_event.is_set():
            time.sleep(0.1)
        
    except Exception as e:
        logger.error(f'Ошибка при захвате: {e}')
    finally:
        if 'stream' in locals():
            stream.stop_stream()
            stream.close()
        p.terminate()
        logger.info('Захват аудио остановлен')


def capture_fallback():
    """
    Fallback метод захвата через sounddevice
    """
    try:
        import sounddevice as sd
    except ImportError:
        logger.error('sounddevice не установлен')
        sys.exit(1)
    
    logger.info('Использую fallback метод через sounddevice')
    
    # Ищем loopback устройство
    devices = sd.query_devices()
    loopback_device = None
    
    for i, device in enumerate(devices):
        name = device['name'].lower()
        if 'loopback' in name or 'stereo mix' in name or 'what u hear' in name:
            loopback_device = i
            break
    
    if loopback_device is None:
        logger.warning('Loopback устройство не найдено, использую default input')
        loopback_device = sd.default.device[0]
    
    device_info = sd.query_devices(loopback_device)
    logger.info(f'Используем устройство: {device_info["name"]}')
    
    def callback(indata, frames, time_info, status):
        if status:
            logger.warning(f'Статус: {status}')
        
        # Конвертируем в моно если нужно
        audio_data = indata[:, 0] if indata.ndim > 1 else indata.flatten()
        audio_data = audio_data.astype(np.float32)
        
        data_bytes = audio_data.tobytes()
        
        try:
            sys.stdout.buffer.write(data_bytes)
            sys.stdout.buffer.flush()
        except BrokenPipeError:
            raise sd.CallbackAbort()
    
    try:
        with sd.InputStream(
            device=loopback_device,
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype='float32',
            blocksize=CHUNK_SIZE,
            callback=callback
        ):
            logger.info('Начинаю захват аудио (fallback)...')
            while True:
                time.sleep(0.1)
    except Exception as e:
        logger.error(f'Ошибка: {e}')


def main():
    """Главная функция"""
    logger.info('Запуск захвата системного аудио...')
    
    try:
        # Пробуем WASAPI loopback
        capture_wasapi_loopback()
    except Exception as e:
        logger.warning(f'WASAPI недоступен: {e}')
        logger.info('Переключаюсь на fallback метод...')
        capture_fallback()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        logger.info('Остановка по Ctrl+C')
        sys.exit(0)
=======
"""
Audio Capture - Захват системного звука через WASAPI loopback
Отправляет PCM чанки на stdout для обработки в Electron
"""

import sys
import time
import logging
from threading import Thread, Event

import numpy as np

# Настройка логирования в stderr (stdout используется для данных)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stderr)]
)
logger = logging.getLogger('AudioCapture')

# Конфигурация
SAMPLE_RATE = 16000
CHANNELS = 1
CHUNK_SIZE = 1024
DTYPE = np.float32


def capture_wasapi_loopback():
    """
    Захват системного аудио через WASAPI loopback
    Использует pyaudiowpatch для Windows
    """
    try:
        import pyaudiowpatch as pyaudio
    except ImportError:
        logger.error('pyaudiowpatch не установлен. Установите: pip install pyaudiowpatch')
        sys.exit(1)
    
    p = pyaudio.PyAudio()
    
    # Ищем loopback устройство
    wasapi_info = None
    for i in range(p.get_device_count()):
        device_info = p.get_device_info_by_index(i)
        if device_info.get('isLoopbackDevice', False):
            wasapi_info = device_info
            break
    
    if wasapi_info is None:
        # Пробуем найти default loopback
        try:
            wasapi_info = p.get_default_wasapi_loopback()
        except Exception as e:
            logger.error(f'Не удалось найти loopback устройство: {e}')
            # Пробуем использовать стандартный output как loopback
            try:
                default_speakers = p.get_default_output_device_info()
                wasapi_info = p.get_device_info_by_index(default_speakers['index'])
                wasapi_info['isLoopbackDevice'] = True
            except Exception as e2:
                logger.error(f'Не удалось получить устройство вывода: {e2}')
                p.terminate()
                sys.exit(1)
    
    logger.info(f'Используем устройство: {wasapi_info["name"]}')
    logger.info(f'Частота: {wasapi_info["defaultSampleRate"]} Hz, Каналы: {wasapi_info["maxInputChannels"]}')
    
    # Открываем поток
    device_sample_rate = int(wasapi_info['defaultSampleRate'])
    device_channels = int(wasapi_info['maxInputChannels'])
    
    if device_channels < 1:
        device_channels = 2  # Стерео по умолчанию
    
    stop_event = Event()
    
    def audio_callback(in_data, frame_count, time_info, status):
        """Callback для обработки аудио"""
        if status:
            logger.warning(f'Статус: {status}')
        
        if in_data:
            # Конвертируем в numpy
            audio_data = np.frombuffer(in_data, dtype=np.float32)
            
            # Если стерео - конвертируем в моно
            if device_channels > 1:
                audio_data = audio_data.reshape(-1, device_channels)
                audio_data = np.mean(audio_data, axis=1)
            
            # Ресемплинг если нужно
            if device_sample_rate != SAMPLE_RATE:
                # Простой ресемплинг через интерполяцию
                ratio = SAMPLE_RATE / device_sample_rate
                new_length = int(len(audio_data) * ratio)
                indices = np.linspace(0, len(audio_data) - 1, new_length)
                audio_data = np.interp(indices, np.arange(len(audio_data)), audio_data)
            
            # Конвертируем в float32 и отправляем в stdout
            audio_data = audio_data.astype(np.float32)
            
            # Пишем только данные (без префикса длины)
            data_bytes = audio_data.tobytes()
            
            try:
                sys.stdout.buffer.write(data_bytes)
                sys.stdout.buffer.flush()
            except BrokenPipeError:
                stop_event.set()
                return (None, pyaudio.paComplete)
        
        return (None, pyaudio.paContinue)
    
    try:
        stream = p.open(
            format=pyaudio.paFloat32,
            channels=device_channels,
            rate=device_sample_rate,
            input=True,
            input_device_index=wasapi_info['index'],
            frames_per_buffer=CHUNK_SIZE,
            stream_callback=audio_callback
        )
        
        logger.info('Начинаю захват аудио...')
        stream.start_stream()
        
        # Ждём пока поток активен
        while stream.is_active() and not stop_event.is_set():
            time.sleep(0.1)
        
    except Exception as e:
        logger.error(f'Ошибка при захвате: {e}')
    finally:
        if 'stream' in locals():
            stream.stop_stream()
            stream.close()
        p.terminate()
        logger.info('Захват аудио остановлен')


def capture_fallback():
    """
    Fallback метод захвата через sounddevice
    """
    try:
        import sounddevice as sd
    except ImportError:
        logger.error('sounddevice не установлен')
        sys.exit(1)
    
    logger.info('Использую fallback метод через sounddevice')
    
    # Ищем loopback устройство
    devices = sd.query_devices()
    loopback_device = None
    
    for i, device in enumerate(devices):
        name = device['name'].lower()
        if 'loopback' in name or 'stereo mix' in name or 'what u hear' in name:
            loopback_device = i
            break
    
    if loopback_device is None:
        logger.warning('Loopback устройство не найдено, использую default input')
        loopback_device = sd.default.device[0]
    
    device_info = sd.query_devices(loopback_device)
    logger.info(f'Используем устройство: {device_info["name"]}')
    
    def callback(indata, frames, time_info, status):
        if status:
            logger.warning(f'Статус: {status}')
        
        # Конвертируем в моно если нужно
        audio_data = indata[:, 0] if indata.ndim > 1 else indata.flatten()
        audio_data = audio_data.astype(np.float32)
        
        data_bytes = audio_data.tobytes()
        
        try:
            sys.stdout.buffer.write(data_bytes)
            sys.stdout.buffer.flush()
        except BrokenPipeError:
            raise sd.CallbackAbort()
    
    try:
        with sd.InputStream(
            device=loopback_device,
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype='float32',
            blocksize=CHUNK_SIZE,
            callback=callback
        ):
            logger.info('Начинаю захват аудио (fallback)...')
            while True:
                time.sleep(0.1)
    except Exception as e:
        logger.error(f'Ошибка: {e}')


def main():
    """Главная функция"""
    logger.info('Запуск захвата системного аудио...')
    
    try:
        # Пробуем WASAPI loopback
        capture_wasapi_loopback()
    except Exception as e:
        logger.warning(f'WASAPI недоступен: {e}')
        logger.info('Переключаюсь на fallback метод...')
        capture_fallback()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        logger.info('Остановка по Ctrl+C')
        sys.exit(0)
>>>>>>> 19b38e4 (Initial local commit)
