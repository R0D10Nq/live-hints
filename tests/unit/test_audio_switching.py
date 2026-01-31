"""
Тест переключения аудиоустройств
"""

import sys
import os
# Добавляем путь к python модулям
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python'))

import asyncio
import websockets
import json
import time
import pytest


@pytest.mark.asyncio
async def test_stt_connection():
    """Тест соединения с STT сервером"""
    uri = "ws://localhost:8765"
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✓ Подключено к STT серверу")
            
            # Получаем статус
            response = await websocket.recv()
            data = json.loads(response)
            print(f"Статус: {data}")
            
            # Отправляем запрос статуса
            await websocket.send(json.dumps({"type": "get_status"}))
            response = await websocket.recv()
            data = json.loads(response)
            print(f"Детальный статус: {data}")
            
            print("\nСервер работает! Переключайте аудиоустройства и проверяйте логи.")
            
    except Exception as e:
        print(f"✗ Ошибка подключения: {e}")
        print("Убедитесь, что STT сервер запущен: python stt_server_dynamic.py")


def test_audio_mode_detection():
    """Тест определения режима аудио"""
    from audio_mode_detector import get_audio_mode, list_audio_devices
    
    print("\n=== ТЕСТ ОПРЕДЕЛЕНИЯ РЕЖИМА АУДИО ===\n")
    
    # Показываем все устройства
    list_audio_devices()
    
    # Определяем режим
    mode = get_audio_mode()
    print(f"\nАвтоматически определённый режим: {mode}")
    
    print("\nИНСТРУКЦИЯ:")
    print("1. Запустите STT сервер: python stt_server_dynamic.py")
    print("2. Переключите аудио с Монитора на Наушники")
    print("3. Сервер должен автоматически подхватить новое устройство")
    print("4. Проверьте логи: должно появиться сообщение о переключении")


if __name__ == '__main__':
    print("=== ТЕСТ ПЕРЕКЛЮЧЕНИЯ АУДИОУСТРОЙСТВ ===\n")
    
    # Сначала тестируем определение режима
    test_audio_mode_detection()
    
    print("\n" + "="*50)
    
    # Затем тестируем соединение с сервером
    print("\nТест соединения с STT сервером...")
    asyncio.run(test_stt_connection())
