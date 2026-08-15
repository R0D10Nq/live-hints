@echo off
chcp 65001 >nul
title Live Hints - Standalone Launcher
color 0A

:: Check for Python
python --version >nul 2>&1 || (
    echo [ERROR] Python не найден в PATH. Установите Python 3.11+ и добавьте в PATH.
    pause
    exit /b 1
)

:: Note: Пользователь должен сам закрыть старые процессы
echo [INIT] Подготовка к запуску...
timeout /t 2 /nobreak >nul

:: Start STT server in background
echo [START] Запуск STT сервера (port 8765)...
start "STT Server" cmd /c "python %~dp0python\stt_server.py --mode auto"
timeout /t 3 /nobreak >nul

:: Check if STT is listening
netstat -an | findstr ":8765" | findstr LISTENING >nul 2>&1 || (
    echo [WARN] STT сервер не запустился. Проверьте логи.
)

:: Start LLM server in background  
echo [START] Запуск LLM сервера (port 8766)...
start "LLM Server" cmd /c "python %~dp0python\llm_server.py"
timeout /t 2 /nobreak >nul

:: Check if LLM is listening
netstat -an | findstr ":8766" | findstr LISTENING >nul 2>&1 || (
    echo [WARN] LLM сервер не запустился. Проверьте логи.
)

:: Start Ollama if not running
curl -s http://localhost:11434/api/tags >nul 2>&1 || (
    echo [START] Запуск Ollama...
    start "Ollama Server" cmd /c "ollama serve --port 11434"
    timeout /t 5 /nobreak >nul
)

:: Start Electron app
echo [START] Запуск Live Hints UI...
start "" "%~dp0dist\LiveHints-Portable-1.0.0.exe"

:: Status panel
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
