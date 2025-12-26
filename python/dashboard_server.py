"""
Live Hints Dashboard Server
Аналитика и визуализация метрик на порту 8767
"""

import json
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
import uvicorn

app = FastAPI(title="Live Hints Dashboard")

# Пути к данным
DATA_DIR = Path(__file__).parent.parent / "data"
METRICS_FILE = DATA_DIR / "metrics.jsonl"
SESSIONS_FILE = DATA_DIR / "sessions.json"
TEMPLATE_FILE = Path(__file__).parent / "templates" / "dashboard.html"

def ensure_data_dir():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

def load_metrics(hours: int = 24) -> list:
    """Загрузить метрики за последние N часов"""
    metrics = []
    cutoff = datetime.now() - timedelta(hours=hours)
    
    if not METRICS_FILE.exists():
        return metrics
    
    try:
        with open(METRICS_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    m = json.loads(line.strip())
                    ts = datetime.fromisoformat(m.get('timestamp', '2000-01-01'))
                    if ts > cutoff:
                        metrics.append(m)
                except:
                    pass
    except:
        pass
    
    return metrics

def load_sessions() -> list:
    """Загрузить все сессии"""
    if not SESSIONS_FILE.exists():
        return []
    try:
        with open(SESSIONS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return []

def calculate_stats(metrics: list) -> dict:
    """Рассчитать статистику из метрик"""
    stt_latencies = []
    llm_latencies = []
    question_types = {
        'technical': 0, 
        'experience': 0, 
        'general': 0}
    cache_hits = 0
    cache_misses = 0
    errors = []
    
    for m in metrics:
        event = m.get('event', '')
        
        if event == 'stt_transcription':
            lat = m.get('latency_ms', 0)
            if lat > 0:
                stt_latencies.append(lat)
        
        elif event == 'llm_response':
            lat = m.get('latency_ms', 0)
            if lat > 0:
                llm_latencies.append(lat)
            
            q_type = m.get('question_type', 'general')
            if q_type in question_types:
                question_types[q_type] += 1
            
            if m.get('cached'):
                cache_hits += 1
            else:
                cache_misses += 1
        
        elif event == 'error':
            errors.append({
                'timestamp': m.get('timestamp'),
                'component': m.get('component'),
                'message': m.get('message')
            })
    
    return {
        'stt': {
            'count': len(stt_latencies),
            'avg_ms': sum(stt_latencies) / len(stt_latencies) if stt_latencies else 0,
            'min_ms': min(stt_latencies) if stt_latencies else 0,
            'max_ms': max(stt_latencies) if stt_latencies else 0,
            'latencies': stt_latencies[-100:]  # Последние 100 точек
        },
        'llm': {
            'count': len(llm_latencies),
            'avg_ms': sum(llm_latencies) / len(llm_latencies) if llm_latencies else 0,
            'min_ms': min(llm_latencies) if llm_latencies else 0,
            'max_ms': max(llm_latencies) if llm_latencies else 0,
            'latencies': llm_latencies[-100:]
        },
        'question_types': question_types,
        'cache': {
            'hits': cache_hits,
            'misses': cache_misses,
            'hit_rate': cache_hits / (cache_hits + cache_misses) * 100 if (cache_hits + cache_misses) > 0 else 0
        },
        'errors': errors[-20:]  # Последние 20 ошибок
    }


# ========== API ENDPOINTS ==========

def load_dashboard_template() -> str:
    """Загрузить HTML шаблон дашборда"""
    if TEMPLATE_FILE.exists():
        return TEMPLATE_FILE.read_text(encoding='utf-8')
    return "<h1>Шаблон не найден</h1>"


@app.get("/", response_class=HTMLResponse)
async def dashboard():
    """Главная страница дашборда"""
    return load_dashboard_template()

@app.get("/api/stats")
async def get_stats(hours: int = 24):
    """Получить статистику за последние N часов"""
    metrics = load_metrics(hours)
    stats = calculate_stats(metrics)
    return stats

@app.get("/api/sessions")
async def get_sessions():
    """Получить список всех сессий"""
    sessions = load_sessions()
    return {
        'count': len(sessions),
        'sessions': sessions[:50]  # Последние 50 сессий
    }

@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    """Получить детали сессии"""
    sessions = load_sessions()
    session = next((s for s in sessions if s.get('id') == session_id), None)
    if not session:
        raise HTTPException(404, "Сессия не найдена")
    return session

@app.get("/api/metrics/export")
async def export_metrics():
    """Экспортировать метрики в CSV"""
    metrics = load_metrics(hours=24*30)  # За месяц
    
    if not metrics:
        return {"error": "Нет данных"}
    
    # Простой CSV формат
    lines = ["timestamp,event,latency_ms,question_type,cached"]
    for m in metrics:
        lines.append(f"{m.get('timestamp','')},{m.get('event','')},{m.get('latency_ms',0)},{m.get('question_type','')},{m.get('cached','')}")
    
    return {"csv": "\n".join(lines)}


# ========== MAIN ==========
if __name__ == '__main__':
    ensure_data_dir()
    print(f'[Dashboard] Запуск http://localhost:8767')
    uvicorn.run(app, host='0.0.0.0', port=8767, log_level='warning')
