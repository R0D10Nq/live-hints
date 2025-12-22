"""
Microphone Capture - Захват аудио с микрофона
Отправляет PCM чанки на WebSocket для транскрипции
"""

import sys
import time
import logging
import asyncio
import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stderr)]
)
logger = logging.getLogger('MicCapture')

SAMPLE_RATE = 16000
CHANNELS = 1
CHUNK_SIZE = 1024
WS_URL = 'ws://localhost:8764'


class MicrophoneCapture:
    def __init__(self, device_index=None):
        self.device_index = device_index
        self.stream = None
        self.p = None
        self.running = False
        self.ws = None
        self.muted = False
    
    def list_devices(self):
        """Список доступных микрофонов"""
        devices = []
        try:
            import pyaudiowpatch as pyaudio
            p = pyaudio.PyAudio()
            for i in range(p.get_device_count()):
                info = p.get_device_info_by_index(i)
                if info['maxInputChannels'] > 0:
                    devices.append({
                        'index': i,
                        'name': info['name'],
                        'channels': info['maxInputChannels'],
                        'sampleRate': int(info['defaultSampleRate'])
                    })
            p.terminate()
        except ImportError:
            try:
                import sounddevice as sd
                for i, dev in enumerate(sd.query_devices()):
                    if dev['max_input_channels'] > 0:
                        devices.append({
                            'index': i,
                            'name': dev['name'],
                            'channels': dev['max_input_channels'],
                            'sampleRate': int(dev['default_samplerate'])
                        })
            except:
                pass
        return devices
    
    async def start_capture(self, ws_url=WS_URL):
        """Запуск захвата и отправки в WebSocket"""
        import websockets
        
        try:
            import pyaudiowpatch as pyaudio
            use_pyaudio = True
        except ImportError:
            import sounddevice as sd
            use_pyaudio = False
        
        self.running = True
        
        async with websockets.connect(ws_url) as ws:
            self.ws = ws
            logger.info(f'[MIC] Подключено к {ws_url}')
            
            if use_pyaudio:
                await self._capture_pyaudio(pyaudio)
            else:
                await self._capture_sounddevice(sd)
    
    async def _capture_pyaudio(self, pyaudio):
        """Захват через pyaudiowpatch"""
        p = pyaudio.PyAudio()
        
        device_index = self.device_index
        if device_index is None:
            device_index = p.get_default_input_device_info()['index']
        
        device_info = p.get_device_info_by_index(device_index)
        logger.info(f'[MIC] Устройство: {device_info["name"]}')
        
        stream = p.open(
            format=pyaudio.paFloat32,
            channels=1,
            rate=SAMPLE_RATE,
            input=True,
            input_device_index=device_index,
            frames_per_buffer=CHUNK_SIZE
        )
        
        logger.info('[MIC] Захват запущен')
        
        try:
            while self.running:
                if self.muted:
                    await asyncio.sleep(0.1)
                    continue
                
                data = stream.read(CHUNK_SIZE, exception_on_overflow=False)
                audio = np.frombuffer(data, dtype=np.float32)
                
                # Отправляем через WebSocket
                if self.ws:
                    await self.ws.send(audio.tobytes())
                
                await asyncio.sleep(0.01)
        finally:
            stream.stop_stream()
            stream.close()
            p.terminate()
    
    async def _capture_sounddevice(self, sd):
        """Захват через sounddevice"""
        device_index = self.device_index or sd.default.device[0]
        device_info = sd.query_devices(device_index)
        logger.info(f'[MIC] Устройство: {device_info["name"]}')
        
        queue = asyncio.Queue()
        
        def callback(indata, frames, time_info, status):
            if status:
                logger.warning(f'[MIC] Status: {status}')
            if not self.muted:
                audio = indata[:, 0].astype(np.float32)
                asyncio.get_event_loop().call_soon_threadsafe(
                    queue.put_nowait, audio.tobytes()
                )
        
        with sd.InputStream(
            device=device_index,
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype='float32',
            blocksize=CHUNK_SIZE,
            callback=callback
        ):
            logger.info('[MIC] Захват запущен')
            while self.running:
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=0.1)
                    if self.ws:
                        await self.ws.send(data)
                except asyncio.TimeoutError:
                    pass
    
    def stop(self):
        self.running = False
    
    def set_muted(self, muted):
        self.muted = muted
        logger.info(f'[MIC] Muted: {muted}')
    
    def switch_device(self, device_index):
        """Переключение на другой микрофон"""
        self.device_index = device_index
        logger.info(f'[MIC] Переключено на устройство {device_index}')


async def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--device', type=int, default=None, help='Device index')
    parser.add_argument('--list', action='store_true', help='List devices')
    args = parser.parse_args()
    
    mic = MicrophoneCapture(args.device)
    
    if args.list:
        devices = mic.list_devices()
        print('Доступные микрофоны:')
        for d in devices:
            print(f"  [{d['index']}] {d['name']} ({d['channels']}ch, {d['sampleRate']}Hz)")
        return
    
    try:
        await mic.start_capture()
    except KeyboardInterrupt:
        mic.stop()
        logger.info('[MIC] Остановлен')


if __name__ == '__main__':
    asyncio.run(main())
