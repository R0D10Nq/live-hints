@echo off
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=0
node_modules\electron\dist\electron.exe .
