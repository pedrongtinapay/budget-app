@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File stop_server.ps1
start "BudgetApp" "%~dp0start_server.bat"
exit
