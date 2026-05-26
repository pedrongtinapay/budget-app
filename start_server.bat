@echo off
rem Start the Flask budget app from the project folder
cd /d "%~dp0"
rem Prefer virtualenv python if present
if exist "%~dp0venv\Scripts\python.exe" (
  "%~dp0venv\Scripts\python.exe" server.py
) else (
  python server.py
)
exit
