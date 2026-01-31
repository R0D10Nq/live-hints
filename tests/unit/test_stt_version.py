"""
Проверяем версию STT сервера
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python'))

def check_stt_server():
    """Проверяем, что в stt_server.py есть динамический код"""
    try:
        with open('python/stt_server.py', 'r', encoding='utf-8') as f:
            content = f.read()
            
        if 'DynamicAudioCapture' in content:
            print("✓ В stt_server.py есть DynamicAudioCapture")
            if 'device_monitor' in content:
                print("✓ Подключен мониторинг устройств")
                if '--mode' in content and 'auto' in content:
                    print("✓ Поддерживается автоматический режим")
                    return True
                else:
                    print("✗ Нет автоматического режима")
            else:
                print("✗ Нет мониторинга устройств")
        else:
            print("✗ В stt_server.py старый код без DynamicAudioCapture")
            
        return False
        
    except Exception as e:
        print(f"Ошибка: {e}")
        return False

def check_running_server():
    """Проверяем, что сервер действительно перезапустился"""
    import subprocess
    import time
    
    # Пробуем подключиться и получить статус
    try:
        result = subprocess.run([
            'curl', '-s', 'ws://localhost:8765'
        ], capture_output=True, text=True, timeout=2)
        
        # curl не поддерживает websocket, но ошибка означает, что порт слушается
        if 'curl' not in result.stderr and 'Connection refused' not in result.stderr:
            print("✓ Сервер на порту 8765 отвечает")
            
    except:
        # Альтернатива - проверяем через netstat
        import subprocess
        result = subprocess.run([
            'netstat', '-ano', '|', 'findstr', ':8765'
        ], shell=True, capture_output=True, text=True)
        
        if 'LISTENING' in result.stdout:
            print("✓ Порт 8765 слушается")
        else:
            print("✗ Порт 8765 не слушается")

if __name__ == '__main__':
    print("=== ПРОВЕРКА ВЕРСИИ STT СЕРВЕРА ===\n")
    
    if check_stt_server():
        print("\n✓ Код сервера обновлен корректно")
        check_running_server()
    else:
        print("\n✗ Нужно пересобрать сервер:")
        print("1. Остановите приложение")
        print("2. Убедитесь, что python/stt_server.py содержит новый код")
        print("3. Запустите приложение заново")
