"""
GPU Utils - проверка статуса GPU
"""

import logging
import subprocess

logger = logging.getLogger('LLM')


def check_gpu_status() -> dict:
    """Проверка доступности GPU через nvidia-smi"""
    result = {
        'available': False, 
        'name': None, 
        'memory_total': None, 
        'memory_used': None
    }
    try:
        output = subprocess.check_output(
            ['nvidia-smi', '--query-gpu=name,memory.total,memory.used', '--format=csv,noheader,nounits'],
            timeout=5
        ).decode('utf-8').strip()
        if output:
            parts = output.split(',')
            result['available'] = True
            result['name'] = parts[0].strip()
            result['memory_total'] = int(parts[1].strip())
            result['memory_used'] = int(parts[2].strip())
    except (subprocess.SubprocessError, FileNotFoundError, Exception) as e:
        logger.warning(f'[GPU] nvidia-smi недоступен: {e}')
    return result


def get_gpu_info() -> dict:
    """Информация о GPU для API"""
    info = check_gpu_status()
    if info['available']:
        free = info['memory_total'] - info['memory_used']
        return {
            'available': True,
            'name': info['name'],
            'memory_free_mb': free,
            'memory_total_mb': info['memory_total']
        }
    return {
        'available': False, 
        'message': 'GPU не обнаружен'
    }
