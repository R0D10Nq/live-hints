"""
Тесты валидации статических файлов промо-сайта для GitHub Pages.
Проверяют структуру, относительные ссылки, отсутствие эмодзи, 3D-ассеты и семантическую разметку.
"""

import os

SITE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "site")
WORKFLOW_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", ".github", "workflows", "pages.yml"
)


def find_emojis(text: str) -> list[str]:
    """Находит эмодзи и графические пиктограммы в тексте без диапазонов regex."""
    found: list[str] = []
    for ch in text:
        cp = ord(ch)
        # Стандартные диапазоны эмодзи и пиктограмм Unicode
        if (
            (0x1F300 <= cp <= 0x1FAFF)
            or (0x1F600 <= cp <= 0x1F64F)
            or (0x2702 <= cp <= 0x27B0)
            or (0x2600 <= cp <= 0x26FF)
        ):
            found.append(ch)
    return found


def test_site_files_exist():
    """Все ключевые файлы промо-сайта и 3D-ассеты должны присутствовать на диске."""
    assert os.path.exists(os.path.join(SITE_DIR, "index.html"))
    assert os.path.exists(os.path.join(SITE_DIR, "styles.css"))
    assert os.path.exists(os.path.join(SITE_DIR, "app.js"))
    assert os.path.exists(os.path.join(SITE_DIR, "assets", "icon.png"))
    # Авторские 3D-ассеты без фона
    assert os.path.exists(os.path.join(SITE_DIR, "assets", "hero-wave-3d.png"))
    assert os.path.exists(os.path.join(SITE_DIR, "assets", "neural-orb-transparent.png"))
    assert os.path.exists(os.path.join(SITE_DIR, "assets", "titanium-ring-transparent.png"))


def test_site_no_emojis():
    """Категорический запрет любых эмодзи во всех файлах сайта (только векторные SVG)."""
    for filename in ["index.html", "styles.css", "app.js"]:
        filepath = os.path.join(SITE_DIR, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            matches = find_emojis(content)
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
    assert 'id="how-it-works"' in content
    assert 'id="demo"' in content
    assert 'id="comparison"' in content
    assert 'id="pricing"' in content
    assert 'id="faq"' in content

    # Нативный аккордеон согласно Modern Web Guidance
    assert "<details" in content
    assert "<summary" in content

    # Интерактивный симулятор оверлея
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
