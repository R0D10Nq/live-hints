# --- UTF-8 для корректного вывода кириллицы ---
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [Console]::OutputEncoding

# Live Hints - Development Setup Script
# RTX 5060 Ti 16GB - GPU режим для STT и LLM

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LIVE HINTS - GPU SETUP" -ForegroundColor Cyan  
Write-Host "  RTX 5060 Ti 16GB" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Проверка NVIDIA драйверов
Write-Host "`n[1/6] Проверка NVIDIA GPU..." -ForegroundColor Yellow
$nvidiaSmi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
if (-not $nvidiaSmi) {
    Write-Host "ОШИБКА: nvidia-smi не найден. Установите NVIDIA драйверы." -ForegroundColor Red
    exit 1
}
nvidia-smi --query-gpu=name, memory.total, driver_version --format=csv, noheader
Write-Host "GPU найден!" -ForegroundColor Green

# 2. Установка Python зависимостей с CUDA
Write-Host "`n[2/6] Установка Python зависимостей для GPU..." -ForegroundColor Yellow

# Удаляем старые версии
pip uninstall -y faster-whisper ctranslate2 2>$null

# Устанавливаем с CUDA 12 поддержкой
pip install --upgrade pip
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install faster-whisper
pip install nvidia-cublas-cu12 nvidia-cudnn-cu12

# Остальные зависимости
pip install -r python/requirements.txt

Write-Host "Python зависимости установлены!" -ForegroundColor Green

# 3. Скачивание cuDNN библиотек для Windows
Write-Host "`n[3/6] Проверка cuDNN библиотек..." -ForegroundColor Yellow

$cudnnDll = "cudnn_ops64_9.dll"
$cudnnPath = Join-Path $env:USERPROFILE ".cache\cudnn"

if (-not (Test-Path (Join-Path $cudnnPath $cudnnDll))) {
    Write-Host "Скачивание cuDNN библиотек..." -ForegroundColor Yellow
    
    # Создаём директорию
    New-Item -ItemType Directory -Force -Path $cudnnPath | Out-Null
    
    # URL из Purfview репозитория
    $cudnnUrl = "https://github.com/Purfview/whisper-standalone-win/releases/download/libs/cuDNN9.5.1_CUDA12.6_win_x64_v2.7z"
    $cudnnArchive = Join-Path $cudnnPath "cudnn.7z"
    
    # Скачиваем
    Invoke-WebRequest -Uri $cudnnUrl -OutFile $cudnnArchive -UseBasicParsing
    
    # Распаковываем (нужен 7-zip)
    $7zip = "C:\Program Files\7-Zip\7z.exe"
    if (Test-Path $7zip) {
        & $7zip x $cudnnArchive -o"$cudnnPath" -y
        Write-Host "cuDNN распакован!" -ForegroundColor Green
    }
    else {
        Write-Host "ВНИМАНИЕ: Установите 7-Zip и распакуйте $cudnnArchive в $cudnnPath" -ForegroundColor Yellow
    }
}

# Добавляем в PATH
$env:PATH = "$cudnnPath;$env:PATH"
[Environment]::SetEnvironmentVariable("PATH", "$cudnnPath;$([Environment]::GetEnvironmentVariable('PATH', 'User'))", 'User')
Write-Host "cuDNN путь добавлен в PATH" -ForegroundColor Green

# 4. Установка Ollama модели
Write-Host "`n[4/6] Проверка Ollama..." -ForegroundColor Yellow

$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) {
    Write-Host "ОШИБКА: Ollama не установлен. Скачайте с https://ollama.ai/" -ForegroundColor Red
}
else {
    Write-Host "Загрузка модели qwen2.5:7b (быстрая, качественная)..." -ForegroundColor Yellow
    ollama pull qwen2.5:7b
    Write-Host "Модель загружена!" -ForegroundColor Green
}

# 5. Установка Node.js зависимостей
Write-Host "`n[5/6] Установка Node.js зависимостей..." -ForegroundColor Yellow
npm install
Write-Host "Node.js зависимости установлены!" -ForegroundColor Green

# 6. Проверка GPU для faster-whisper
Write-Host "`n[6/6] Тест GPU для faster-whisper..." -ForegroundColor Yellow

$testScript = @"
import sys
try:
    from faster_whisper import WhisperModel
    model = WhisperModel('tiny', device='cuda', compute_type='float16')
    print('GPU: OK - faster-whisper работает на CUDA')
    sys.exit(0)
except Exception as e:
    print(f'GPU: ОШИБКА - {e}')
    sys.exit(1)
"@

$testScript | python -

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "  SETUP ЗАВЕРШЁН УСПЕШНО!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "`nЗапуск серверов:" -ForegroundColor Cyan
    Write-Host "  Терминал 1: python python/stt_server.py" -ForegroundColor White
    Write-Host "  Терминал 2: python python/llm_server.py" -ForegroundColor White
    Write-Host "  Терминал 3: npm start" -ForegroundColor White
}
else {
    Write-Host "`nПРОБЛЕМА: GPU не работает. Проверьте:" -ForegroundColor Red
    Write-Host "  1. NVIDIA драйверы обновлены" -ForegroundColor Yellow
    Write-Host "  2. cuDNN библиотеки в PATH" -ForegroundColor Yellow
    Write-Host "  3. CUDA 12.x установлен" -ForegroundColor Yellow
}
