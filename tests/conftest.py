"""
Конфигурация pytest для корректных импортов
"""
import sys
from pathlib import Path

# Добавляем python/ в PYTHONPATH для импортов
project_root = Path(__file__).parent.parent
python_dir = project_root / 'python'

sys.path.insert(0, str(project_root))
sys.path.insert(0, str(python_dir))
