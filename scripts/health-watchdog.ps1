# SMMplan Self-Healing Health Watchdog
# Checks all services, Docker containers, Telegram bot, and Cloudflare Tunnel

Write-Host "======================================================================"
Write-Host "            SMMplan SELF-HEALING SYSTEM WATCHDOG                      "
Write-Host "======================================================================"

Write-Host "1. Checking Docker Containers:"
$containers = @("smmplan_web", "smmplan_tunnel", "smmplan_lite_db", "smmplan_lite_redis")

foreach ($c in $containers) {
    $status = docker inspect -f '{{.State.Status}}' $c 2>$null
    if ($status -eq "running") {
        Write-Host "   [OK] Container $c -> RUNNING"
    } else {
        Write-Host "   [WARN] Container $c is $status. Attempting to start..."
        docker start $c | Out-Null
    }
}

Write-Host "`n2. Checking Telegram Bot Background Daemon:"
$botProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($botProcess) {
    Write-Host "   [OK] Telegram Bot Daemon Process -> RUNNING"
} else {
    Write-Host "   [WARN] Telegram Bot not detected. Starting background launcher..."
    Start-Process "wscript.exe" -ArgumentList "D:\SMM_plan_2\scripts\start-bot-background.vbs"
}

Write-Host "`n3. Checking External Health Endpoint (https://test.smmplan.pro/api/health):"
try {
    $response = Invoke-RestMethod -Uri "https://test.smmplan.pro/api/health" -Method Get -TimeoutSec 5
    if ($response.status -eq "healthy") {
        Write-Host "   [OK] https://test.smmplan.pro/ -> 200 OK (HEALTHY)"
    } else {
        Write-Host "   [WARN] Response: " $response.status
    }
} catch {
    Write-Host "   [ERROR] External endpoint unreachable: " $_.Exception.Message
}

Write-Host "`n======================================================================"
Write-Host "                       WATCHDOG CHECK COMPLETE                        "
Write-Host "======================================================================"
