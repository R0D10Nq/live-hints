"""
Отладочный запуск STT сервера
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python'))

if __name__ == '__main__':
    print("Starting STT server with debug...")
    print("Args:", sys.argv)
    
    # Импортируем и запускаем
    import stt_server
    import asyncio
    
    asyncio.run(stt_server.main())
