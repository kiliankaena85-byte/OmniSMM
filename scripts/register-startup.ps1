# PowerShell script to register SMMplan Bot in Windows Task Scheduler for 100% automatic boot
$taskName = "SMMplan_Telegram_Bot_Autostart"
$vbsPath = "D:\SMM_plan_2\scripts\start-bot-background.vbs"

Write-Host "Registering $taskName in Windows Task Scheduler..."

$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsPath`"" -WorkingDirectory "D:\SMM_plan_2"
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force
    Write-Host "[OK] Task $taskName registered successfully! Bot will automatically start on boot/login."
} catch {
    Write-Host "[WARN] Task Scheduler registration error: " $_.Exception.Message
    
    # Fallback: create shortcut in Windows Startup folder
    $startupFolder = [Environment]::GetFolderPath("Startup")
    $shortcutPath = Join-Path $startupFolder "SMMplan_Bot_Autostart.lnk"
    $wsh = New-Object -ComObject WScript.Shell
    $shortcut = $wsh.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = "wscript.exe"
    $shortcut.Arguments = "`"$vbsPath`""
    $shortcut.WorkingDirectory = "D:\SMM_plan_2"
    $shortcut.Save()
    Write-Host "[OK] Created Startup shortcut in $shortcutPath"
}
