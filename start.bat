@echo off
chcp 65001 >nul
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=0
start "" "node_modules\electron\dist\electron.exe" .
