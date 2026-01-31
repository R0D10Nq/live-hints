"""
Финальный тест исправления аудио
"""

import sys
import os
# Добавляем путь к python модулям
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python'))

def test_import():
    """Тест импорта модулей"""
    try:
        from device_monitor import AudioDeviceMonitor
        from dynamic_audio_capture import DynamicAudioCapture
        from audio_mode_detector import get_audio_mode
        print("✓ Все модули импортируются успешно")
        return True
    except Exception as e:
        print(f"✗ Ошибка импорта: {e}")
        return False

def test_audio_mode():
    """Тест определения режима"""
    try:
        from audio_mode_detector import get_audio_mode
        mode = get_audio_mode()
        print(f"✓ Текущий режим: {mode}")
        return True
    except Exception as e:
        print(f"✗ Ошибка определения режима: {e}")
        return False

def test_stt_server():
    """Тест STT сервера"""
    try:
        # Проверяем, что файл существует и может быть импортирован
        import stt_server
        print("✓ STT сервер может быть импортирован")
        return True
    except Exception as e:
        print(f"✗ Ошибка STT сервера: {e}")
        return False

if __name__ == '__main__':
    print("=== ФИНАЛЬНЫЙ ТЕСТ ИСПРАВЛЕНИЯ АУДИО ===\n")
    
    all_ok = True
    all_ok &= test_import()
    all_ok &= test_audio_mode()
    all_ok &= test_stt_server()
    
    print("\n" + "="*50)
    if all_ok:
        print("✓ ВСЕ ТЕСТЫ ПРОЙДЕНЫ!")
        print("\nИНСТРУКЦИЯ:")
        print("1. Перезапустите приложение")
        print("2. В консоли должно быть: STT-Dynamic: Auto-detected audio mode")
        print("3. Запустите транскрипцию")
        print("4. Переключите звук - должно работать!")
    else:
        print("✗ Есть ошибки - нужно исправить")
