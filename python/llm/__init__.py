"""
LLM модуль - Ollama клиент, Vision AI, GPU утилиты
"""

from .ollama_client import OllamaClient, HintMetrics, build_messages
from .vision import get_available_vision_model, analyze_image, VISION_MODELS
from .gpu import check_gpu_status, get_gpu_info

__all__ = [
    'OllamaClient',
    'HintMetrics', 
    'build_messages',
    'get_available_vision_model',
    'analyze_image',
    'VISION_MODELS',
    'check_gpu_status',
    'get_gpu_info'
]
