Autostart (Windows)

1. Prepare virtual environment (if not already):
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt

2. Test server manually:
   start_server.bat
   Open http://localhost:5000 to verify the app works.

3. Register autostart (creates a Scheduled Task that runs at logon):
   Right-click register_autostart.ps1 and choose "Run with PowerShell", or run in an elevated PowerShell:
   powershell -ExecutionPolicy Bypass -File register_autostart.ps1

Notes:
- The scheduled task runs the start_server.bat which will prefer venv\Scripts\python.exe if it exists; otherwise it runs system python.
- If you move the project folder, re-run register_autostart.ps1 to update the task.
- To remove the scheduled task use:
  schtasks /Delete /TN "BudgetAppServer" /F
