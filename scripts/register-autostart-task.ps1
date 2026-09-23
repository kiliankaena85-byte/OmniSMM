# Register SMMplan AutoStart Task in Windows Task Scheduler
$TaskName = "SMMplan_AutoStart"
$ScriptPath = "D:\SMM_plan_2\scripts\auto-start-smmplan.ps1"

$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Trigger $Trigger -Action $Action -Settings $Settings -Description "Autostart SMMplan Docker and Tailscale Funnel on startup" -Force
Write-Host "✅ Successfully registered Scheduled Task: $TaskName"
