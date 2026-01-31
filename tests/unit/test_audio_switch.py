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
    """Подключаемся к STT и слушаем сообщения"""
    uri = "ws://localhost:8765"
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Подключено к STT серверу")
            
            # Получаем начальный статус
            response = await websocket.recv()
            data = json.loads(response)
            print(f"Статус сервера: {data}")
            
            # Запрашиваем детальный статус
            await websocket.send(json.dumps({"type": "get_status"}))
            response = await websocket.recv()
            data = json.loads(response)
            print(f"Детальный статус: {data}")
            
            print("\nТеперь переключите аудиоустройство (Монитор -> Наушники)")
            print("Ожидаю сообщения о переключении...")
            
            # Слушаем сообщения в течение 30 секунд
            start_time = time.time()
            while time.time() - start_time < 30:
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                    data = json.loads(message)
                    
                    if data.get('type') == 'transcript':
                        print(f"Транскрипт: {data.get('text', '')[:50]}...")
                    else:
                        print(f"Сообщение: {data}")
                        
                except asyncio.TimeoutError:
                    pass  # Нормально, просто ждем
                    
    except Exception as e:
        print(f"Ошибка: {e}")

if __name__ == '__main__':
    print("=== ТЕСТ ПЕРЕКЛЮЧЕНИЯ АУДИО ===")
    print("Убедитесь, что приложение запущено и транскрипция активна\n")
    asyncio.run(test_stt_connection())
