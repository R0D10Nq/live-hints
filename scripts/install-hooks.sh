#!/bin/sh
#
# Скрипт установки git hooks для live-hints
#

echo "Установка git hooks для live-hints..."

# Проверяем, что мы в git репозитории
if [ ! -d .git ]; then
    echo "❌ Ошибка: не найден .git каталог"
    echo "   Запустите скрипт из корня репозитория"
    exit 1
fi

# Копируем hooks
cp .githooks/pre-commit .git/hooks/pre-commit 2>/dev/null
cp .githooks/commit-msg .git/hooks/commit-msg 2>/dev/null

# Делаем исполняемыми (для Unix систем)
chmod +x .git/hooks/pre-commit 2>/dev/null
chmod +x .git/hooks/commit-msg 2>/dev/null

echo "✅ Hooks установлены успешно"
echo ""
echo "Установленные hooks:"
echo "  - pre-commit: запускает тесты перед коммитом"
echo "  - commit-msg: проверяет формат сообщения коммита"
echo ""
echo "Для отключения hooks используйте: git commit --no-verify"
