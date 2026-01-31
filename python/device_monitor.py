"""
Мониторинг аудиоустройств и автоматическое переключение
"""

import logging
import time
import threading
from typing import Optional, Callable
import sys

try:
    import pyaudiowpatch as pyaudio
except ImportError:
    logging.error('pyaudiowpatch не установлен')
    sys.exit(1)

logger = logging.getLogger('DeviceMonitor')


class AudioDeviceMonitor:
    """Мониторинг изменений аудиоустройств по умолчанию"""
    
    def __init__(self, callback: Optional[Callable] = None, check_interval: float = 1.0):
        """
        Args:
            callback: функция, вызываемая при изменении устройства (device_index, device_info)
            check_interval: интервал проверки в секундах
        """
        self.callback = callback
        self.check_interval = check_interval
        self.running = False
        self.thread = None
        
        # Текущее устройство
        self.current_device_index = None
        self.current_device_info = None
        
        # pyaudio экземпляр
        self.p = None
        
    def get_default_input_device(self):
        """Получить устройство ввода по умолчанию"""
        try:
            if not self.p:
                self.p = pyaudio.PyAudio()
                
            device_info = self.p.get_default_input_device_info()
            device_index = device_info['index']
            
            return device_index, device_info
        except Exception as e:
            logger.error(f'Ошибка получения устройства по умолчанию: {e}')
            return None, None
    
    def get_default_loopback_device(self):
        """Получить loopback устройство по умолчанию (для системного звука)"""
        try:
            if not self.p:
                self.p = pyaudio.PyAudio()
                
            # Ищем WASAPI loopback устройство по умолчанию
            default_wasapi_info = None
            for i in range(self.p.get_device_count()):
                info = self.p.get_device_info_by_index(i)
                if (info['name'].startswith('Microsoft Sound Mapper - Input') or 
                    info['name'].startswith('Default') or
                    (info['isLoopbackDevice'] and 'default' in info['name'].lower())):
                    default_wasapi_info = info
                    break
            
            if default_wasapi_info:
                return default_wasapi_info['index'], default_wasapi_info
            
            # Если не нашли, возвращаем первое loopback устройство
            for i in range(self.p.get_device_count()):
                info = self.p.get_device_info_by_index(i)
                if info['isLoopbackDevice']:
                    return info['index'], info
                    
        except Exception as e:
            logger.error(f'Ошибка получения loopback устройства: {e}')
            
        return None, None
    
    def check_device_change(self):
        """Проверить, изменилось ли устройство"""
        # Пока реализуем только для микрофона
        new_index, new_info = self.get_default_input_device()
        
        if new_index is None:
            return False
            
        if (self.current_device_index != new_index or 
            self.current_device_info is None or
            self.current_device_info['name'] != new_info['name']):
            
            old_name = self.current_device_info['name'] if self.current_device_info else 'None'
            new_name = new_info['name']
            
            logger.info(f'Изменение устройства: "{old_name}" -> "{new_name}"')
            
            self.current_device_index = new_index
            self.current_device_info = new_info
            
            if self.callback:
                self.callback(new_index, new_info)
                
            return True
            
        return False
    
    def start_monitoring(self):
        """Начать мониторинг устройств"""
        if self.running:
            logger.warning('Мониторинг уже запущен')
            return
            
        self.running = True
        
        # Инициализируем текущее устройство
        self.current_device_index, self.current_device_info = self.get_default_input_device()
        
        if self.current_device_info:
            logger.info(f'Начальное устройство: {self.current_device_info["name"]}')
        
        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()
        logger.info('Мониторинг аудиоустройств запущен')
    
    def stop_monitoring(self):
        """Остановить мониторинг"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)
        if self.p:
            self.p.terminate()
            self.p = None
        logger.info('Мониторинг аудиоустройств остановлен')
    
    def _monitor_loop(self):
        """Основной цикл мониторинга"""
        while self.running:
            try:
                self.check_device_change()
                time.sleep(self.check_interval)
            except Exception as e:
                logger.error(f'Ошибка в цикле мониторинга: {e}')
                time.sleep(self.check_interval)


# Глобальный экземпляр для использования в приложении
_device_monitor = None


def get_device_monitor() -> AudioDeviceMonitor:
    """Получить глобальный экземпляр монитора"""
    global _device_monitor
    if _device_monitor is None:
        _device_monitor = AudioDeviceMonitor()
    return _device_monitor


def start_device_monitoring(callback: Optional[Callable] = None):
    """Запустить мониторинг устройств"""
    monitor = get_device_monitor()
    if callback:
        monitor.callback = callback
    monitor.start_monitoring()


def stop_device_monitoring():
    """Остановить мониторинг устройств"""
    monitor = get_device_monitor()
    monitor.stop_monitoring()


if __name__ == '__main__':
    # Тест мониторинга
    logging.basicConfig(level=logging.INFO)
    
    def device_changed(device_index, device_info):
        print(f'Устройство изменено: {device_info["name"]} (индекс: {device_index})')
    
    print("Запуск мониторинга аудиоустройств...")
    print("Переключите аудиоустройство для теста")
    
    monitor = AudioDeviceMonitor(callback=device_changed)
    monitor.start_monitoring()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nОстановка мониторинга...")
        monitor.stop_monitoring()
