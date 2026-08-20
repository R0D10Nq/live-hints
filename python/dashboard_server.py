"""
Live Hints Dashboard Server
Аналитика и визуализация метрик на порту 8767
"""

import json
import base64
import hashlib
import re
import csv
import io
from datetime import datetime, timedelta
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
import uvicorn

app = FastAPI(title="Live Hints Dashboard")

DASHBOARD_TOKEN = os.getenv('DASHBOARD_TOKEN')

@app.middleware('http')
async def verify_token(request: Request, call_next):
    if DASHBOARD_TOKEN:
        token = request.query_params.get('token') or request.headers.get('x-dashboard-token')
        if token != DASHBOARD_TOKEN:
            if request.url.path.startswith('/api/'):
                return JSONResponse(status_code=401, content={'detail': 'Доступ запрещён'})
            return HTMLResponse('<h1>Доступ запрещён</h1>', status_code=401)
    return await call_next(request)


@app.middleware('http')
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    template = TEMPLATE_FILE.read_text(encoding='utf-8') if TEMPLATE_FILE.exists() else ''
    inline_scripts = re.findall(r'<script>(.*?)</script>', template, flags=re.DOTALL)
    script_hashes = []
    for script in inline_scripts:
        digest = hashlib.sha256(script.encode('utf-8')).digest()
        script_hashes.append(f"'sha256-{base64.b64encode(digest).decode('ascii')}'")

    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        f"script-src 'self' https://cdn.jsdelivr.net {' '.join(script_hashes)}; "
        "style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; "
        "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    )
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'no-referrer'
    return response

# Пути к данным
RUNTIME_ROOT = Path(os.getenv('LIVE_HINTS_DATA_DIR', Path(__file__).parent.parent))
DATA_DIR = RUNTIME_ROOT / "data"
METRICS_FILE = RUNTIME_ROOT / "logs" / "metrics.jsonl"
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
        event = m.get('event_type', m.get('event', ''))
        data = m.get('data', m)
        
        if event in {'transcription', 'stt_transcription'}:
            lat = data.get('latency_ms', 0)
            if lat > 0:
                stt_latencies.append(lat)
        
        elif event in {'hint_response', 'llm_response'}:
            lat = data.get('total_ms', data.get('latency_ms', 0))
            if lat > 0:
                llm_latencies.append(lat)
            
            q_type = data.get('question_type', 'general')
            if q_type in question_types:
                question_types[q_type] += 1
            
            if data.get('cached'):
                cache_hits += 1
            else:
                cache_misses += 1
        
        elif event == 'error':
            errors.append({
                'timestamp': m.get('timestamp'),
                'component': m.get('component'),
                'message': data.get('message')
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
    metrics = load_metrics(max(1, min(hours, 24 * 30)))
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
    
    output = io.StringIO(newline='')
    writer = csv.writer(output, lineterminator='\n')
    writer.writerow(['timestamp', 'event_type', 'component', 'latency_ms', 'question_type', 'cached'])
    for m in metrics:
        data = m.get('data', {})
        latency_ms = data.get('latency_ms', data.get('total_ms', 0))
        writer.writerow(
            [
                m.get('timestamp', ''),
                m.get('event_type', m.get('event', '')),
                m.get('component', ''),
                latency_ms,
                data.get('question_type', ''),
                data.get('cached', ''),
            ]
        )

    return {'csv': output.getvalue()}


# ========== MAIN ==========
if __name__ == '__main__':
    ensure_data_dir()
    print(f'[Dashboard] Запуск http://127.0.0.1:8767')
    uvicorn.run(app, host='127.0.0.1', port=8767, log_level='warning')
