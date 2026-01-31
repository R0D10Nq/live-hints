import requests
import json

# Тест запроса
request_data = {
    "text": "Как у нас обстоят дела с проектом?",
    "profile": "business_meeting"
}

try:
    response = requests.post(
        "http://localhost:8766/hint",
        json=request_data,
        timeout=30
    )
    
    if response.status_code == 200:
        result = response.json()
        print("=== RESPONSE ===")
        print(f"Hint: {result.get('hint', 'No hint')[:200]}...")
        print(f"Latency: {result.get('latency_ms', 0)}ms")
        
        # Проверяем, что ответ в контексте бизнес-встречи
        hint = result.get('hint', '').lower()
        if 'проект' in hint and ('метрик' in hint or 'результат' in hint):
            print("\n✅ ОТЛИЧНО: Ответ в контексте бизнес-встречи!")
        else:
            print("\n❌ ПРОБЛЕМА: Ответ не соответствует бизнес-контексту")
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"Connection error: {e}")
    print("Убедитесь, что LLM сервер запущен на http://localhost:8766")
