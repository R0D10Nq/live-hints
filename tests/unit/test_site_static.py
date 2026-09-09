"""
Тесты валидации статических файлов промо-сайта для GitHub Pages.
Проверяют структуру, относительные ссылки, отсутствие эмодзи и семантическую разметку.
"""

import os
import re

SITE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "site")
WORKFLOW_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", ".github", "workflows", "pages.yml"
)

# Регулярное выражение для обнаружения эмодзи и графических символов юникода
EMOJI_PATTERN = re.compile(
    "["
    "\U0001f300-\U0001f5ff"  # символы и пиктограммы
    "\U0001f600-\U0001f64f"  # смайлики
    "\U0001f680-\U0001f6ff"  # транспорт и карты
    "\U0001f700-\U0001f77f"
    "\U0001f780-\U0001f7ff"
    "\U0001f800-\U0001f8ff"
    "\U0001f900-\U0001f9ff"  # дополнительные символы
    "\U0001fa00-\U0001faff"
    "\U00002702-\U000027b0"  # Dingbats
    "\U000024c2-\U0001f251"
    "]+",
    flags=re.UNICODE,
)


def test_site_files_exist():
    """Все ключевые файлы промо-сайта должны присутствовать на диске."""
    assert os.path.exists(os.path.join(SITE_DIR, "index.html"))
    assert os.path.exists(os.path.join(SITE_DIR, "styles.css"))
    assert os.path.exists(os.path.join(SITE_DIR, "app.js"))
    assert os.path.exists(os.path.join(SITE_DIR, "assets", "icon.png"))


def test_site_no_emojis():
    """Категорический запрет любых эмодзи во всех файлах сайта (только векторные SVG)."""
    for filename in ["index.html", "styles.css", "app.js"]:
        filepath = os.path.join(SITE_DIR, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            matches = EMOJI_PATTERN.findall(content)
            assert not matches, f"В файле {filename} обнаружены запрещенные эмодзи: {matches}"


def test_site_relative_asset_paths():
    """Все ссылки на скрипты, стили и ассеты должны быть строго относительными для GitHub Pages."""
    index_path = os.path.join(SITE_DIR, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Запрещены абсолютные пути /styles.css, /app.js, /assets/
    assert 'href="/styles.css"' not in content
    assert 'src="/app.js"' not in content
    assert 'src="/assets/' not in content

    # Разрешены относительные пути ./styles.css, ./app.js, ./assets/
    assert 'href="./styles.css"' in content
    assert 'src="./app.js"' in content


def test_site_semantic_sections():
    """Промо-лендинг должен содержать все ключевые конверсионные блоки."""
    index_path = os.path.join(SITE_DIR, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "<header" in content
    assert "<main" in content
    assert "<footer" in content
    assert 'id="features"' in content
    assert 'id="modes"' in content
    assert 'id="comparison"' in content
    assert 'id="pricing"' in content
    assert 'id="faq"' in content

    # Нативный аккордеон согласно Modern Web Guidance
    assert "<details" in content
    assert "<summary" in content

    # Интерактивный симулятор оверлея
    assert "demo-window" in content
    assert "demo-tab-btn" in content

    # Упоминание 0 рублей и Open Source
    assert "0 ₽" in content
    assert "Open Source" in content


def test_pages_workflow_exists():
    """GitHub Actions workflow для деплоя на GitHub Pages должен быть сконфигурирован."""
    assert os.path.exists(WORKFLOW_PATH)
    with open(WORKFLOW_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    assert "upload-pages-artifact" in content
    assert "deploy-pages" in content
    assert "site" in content
