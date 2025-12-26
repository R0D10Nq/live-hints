"""
Тесты для python/llm/gpu.py
"""
import pytest
from unittest.mock import patch, MagicMock
import subprocess


class TestCheckGpuStatus:
    """Тесты для check_gpu_status"""
    
    @patch('llm.gpu.subprocess.check_output')
    def test_gpu_available(self, mock_output):
        """GPU доступен — возвращает информацию"""
        mock_output.return_value = b'NVIDIA GeForce RTX 3080, 10240, 2048'
        
        from llm.gpu import check_gpu_status
        result = check_gpu_status()
        
        assert result['available'] is True
        assert result['name'] == 'NVIDIA GeForce RTX 3080'
        assert result['memory_total'] == 10240
        assert result['memory_used'] == 2048
    
    @patch('llm.gpu.subprocess.check_output')
    def test_gpu_not_available_file_not_found(self, mock_output):
        """nvidia-smi не найден"""
        mock_output.side_effect = FileNotFoundError()
        
        from llm.gpu import check_gpu_status
        result = check_gpu_status()
        
        assert result['available'] is False
        assert result['name'] is None
    
    @patch('llm.gpu.subprocess.check_output')
    def test_gpu_not_available_timeout(self, mock_output):
        """nvidia-smi таймаут"""
        mock_output.side_effect = subprocess.TimeoutExpired('nvidia-smi', 5)
        
        from llm.gpu import check_gpu_status
        result = check_gpu_status()
        
        assert result['available'] is False
    
    @patch('llm.gpu.subprocess.check_output')
    def test_gpu_empty_output(self, mock_output):
        """nvidia-smi пустой вывод"""
        mock_output.return_value = b''
        
        from llm.gpu import check_gpu_status
        result = check_gpu_status()
        
        assert result['available'] is False


class TestGetGpuInfo:
    """Тесты для get_gpu_info"""
    
    @patch('llm.gpu.check_gpu_status')
    def test_gpu_info_available(self, mock_status):
        """GPU доступен — возвращает свободную память"""
        mock_status.return_value = {
            'available': True,
            'name': 'RTX 3080',
            'memory_total': 10240,
            'memory_used': 2048
        }
        
        from llm.gpu import get_gpu_info
        result = get_gpu_info()
        
        assert result['available'] is True
        assert result['name'] == 'RTX 3080'
        assert result['memory_free_mb'] == 8192
        assert result['memory_total_mb'] == 10240
    
    @patch('llm.gpu.check_gpu_status')
    def test_gpu_info_not_available(self, mock_status):
        """GPU не доступен"""
        mock_status.return_value = {
            'available': False, 
            'name': None, 
            'memory_total': None, 
            'memory_used': None
            }
        
        from llm.gpu import get_gpu_info
        result = get_gpu_info()
        
        assert result['available'] is False
        assert 'message' in result
