"""
Модуль логирования метрик производительности
Записывает события в JSON Lines файл для последующего анализа
"""

import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
from dataclasses import dataclass, asdict
from threading import Lock

# Путь к файлу логов
METRICS_DIR = Path(__file__).parent.parent / 'logs'
METRICS_FILE = METRICS_DIR / 'metrics.jsonl'

# Блокировка для thread-safe записи
_write_lock = Lock()


@dataclass
class MetricEvent:
    """Событие метрики"""
    timestamp: str
    event_type: str
    component: str  # stt, llm, ui
    data: Dict[str, Any]
    
    def to_dict(self) -> dict:
        return asdict(self)


def _ensure_dir():
    """Создаёт директорию логов если не существует"""
    METRICS_DIR.mkdir(parents=True, exist_ok=True)


def log_metric(event_type: str, component: str, **data):
    """
    Логирует метрику в файл
    
    Args:
        event_type: тип события (transcription, hint_request, hint_response, cache_hit, error)
        component: компонент (stt, llm, ui)
        **data: произвольные данные метрики
    """
    _ensure_dir()
    
    event = MetricEvent(
        timestamp=datetime.now().isoformat(),
        event_type=event_type,
        component=component,
        data=data
    )
    
    with _write_lock:
        with open(METRICS_FILE, 'a', encoding='utf-8') as f:
            f.write(json.dumps(event.to_dict(), ensure_ascii=False) + '\n')


def log_stt_transcription(text: str, latency_ms: int, audio_duration_sec: float, model: str = 'large-v3'):
    """Логирует транскрипцию STT"""
    log_metric(
        'transcription',
        'stt',
        text_length=len(text),
        latency_ms=latency_ms,
        audio_duration_sec=round(audio_duration_sec, 2),
        model=model,
        rtf=round(latency_ms / 1000 / audio_duration_sec, 3) if audio_duration_sec > 0 else 0
    )


def log_llm_request(text: str, context_size: int, question_type: str, profile: str):
    """Логирует запрос к LLM"""
    log_metric(
        'hint_request',
        'llm',
        text_length=len(text),
        context_size=context_size,
        question_type=question_type,
        profile=profile
    )


def log_llm_response(
    ttft_ms: int, 
    total_ms: int, 
    hint_length: int, 
    cached: bool = False,
    question_type: str = 'general'
):
    """Логирует ответ LLM"""
    log_metric(
        'hint_response',
        'llm',
        ttft_ms=ttft_ms,
        total_ms=total_ms,
        hint_length=hint_length,
        cached=cached,
        question_type=question_type
    )


def log_cache_hit(text: str, similarity: float = 1.0):
    """Логирует попадание в кэш"""
    log_metric(
        'cache_hit',
        'llm',
        text_length=len(text),
        similarity=round(similarity, 3)
    )


def log_error(component: str, error_type: str, message: str):
    """Логирует ошибку"""
    log_metric(
        'error',
        component,
        error_type=error_type,
        message=message[:500]
    )


def get_metrics_stats() -> Dict[str, Any]:
    """
    Анализирует файл метрик и возвращает статистику
    """
    if not METRICS_FILE.exists():
        return {'error': 'Файл метрик не найден'}
    
    events = []
    with open(METRICS_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    
    if not events:
        return {'error': 'Нет данных'}
    
    # Статистика по STT
    stt_events = [e for e in events if e['component'] == 'stt' and e['event_type'] == 'transcription']
    stt_latencies = [e['data']['latency_ms'] for e in stt_events]
    
    # Статистика по LLM
    llm_responses = [e for e in events if e['event_type'] == 'hint_response']
    llm_ttft = [e['data']['ttft_ms'] for e in llm_responses if not e['data'].get('cached')]
    llm_total = [e['data']['total_ms'] for e in llm_responses if not e['data'].get('cached')]
    cache_hits = sum(1 for e in llm_responses if e['data'].get('cached'))
    
    # Распределение типов вопросов
    question_types = {}
    for e in events:
        if e['event_type'] == 'hint_request':
            qt = e['data'].get('question_type', 'unknown')
            question_types[qt] = question_types.get(qt, 0) + 1
    
    # Ошибки
    errors = [e for e in events if e['event_type'] == 'error']
    
    def calc_stats(values):
        if not values:
            return {'min': 0, 'max': 0, 'avg': 0, 'count': 0}
        return {
            'min': min(values),
            'max': max(values),
            'avg': round(sum(values) / len(values)),
            'count': len(values)
        }
    
    return {
        'total_events': len(events),
        'period': {
            'from': events[0]['timestamp'] if events else None,
            'to': events[-1]['timestamp'] if events else None
        },
        'stt': {
            'transcriptions': len(stt_events),
            'latency_ms': calc_stats(stt_latencies)
        },
        'llm': {
            'requests': len(llm_responses),
            'cache_hits': cache_hits,
            'cache_hit_rate': round(cache_hits / len(llm_responses) * 100, 1) if llm_responses else 0,
            'ttft_ms': calc_stats(llm_ttft),
            'total_ms': calc_stats(llm_total)
        },
        'question_types': question_types,
        'errors': {
            'count': len(errors),
            'by_component': {}
        }
    }


def clear_metrics():
    """Очищает файл метрик"""
    if METRICS_FILE.exists():
        METRICS_FILE.unlink()
