"""
Live Hints Dashboard Server
Аналитика и визуализация метрик на порту 8767
"""

import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

app = FastAPI(title="Live Hints Dashboard")

# Пути к данным
DATA_DIR = Path(__file__).parent.parent / "data"
METRICS_FILE = DATA_DIR / "metrics.jsonl"
SESSIONS_FILE = DATA_DIR / "sessions.json"

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
    question_types = {'technical': 0, 'experience': 0, 'general': 0}
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

@app.get("/", response_class=HTMLResponse)
async def dashboard():
    """Главная страница дашборда"""
    return DASHBOARD_HTML

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


# ========== DASHBOARD HTML ==========

DASHBOARD_HTML = """
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Live Hints - Дашборд</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', system-ui, sans-serif;
            background: #0f172a;
            color: #f8fafc;
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 { margin-bottom: 20px; color: #818cf8; }
        h2 { margin-bottom: 12px; font-size: 16px; color: #94a3b8; }
        
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        
        .card {
            background: #1e293b;
            border-radius: 12px;
            padding: 20px;
            border: 1px solid rgba(148, 163, 184, 0.1);
        }
        
        .stat-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }
        .stat-label { color: #94a3b8; }
        .stat-value { font-weight: 600; color: #f8fafc; }
        .stat-value.good { color: #22c55e; }
        .stat-value.warning { color: #eab308; }
        .stat-value.error { color: #ef4444; }
        
        .chart-container { height: 200px; margin-top: 12px; }
        
        .sessions-list { max-height: 400px; overflow-y: auto; }
        .session-item {
            padding: 12px;
            margin-bottom: 8px;
            background: #334155;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .session-item:hover {
            background: #475569;
            transform: translateX(4px);
        }
        .session-date { font-size: 12px; color: #94a3b8; }
        .session-stats { font-size: 14px; margin-top: 4px; }
        
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
            margin-right: 4px;
        }
        .badge-tech { background: rgba(96, 165, 250, 0.2); color: #60a5fa; }
        .badge-exp { background: rgba(52, 211, 153, 0.2); color: #34d399; }
        .badge-gen { background: rgba(156, 163, 175, 0.2); color: #9ca3af; }
        
        .refresh-btn {
            background: #6366f1;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            margin-bottom: 20px;
        }
        .refresh-btn:hover { background: #4f46e5; }
        
        .error-item {
            padding: 8px;
            margin-bottom: 4px;
            background: rgba(239, 68, 68, 0.1);
            border-left: 3px solid #ef4444;
            border-radius: 4px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Live Hints - Аналитика</h1>
        <button class="refresh-btn" onclick="loadStats()">Обновить данные</button>
        
        <div class="grid">
            <!-- STT Stats -->
            <div class="card">
                <h2>STT (Speech-to-Text)</h2>
                <div class="stat-row">
                    <span class="stat-label">Транскрипций</span>
                    <span class="stat-value" id="stt-count">-</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Средняя латентность</span>
                    <span class="stat-value" id="stt-avg">-</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Min / Max</span>
                    <span class="stat-value" id="stt-minmax">-</span>
                </div>
                <div class="chart-container">
                    <canvas id="stt-chart"></canvas>
                </div>
            </div>
            
            <!-- LLM Stats -->
            <div class="card">
                <h2>LLM (Language Model)</h2>
                <div class="stat-row">
                    <span class="stat-label">Подсказок</span>
                    <span class="stat-value" id="llm-count">-</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Средняя латентность</span>
                    <span class="stat-value" id="llm-avg">-</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Min / Max</span>
                    <span class="stat-value" id="llm-minmax">-</span>
                </div>
                <div class="chart-container">
                    <canvas id="llm-chart"></canvas>
                </div>
            </div>
            
            <!-- Question Types -->
            <div class="card">
                <h2>Типы вопросов</h2>
                <div class="stat-row">
                    <span class="stat-label">Technical</span>
                    <span class="stat-value badge badge-tech" id="qt-tech">-</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Experience</span>
                    <span class="stat-value badge badge-exp" id="qt-exp">-</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">General</span>
                    <span class="stat-value badge badge-gen" id="qt-gen">-</span>
                </div>
                <div class="chart-container">
                    <canvas id="qt-chart"></canvas>
                </div>
            </div>
            
            <!-- Cache Stats -->
            <div class="card">
                <h2>Кэш</h2>
                <div class="stat-row">
                    <span class="stat-label">Cache Hits</span>
                    <span class="stat-value good" id="cache-hits">-</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Cache Misses</span>
                    <span class="stat-value" id="cache-misses">-</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Hit Rate</span>
                    <span class="stat-value" id="cache-rate">-</span>
                </div>
            </div>
            
            <!-- Errors -->
            <div class="card">
                <h2>Последние ошибки</h2>
                <div id="errors-list"></div>
            </div>
            
            <!-- Sessions -->
            <div class="card" style="grid-column: span 2;">
                <h2>Последние сессии</h2>
                <div class="sessions-list" id="sessions-list"></div>
            </div>
        </div>
    </div>
    
    <script>
        let sttChart, llmChart, qtChart;
        
        async function loadStats() {
            try {
                const resp = await fetch('/api/stats?hours=24');
                const data = await resp.json();
                
                // STT
                document.getElementById('stt-count').textContent = data.stt.count;
                document.getElementById('stt-avg').textContent = data.stt.avg_ms.toFixed(0) + ' ms';
                document.getElementById('stt-minmax').textContent = 
                    data.stt.min_ms.toFixed(0) + ' / ' + data.stt.max_ms.toFixed(0) + ' ms';
                updateChart('stt', data.stt.latencies);
                
                // LLM
                document.getElementById('llm-count').textContent = data.llm.count;
                document.getElementById('llm-avg').textContent = data.llm.avg_ms.toFixed(0) + ' ms';
                document.getElementById('llm-minmax').textContent = 
                    data.llm.min_ms.toFixed(0) + ' / ' + data.llm.max_ms.toFixed(0) + ' ms';
                updateChart('llm', data.llm.latencies);
                
                // Question types
                document.getElementById('qt-tech').textContent = data.question_types.technical;
                document.getElementById('qt-exp').textContent = data.question_types.experience;
                document.getElementById('qt-gen').textContent = data.question_types.general;
                updateQTChart(data.question_types);
                
                // Cache
                document.getElementById('cache-hits').textContent = data.cache.hits;
                document.getElementById('cache-misses').textContent = data.cache.misses;
                document.getElementById('cache-rate').textContent = data.cache.hit_rate.toFixed(1) + '%';
                
                // Errors
                const errorsList = document.getElementById('errors-list');
                if (data.errors.length === 0) {
                    errorsList.innerHTML = '<p style="color:#94a3b8">Нет ошибок</p>';
                } else {
                    errorsList.innerHTML = data.errors.map(e => 
                        `<div class="error-item">${e.timestamp}: [${e.component}] ${e.message}</div>`
                    ).join('');
                }
                
            } catch (e) {
                console.error('Ошибка загрузки статистики:', e);
            }
            
            // Load sessions
            loadSessions();
        }
        
        async function loadSessions() {
            try {
                const resp = await fetch('/api/sessions');
                const data = await resp.json();
                
                const list = document.getElementById('sessions-list');
                if (data.sessions.length === 0) {
                    list.innerHTML = '<p style="color:#94a3b8">Нет сессий</p>';
                    return;
                }
                
                list.innerHTML = data.sessions.map(s => `
                    <div class="session-item">
                        <div class="session-date">${new Date(s.date).toLocaleString('ru-RU')}</div>
                        <div class="session-stats">
                            Транскрипт: ${(s.transcript || '').split('\\n').length} строк, 
                            Подсказки: ${(s.hints || '').split('\\n').length} строк
                        </div>
                    </div>
                `).join('');
                
            } catch (e) {
                console.error('Ошибка загрузки сессий:', e);
            }
        }
        
        function updateChart(type, data) {
            const ctx = document.getElementById(type + '-chart').getContext('2d');
            const labels = data.map((_, i) => i + 1);
            
            const chartRef = type === 'stt' ? sttChart : llmChart;
            if (chartRef) chartRef.destroy();
            
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Латентность (ms)',
                        data: data,
                        borderColor: type === 'stt' ? '#22c55e' : '#6366f1',
                        backgroundColor: type === 'stt' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { display: false },
                        y: { grid: { color: 'rgba(148, 163, 184, 0.1)' } }
                    }
                }
            });
            
            if (type === 'stt') sttChart = chart;
            else llmChart = chart;
        }
        
        function updateQTChart(data) {
            const ctx = document.getElementById('qt-chart').getContext('2d');
            if (qtChart) qtChart.destroy();
            
            qtChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Technical', 'Experience', 'General'],
                    datasets: [{
                        data: [data.technical, data.experience, data.general],
                        backgroundColor: ['#60a5fa', '#34d399', '#9ca3af']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }
        
        // Загружаем данные при старте
        loadStats();
        
        // Автообновление каждые 30 секунд
        setInterval(loadStats, 30000);
    </script>
</body>
</html>
"""


# ========== MAIN ==========
if __name__ == '__main__':
    ensure_data_dir()
    print(f'[Dashboard] Запуск http://localhost:8767')
    uvicorn.run(app, host='0.0.0.0', port=8767, log_level='warning')
