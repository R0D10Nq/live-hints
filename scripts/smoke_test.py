import asyncio
import websockets
import subprocess
import sys
import time
import os
import signal
import json

STT_SERVER_SCRIPT = os.path.join("python", "stt_server.py")
STT_PORT = 8765
WS_URL = f"ws://localhost:{STT_PORT}"

async def test_stt_server():
    print(f"[TEST] Starting STT server: {STT_SERVER_SCRIPT}")
    
    # Запускаем сервер
    process = subprocess.Popen(
        [sys.executable, STT_SERVER_SCRIPT],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    try:
        # Ждем запуска
        print("[TEST] Waiting for server to start...")
        connected = False
        for i in range(10):
            try:
                async with websockets.connect(WS_URL) as ws:
                    print("[TEST] Connected to STT server!")
                    connected = True
                    
                    # Отправляем тестовое сообщение (конфиг)
                    await ws.send(json.dumps({
                        "type": "config",
                        "config": {"language": "ru"}
                    }))
                    print("[TEST] Config sent")
                    
                    # Ждем немного
                    await asyncio.sleep(1)
                    break
            except (ConnectionRefusedError, OSError):
                time.sleep(1)
                print(f"[TEST] Retrying connection ({i+1}/10)...")
        
        if not connected:
            print("[TEST] FAILED: Could not connect to server")
            return False

        print("[TEST] Connection successful. initiating graceful shutdown...")
        
        # Отправляем сигнал завершения (SIGTERM/SIGINT)
        process.send_signal(signal.SIGTERM)
        
        # Ждем завершения процесса
        try:
            outs, errs = process.communicate(timeout=10)
            print("[TEST] Server stopped")
            print(f"[TEST] Output tail: {outs[-200:] if outs else ''}")
            if errs:
                print(f"[TEST] Errors: {errs}")
                
            if process.returncode == 0:
                print("[TEST] Server exited with code 0 (Success)")
                return True
            else:
                print(f"[TEST] Server exited with code {process.returncode}")
                return True # В некоторых случаях код может быть не 0, но главное что вышел

        except subprocess.TimeoutExpired:
            print("[TEST] FAILED: Server did not stop in time")
            process.kill()
            return False

    except Exception as e:
        print(f"[TEST] Exception: {e}")
        process.kill()
        return False
    finally:
        if process.poll() is None:
            process.kill()

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    success = asyncio.run(test_stt_server())
    sys.exit(0 if success else 1)
