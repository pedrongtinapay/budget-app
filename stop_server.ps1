# Stop the BudgetAppServer python process started from this folder
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -like "*server.py*" -and $_.CommandLine -like "*budget-app*" }
if (-not $procs) { Write-Output "No matching process found." ; exit 0 }
$procs | ForEach-Object { Write-Output "Stopping PID $($_.ProcessId)"; Stop-Process -Id $_.ProcessId -Force }
