"""
Автоматическое определение режима аудио (loopback/microphone)
"""

import logging
import sys

try:
    import pyaudiowpatch as pyaudio
except ImportError:
    logging.error('pyaudiowpatch не установлен')
    sys.exit(1)

logger = logging.getLogger('AudioModeDetector')


def get_audio_mode() -> str:
    """
    Определяет режим аудио на основе активного устройства
    Returns:
        'loopback' - если активно системное устройство (WASAPI Loopback)
        'microphone' - если активно микрофонное устройство
    """
    try:
        p = pyaudio.PyAudio()
        
        # Получаем информацию об устройстве по умолчанию
        try:
            # Проверяем устройство вывода по умолчанию (для loopback)
            default_output = p.get_default_output_device_info()
            logger.info(f'Default output device: {default_output["name"]}')
            
            # Ищем WASAPI loopback для этого устройства
            for i in range(p.get_device_count()):
                info = p.get_device_info_by_index(i)
                
                # WASAPI loopback устройства обычно содержат имя устройства вывода
                if (info.get('isLoopbackDevice', False) and 
                    default_output['name'] in info['name']):
                    
                    logger.info(f'Found loopback device: {info["name"]}')
                    p.terminate()
                    return 'loopback'
            
            # Если loopback не найден, проверяем микрофон по умолчанию
            default_input = p.get_default_input_device_info()
            logger.info(f'Default input device: {default_input["name"]}')
            
            # Если устройство ввода - это не loopback, используем микрофон
            if not default_input.get('isLoopbackDevice', False):
                logger.info('Using microphone mode')
                p.terminate()
                return 'microphone'
                
        except Exception as e:
            logger.error(f'Error getting default device: {e}')
        
        # Fallback - проверяем первое доступное устройство
        for i in range(p.get_device_count()):
            info = p.get_device_info_by_index(i)
            if info.get('isLoopbackDevice', False):
                logger.info(f'Fallback: found loopback device {info["name"]}')
                p.terminate()
                return 'loopback'
            elif info['maxInputChannels'] > 0:
                logger.info(f'Fallback: found microphone {info["name"]}')
                p.terminate()
                return 'microphone'
        
        p.terminate()
        logger.warning('No audio devices found, defaulting to loopback')
        return 'loopback'
        
    except Exception as e:
        logger.error(f'Error detecting audio mode: {e}')
        return 'loopback'  # Безопасный режим по умолчанию


def list_audio_devices():
    """Выводит список всех аудиоустройств с их типами"""
    try:
        p = pyaudio.PyAudio()
        
        print("\n=== АУДИОУСТРОЙСТВА ===")
        print("\nLoopback устройства (системный звук):")
        print("-" * 50)
        
        loopback_devices = []
        mic_devices = []
        
        for i in range(p.get_device_count()):
            info = p.get_device_info_by_index(i)
            
            if info.get('isLoopbackDevice', False):
                loopback_devices.append((i, info))
                print(f"  [{i}] {info['name']}")
                print(f"      Каналов: {info['maxInputChannels']}, Частота: {info['defaultSampleRate']}")
            elif info['maxInputChannels'] > 0:
                mic_devices.append((i, info))
        
        print("\nМикрофоны:")
        print("-" * 50)
        for i, info in mic_devices:
            print(f"  [{i}] {info['name']}")
            print(f"      Каналов: {info['maxInputChannels']}, Частота: {info['defaultSampleRate']}")
        
        print("\nУстройства вывода:")
        print("-" * 50)
        for i in range(p.get_device_count()):
            info = p.get_device_info_by_index(i)
            if info['maxOutputChannels'] > 0:
                print(f"  [{i}] {info['name']}")
                print(f"      Каналов: {info['maxOutputChannels']}, Частота: {info['defaultSampleRate']}")
        
        p.terminate()
        
        return loopback_devices, mic_devices
        
    except Exception as e:
        logger.error(f'Error listing devices: {e}')
        return [], []


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    
    print("Определение режима аудио...")
    mode = get_audio_mode()
    print(f"\nРекомендуемый режим: {mode}")
    
    print("\n" + "="*50)
    list_audio_devices()
