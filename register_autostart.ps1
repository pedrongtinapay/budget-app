# Register a Windows Scheduled Task to run start_server.bat at user logon.
# Run this PowerShell script as the current user (no admin required for a task created for the user).
$taskName = "BudgetAppServer"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$batPath = Join-Path $scriptDir 'start_server.bat'
$batPathQuoted = '"' + $batPath + '"'
$cmd = "schtasks /Create /SC ONLOGON /TN \"$taskName\" /TR $batPathQuoted /F"
Write-Output "Creating scheduled task: $cmd"
try {
    Invoke-Expression $cmd
    Write-Output "Scheduled task '$taskName' created. It will run at user logon."
} catch {
    Write-Error "Failed to create scheduled task: $_"
}
