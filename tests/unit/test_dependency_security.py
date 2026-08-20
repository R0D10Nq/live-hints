"""Регрессионные проверки безопасных обязательных зависимостей."""

import ast
from pathlib import Path

from packaging.requirements import Requirement
from packaging.version import Version


def _load_requirements():
    requirements_path = Path(__file__).parents[2] / 'python' / 'requirements.txt'
    return [
        Requirement(line)
        for line in requirements_path.read_text(encoding='utf-8').splitlines()
        if line.strip() and not line.lstrip().startswith('#')
    ]


def test_chromadb_is_not_an_installed_dependency():
    """Непатченный ChromaDB не должен устанавливаться вместе с приложением."""
    names = {requirement.name.lower() for requirement in _load_requirements()}

    assert 'chromadb' not in names


def test_python_code_does_not_import_chromadb():
    """Рабочий код не должен активировать ChromaDB из старого окружения."""
    python_root = Path(__file__).parents[2] / 'python'
    imports = []

    for source_path in python_root.rglob('*.py'):
        tree = ast.parse(source_path.read_text(encoding='utf-8'))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imports.extend(
                    f'{source_path.relative_to(python_root)}:{node.lineno}'
                    for alias in node.names
                    if alias.name == 'chromadb' or alias.name.startswith('chromadb.')
                )
            elif isinstance(node, ast.ImportFrom) and node.module:
                if node.module == 'chromadb' or node.module.startswith('chromadb.'):
                    imports.append(
                        f'{source_path.relative_to(python_root)}:{node.lineno}'
                    )

    assert imports == []


def test_requests_contains_temp_file_fix():
    """Requests должен включать исправление CVE-2026-25645."""
    requests_requirement = next(
        requirement
        for requirement in _load_requirements()
        if requirement.name.lower() == 'requests'
    )
    pinned_version = next(iter(requests_requirement.specifier)).version

    assert Version(pinned_version) >= Version('2.33.0')
