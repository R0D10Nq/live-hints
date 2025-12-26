"""
Audio Capture - Захват аудио через WASAPI
Поддерживает два режима:
  - loopback: системный звук (интервьюер)
  - microphone: микрофон (кандидат)

Использование:
  python audio_capture.py --mode=loopback
  python audio_capture.py --mode=microphone --device-index=1
"""

import sys
import time
import logging
import argparse
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


def parse_args():
    """Парсинг аргументов командной строки"""
    parser = argparse.ArgumentParser(description='Audio Capture для Live Hints')
    parser.add_argument('--mode', choices=['loopback', 'microphone'], default='loopback',
                        help='Режим захвата: loopback (системный звук) или microphone')
    parser.add_argument('--device-index', type=int, default=None,
                        help='Индекс устройства (для microphone режима)')
    parser.add_argument('--list-devices', action='store_true',
                        help='Показать список устройств и выйти')
    return parser.parse_args()


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


def capture_microphone(device_index=None):
    """
    Захват аудио с микрофона через pyaudiowpatch
    """
    try:
        import pyaudiowpatch as pyaudio
    except ImportError:
        logger.error('pyaudiowpatch не установлен')
        sys.exit(1)
    
    p = pyaudio.PyAudio()
    
    # Определяем устройство
    if device_index is not None:
        try:
            mic_info = p.get_device_info_by_index(device_index)
            logger.info(f'Используем указанный микрофон: {mic_info["name"]}')
        except Exception as e:
            logger.error(f'Устройство с индексом {device_index} не найдено: {e}')
            p.terminate()
            sys.exit(1)
    else:
        # Ищем default input device
        try:
            mic_info = p.get_default_input_device_info()
            logger.info(f'Используем микрофон по умолчанию: {mic_info["name"]}')
        except Exception as e:
            logger.error(f'Не удалось найти микрофон: {e}')
            p.terminate()
            sys.exit(1)
    
    logger.info(f'Частота: {mic_info["defaultSampleRate"]} Hz, Каналы: {mic_info["maxInputChannels"]}')
    
    device_sample_rate = int(mic_info['defaultSampleRate'])
    device_channels = int(mic_info['maxInputChannels'])
    
    if device_channels < 1:
        device_channels = 1
    
    stop_event = Event()
    
    def audio_callback(in_data, frame_count, time_info, status):
        if status:
            logger.warning(f'Статус: {status}')
        
        if in_data:
            audio_data = np.frombuffer(in_data, dtype=np.float32)
            
            # Если стерео - конвертируем в моно
            if device_channels > 1:
                audio_data = audio_data.reshape(-1, device_channels)
                audio_data = np.mean(audio_data, axis=1)
            
            # Ресемплинг если нужно
            if device_sample_rate != SAMPLE_RATE:
                ratio = SAMPLE_RATE / device_sample_rate
                new_length = int(len(audio_data) * ratio)
                indices = np.linspace(0, len(audio_data) - 1, new_length)
                audio_data = np.interp(indices, np.arange(len(audio_data)), audio_data)
            
            audio_data = audio_data.astype(np.float32)
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
            input_device_index=mic_info['index'],
            frames_per_buffer=CHUNK_SIZE,
            stream_callback=audio_callback
        )
        
        logger.info('Начинаю захват с микрофона...')
        stream.start_stream()
        
        while stream.is_active() and not stop_event.is_set():
            time.sleep(0.1)
        
    except Exception as e:
        logger.error(f'Ошибка при захвате микрофона: {e}')
    finally:
        if 'stream' in locals():
            stream.stop_stream()
            stream.close()
        p.terminate()
        logger.info('Захват микрофона остановлен')


def list_audio_devices():
    """Вывод списка аудио устройств"""
    try:
        import pyaudiowpatch as pyaudio
    except ImportError:
        logger.error('pyaudiowpatch не установлен')
        sys.exit(1)
    
    p = pyaudio.PyAudio()
    
    print('\n=== АУДИО УСТРОЙСТВА ===\n', file=sys.stderr)
    print('INPUT (микрофоны):', file=sys.stderr)
    print('-' * 50, file=sys.stderr)
    
    for i in range(p.get_device_count()):
        info = p.get_device_info_by_index(i)
        if info['maxInputChannels'] > 0:
            is_loopback = info.get('isLoopbackDevice', False)
            marker = ' [LOOPBACK]' if is_loopback else ''
            print(f"  [{i}] {info['name']}{marker}", file=sys.stderr)
            print(f"      Каналы: {info['maxInputChannels']}, Частота: {info['defaultSampleRate']} Hz", file=sys.stderr)
    
    print('\nOUTPUT (динамики):', file=sys.stderr)
    print('-' * 50, file=sys.stderr)
    
    for i in range(p.get_device_count()):
        info = p.get_device_info_by_index(i)
        if info['maxOutputChannels'] > 0:
            print(f"  [{i}] {info['name']}", file=sys.stderr)
    
    p.terminate()


def capture_fallback(mode='loopback', device_index=None):
    """
    Fallback метод захвата через sounddevice
    """
    try:
        import sounddevice as sd
    except ImportError:
        logger.error('sounddevice не установлен')
        sys.exit(1)
    
    logger.info(f'Использую fallback метод через sounddevice (mode={mode})')
    
    if mode == 'loopback':
        # Ищем loopback устройство
        devices = sd.query_devices()
        target_device = None
        
        for i, device in enumerate(devices):
            name = device['name'].lower()
            if 'loopback' in name or 'stereo mix' in name or 'what u hear' in name:
                target_device = i
                break
        
        if target_device is None:
            logger.warning('Loopback устройство не найдено, использую default input')
            target_device = sd.default.device[0]
    else:
        # Микрофон
        target_device = device_index if device_index is not None else sd.default.device[0]
    
    device_info = sd.query_devices(target_device)
    logger.info(f'Используем устройство: {device_info["name"]}')
    
    def callback(indata, frames, time_info, status):
        if status:
            logger.warning(f'Статус: {status}')
        
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
            device=target_device,
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype='float32',
            blocksize=CHUNK_SIZE,
            callback=callback
        ):
            logger.info(f'Начинаю захват аудио (fallback, {mode})...')
            while True:
                time.sleep(0.1)
    except Exception as e:
        logger.error(f'Ошибка: {e}')


def main():
    """Главная функция с поддержкой режимов"""
    args = parse_args()
    
    # Список устройств
    if args.list_devices:
        list_audio_devices()
        sys.exit(0)
    
    mode = args.mode
    device_index = args.device_index
    
    logger.info(f'Запуск захвата аудио (mode={mode}, device={device_index})...')
    
    try:
        if mode == 'loopback':
            capture_wasapi_loopback()
        else:
            capture_microphone(device_index)
    except Exception as e:
        logger.warning(f'WASAPI недоступен: {e}')
        logger.info('Переключаюсь на fallback метод...')
        capture_fallback(mode, device_index)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        logger.info('Остановка по Ctrl+C')
        sys.exit(0)
