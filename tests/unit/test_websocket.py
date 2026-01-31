"""
Простой тест WebSocket подключения
"""

import asyncio
import websockets
import json
import pytest

@pytest.mark.asyncio
async def test():
    try:
        async with websockets.connect("ws://localhost:8765") as ws:
            print("Connected to STT server")
            
            # Получаем первое сообщение
            msg = await ws.recv()
            data = json.loads(msg)
            print(f"Status: {data}")
            
            # Запрашиваем статус
            await ws.send(json.dumps({"type": "get_status"}))
            msg = await ws.recv()
            data = json.loads(msg)
            print(f"Details: {data}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    asyncio.run(test())
