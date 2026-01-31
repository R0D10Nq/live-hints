"""
Тесты для audio_mode_detector.py
"""
import pytest
import sys
import os
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'python'))


class TestGetAudioMode:
    """Тесты для get_audio_mode"""
    
    @patch('audio_mode_detector.pyaudio')
    def test_get_audio_mode_loopback(self, mock_pyaudio_module):
        """Тест определения loopback режима"""
        mock_pyaudio = MagicMock()
        mock_pyaudio_module.PyAudio.return_value = mock_pyaudio
        
        # Настраиваем mock для loopback устройства
        mock_default_output = {'name': 'Speaker'}
        mock_pyaudio.get_default_output_device_info.return_value = mock_default_output
        
        mock_loopback_device = {
            'name': 'Speaker (loopback)',
            'isLoopbackDevice': True,
            'maxInputChannels': 2
        }
        mock_pyaudio.get_device_count.return_value = 1
        mock_pyaudio.get_device_info_by_index.return_value = mock_loopback_device
        
        from audio_mode_detector import get_audio_mode
        result = get_audio_mode()
        
        assert result == 'loopback'
        mock_pyaudio.terminate.assert_called_once()
    
    @patch('audio_mode_detector.pyaudio')
    def test_get_audio_mode_microphone(self, mock_pyaudio_module):
        """Тест определения микрофонного режима"""
        mock_pyaudio = MagicMock()
        mock_pyaudio_module.PyAudio.return_value = mock_pyaudio
        
        # Настраиваем mock для микрофона
        mock_default_output = {'name': 'Speaker'}
        mock_pyaudio.get_default_output_device_info.return_value = mock_default_output
        
        # Нет loopback устройств
        mock_pyaudio.get_device_count.return_value = 1
        mock_pyaudio.get_device_info_by_index.return_value = {
            'name': 'Microphone',
            'isLoopbackDevice': False,
            'maxInputChannels': 0
        }
        
        mock_default_input = {
            'name': 'Microphone',
            'isLoopbackDevice': False,
            'maxInputChannels': 1
        }
        mock_pyaudio.get_default_input_device_info.return_value = mock_default_input
        
        from audio_mode_detector import get_audio_mode
        result = get_audio_mode()
        
        assert result == 'microphone'
    
    @patch('audio_mode_detector.pyaudio')
    def test_get_audio_mode_fallback_loopback(self, mock_pyaudio_module):
        """Тест fallback на loopback устройство"""
        mock_pyaudio = MagicMock()
        mock_pyaudio_module.PyAudio.return_value = mock_pyaudio
        
        # Ошибка при получении default устройств
        mock_pyaudio.get_default_output_device_info.side_effect = Exception("Error")
        
        # Но есть loopback в списке
        mock_pyaudio.get_device_count.return_value = 1
        mock_pyaudio.get_device_info_by_index.return_value = {
            'name': 'Loopback',
            'isLoopbackDevice': True,
            'maxInputChannels': 2
        }
        
        from audio_mode_detector import get_audio_mode
        result = get_audio_mode()
        
        assert result == 'loopback'
    
    @patch('audio_mode_detector.pyaudio')
    def test_get_audio_mode_fallback_microphone(self, mock_pyaudio_module):
        """Тест fallback на микрофон"""
        mock_pyaudio = MagicMock()
        mock_pyaudio_module.PyAudio.return_value = mock_pyaudio
        
        # Ошибка при получении default устройств
        mock_pyaudio.get_default_output_device_info.side_effect = Exception("Error")
        
        # Нет loopback, но есть микрофон
        mock_pyaudio.get_device_count.return_value = 1
        mock_pyaudio.get_device_info_by_index.return_value = {
            'name': 'Mic',
            'isLoopbackDevice': False,
            'maxInputChannels': 2
        }
        
        from audio_mode_detector import get_audio_mode
        result = get_audio_mode()
        
        assert result == 'microphone'
    
    @patch('audio_mode_detector.pyaudio')
    def test_get_audio_mode_no_devices(self, mock_pyaudio_module):
        """Тест когда нет устройств"""
        mock_pyaudio = MagicMock()
        mock_pyaudio_module.PyAudio.return_value = mock_pyaudio
        
        # Ошибка при получении устройств
        mock_pyaudio.get_default_output_device_info.side_effect = Exception("Error")
        mock_pyaudio.get_device_count.return_value = 0
        
        from audio_mode_detector import get_audio_mode
        result = get_audio_mode()
        
        assert result == 'loopback'  # Default fallback
    
    @patch('audio_mode_detector.pyaudio')
    def test_get_audio_mode_exception(self, mock_pyaudio_module):
        """Тест при исключении в PyAudio"""
        mock_pyaudio_module.PyAudio.side_effect = Exception("PyAudio error")
        
        from audio_mode_detector import get_audio_mode
        result = get_audio_mode()
        
        assert result == 'loopback'  # Safe default


class TestListAudioDevices:
    """Тесты для list_audio_devices"""
    
    @patch('audio_mode_detector.pyaudio')
    def test_list_devices_success(self, mock_pyaudio_module):
        """Тест успешного получения списка устройств"""
        mock_pyaudio = MagicMock()
        mock_pyaudio_module.PyAudio.return_value = mock_pyaudio
        
        mock_pyaudio.get_device_count.return_value = 3
        
        def side_effect(index):
            devices = [
                {
                    'name': 'Loopback Device',
                    'isLoopbackDevice': True,
                    'maxInputChannels': 2,
                    'maxOutputChannels': 0,
                    'defaultSampleRate': 48000
                },
                {
                    'name': 'Microphone',
                    'isLoopbackDevice': False,
                    'maxInputChannels': 1,
                    'maxOutputChannels': 0,
                    'defaultSampleRate': 44100
                },
                {
                    'name': 'Speakers',
                    'isLoopbackDevice': False,
                    'maxInputChannels': 0,
                    'maxOutputChannels': 2,
                    'defaultSampleRate': 48000
                }
            ]
            return devices[index]
        
        mock_pyaudio.get_device_info_by_index.side_effect = side_effect
        
        from audio_mode_detector import list_audio_devices
        loopback, mics = list_audio_devices()
        
        assert len(loopback) == 1
        assert len(mics) == 1
        assert loopback[0][1]['name'] == 'Loopback Device'
        assert mics[0][1]['name'] == 'Microphone'
    
    @patch('audio_mode_detector.pyaudio')
    def test_list_devices_exception(self, mock_pyaudio_module):
        """Тест при ошибке получения списка"""
        mock_pyaudio_module.PyAudio.side_effect = Exception("Error")
        
        from audio_mode_detector import list_audio_devices
        loopback, mics = list_audio_devices()
        
        assert loopback == []
        assert mics == []


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
