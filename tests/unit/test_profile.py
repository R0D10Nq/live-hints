import json
import os

# Проверяем настройки
settings_path = os.path.join(os.path.dirname(__file__), 'renderer', 'settings.json')
if os.path.exists(settings_path):
    with open(settings_path, 'r', encoding='utf-8') as f:
        settings = json.load(f)
        print(f'Profile from settings: {settings.get("profile")}')
else:
    print('Settings file not found')
