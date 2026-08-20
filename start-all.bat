@echo off
chcp 65001 >nul
title Live Hints - Автономный запуск
color 0A

:: Проверка наличия Python
python --version >nul 2>&1 || (
    echo [ОШИБКА] Python не найден в PATH. Установите Python 3.11+ и добавьте в PATH.
    pause
    exit /b 1
)

:: Пользователь должен самостоятельно закрыть старые процессы
echo [ПОДГОТОВКА] Подготовка к запуску...
timeout /t 2 /nobreak >nul

:: Запуск STT-сервера в фоновом режиме
echo [ЗАПУСК] Запуск STT-сервера (порт 8765)...
start "STT-сервер" cmd /c "python %~dp0python\stt_server.py --mode auto"
timeout /t 3 /nobreak >nul

:: Проверка готовности STT-сервера
netstat -an | findstr ":8765" | findstr LISTENING >nul 2>&1 || (
    echo [ПРЕДУПРЕЖДЕНИЕ] STT-сервер не запустился. Проверьте журналы.
)

:: Запуск LLM-сервера в фоновом режиме
echo [ЗАПУСК] Запуск LLM-сервера (порт 8766)...
start "LLM-сервер" cmd /c "python %~dp0python\llm_server.py"
timeout /t 2 /nobreak >nul

:: Проверка готовности LLM-сервера
netstat -an | findstr ":8766" | findstr LISTENING >nul 2>&1 || (
    echo [ПРЕДУПРЕЖДЕНИЕ] LLM-сервер не запустился. Проверьте журналы.
)

:: Запуск Ollama, если служба ещё не работает
curl -s http://localhost:11434/api/tags >nul 2>&1 || (
    echo [ЗАПУСК] Запуск Ollama...
    start "Сервер Ollama" cmd /c "ollama serve --port 11434"
    timeout /t 5 /nobreak >nul
)

:: Запуск приложения Electron
echo [ЗАПУСК] Запуск интерфейса Live Hints...
start "" "%~dp0dist\LiveHints-Portable-1.0.1.exe"

:: Состояние запущенных служб
echo.
echo ========================================
echo   Live Hints запущен!
echo   STT:   http://localhost:8765 (WebSocket)
echo   LLM:   http://localhost:8766 (HTTP/Swagger)
echo   Ollama: http://localhost:11434
echo ========================================
echo.
echo Чтобы остановить: закройте окно.
echo Логи в директории проекта.
echo.
pause
