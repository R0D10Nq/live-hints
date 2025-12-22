#!/usr/bin/env python3
"""
Анализатор метрик производительности Live Hints
Запуск: python scripts/analyze_metrics.py
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'python'))

from metrics import get_metrics_stats, METRICS_FILE


def print_section(title: str):
    print(f"\n{'='*50}")
    print(f"  {title}")
    print('='*50)


def format_ms(ms: int) -> str:
    if ms >= 1000:
        return f"{ms/1000:.1f}s"
    return f"{ms}ms"


def main():
    print("\n" + "="*50)
    print("   LIVE HINTS - АНАЛИЗ МЕТРИК")
    print("="*50)
    
    if not METRICS_FILE.exists():
        print(f"\nФайл метрик не найден: {METRICS_FILE}")
        print("Запустите приложение и сгенерируйте несколько подсказок.")
        return
    
    stats = get_metrics_stats()
    
    if 'error' in stats:
        print(f"\nОшибка: {stats['error']}")
        return
    
    # Период
    print_section("ПЕРИОД ДАННЫХ")
    print(f"  Начало: {stats['period']['from']}")
    print(f"  Конец:  {stats['period']['to']}")
    print(f"  Всего событий: {stats['total_events']}")
    
    # STT статистика
    print_section("STT ТРАНСКРИПЦИЯ")
    stt = stats['stt']
    if stt['transcriptions'] > 0:
        lat = stt['latency_ms']
        print(f"  Транскрипций: {stt['transcriptions']}")
        print(f"  Латентность:")
        print(f"    Минимум: {format_ms(lat['min'])}")
        print(f"    Максимум: {format_ms(lat['max'])}")
        print(f"    Среднее: {format_ms(lat['avg'])}")
    else:
        print("  Нет данных о транскрипциях")
    
    # LLM статистика
    print_section("LLM ПОДСКАЗКИ")
    llm = stats['llm']
    if llm['requests'] > 0:
        print(f"  Всего запросов: {llm['requests']}")
        print(f"  Из кэша: {llm['cache_hits']} ({llm['cache_hit_rate']}%)")
        
        if llm['ttft_ms']['count'] > 0:
            ttft = llm['ttft_ms']
            print(f"\n  TTFT (Time To First Token):")
            print(f"    Минимум: {format_ms(ttft['min'])}")
            print(f"    Максимум: {format_ms(ttft['max'])}")
            print(f"    Среднее: {format_ms(ttft['avg'])}")
        
        if llm['total_ms']['count'] > 0:
            total = llm['total_ms']
            print(f"\n  Полное время генерации:")
            print(f"    Минимум: {format_ms(total['min'])}")
            print(f"    Максимум: {format_ms(total['max'])}")
            print(f"    Среднее: {format_ms(total['avg'])}")
    else:
        print("  Нет данных о подсказках")
    
    # Типы вопросов
    print_section("ТИПЫ ВОПРОСОВ")
    qt = stats['question_types']
    if qt:
        total_q = sum(qt.values())
        for qtype, count in sorted(qt.items(), key=lambda x: -x[1]):
            pct = round(count / total_q * 100, 1)
            bar = '#' * int(pct / 5)
            print(f"  {qtype:12} {count:4} ({pct:5.1f}%) {bar}")
    else:
        print("  Нет данных")
    
    # Ошибки
    print_section("ОШИБКИ")
    errors = stats['errors']
    if errors['count'] > 0:
        print(f"  Всего ошибок: {errors['count']}")
    else:
        print("  Ошибок не обнаружено")
    
    print("\n" + "="*50)
    print(f"  Файл метрик: {METRICS_FILE}")
    print("="*50 + "\n")


if __name__ == '__main__':
    main()
