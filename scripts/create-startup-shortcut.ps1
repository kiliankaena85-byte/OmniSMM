# Create silent autostart launcher in user's Windows Startup folder
$StartupFolder = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$VbsLauncher = "$StartupFolder\SMMplan_Autostart.vbs"
$PsScript = "D:\SMM_plan_2\scripts\auto-start-smmplan.ps1"

$VbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$PsScript""", 0, False
"@

Set-Content -Path $VbsLauncher -Value $VbsContent -Encoding ASCII
Write-Host "✅ Silent autostart launcher created at: $VbsLauncher"
