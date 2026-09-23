# ==============================================================================
#  SMMplan Automatic Startup & Tunnel Daemon (Windows Autostart)
# ==============================================================================

$LogDir = "D:\SMM_plan_2\logs"
if (!(Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}
$LogFile = "$LogDir\autostart.log"

function Log-Message($msg) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $msg"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

Log-Message "===================================================="
Log-Message "Starting SMMplan Auto-Startup Sequence..."

# 1. Ensure Tailscale Windows Service is running
$TailscaleExe = "C:\Program Files\Tailscale\tailscale.exe"
if (Test-Path $TailscaleExe) {
    Log-Message "Checking Tailscale status..."
    $status = & $TailscaleExe status --json | ConvertFrom-Json
    if ($status.BackendState -ne "Running") {
        Log-Message "Starting Tailscale backend..."
        & $TailscaleExe up --unattended
        Start-Sleep -Seconds 3
    }
    
    Log-Message "Activating Tailscale Funnel on port 3000..."
    & $TailscaleExe funnel --bg --yes 3000 | Out-Null
    Log-Message "Tailscale Funnel status: https://desktop-25m6el7.tailbb9d28.ts.net"
} else {
    Log-Message "WARNING: Tailscale executable not found at $TailscaleExe"
}

# 2. Ensure Docker containers are running
Log-Message "Ensuring Docker containers are up..."
Set-Location "D:\SMM_plan_2"
docker-compose up -d

Log-Message "SMMplan Startup Sequence Completed Successfully."
Log-Message "===================================================="
