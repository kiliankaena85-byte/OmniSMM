# SMMplan Self-Healing Health Watchdog
# Checks all services, Docker containers, and Telegram bot container

Write-Host "======================================================================"
Write-Host "            SMMplan SELF-HEALING SYSTEM WATCHDOG                      "
Write-Host "======================================================================"

Write-Host "1. Checking Docker Containers:"
$containers = @("smmplan_web", "smmplan_lite_worker", "smmplan_bot", "smmplan_lite_db", "smmplan_lite_redis", "smmplan_clash")

foreach ($c in $containers) {
    $status = docker inspect -f '{{.State.Status}}' $c 2>$null
    if ($status -eq "running") {
        Write-Host "   [OK] Container $c -> RUNNING"
    } else {
        Write-Host "   [WARN] Container $c is '$status'. Attempting to start..."
        docker start $c | Out-Null
    }
}

Write-Host "`n2. Guarding Against Host Telegram Bot Split-Brain & Inspecting smmplan_bot:"
# Ensure no rogue host node processes are running to eliminate split-brain with Docker container
$hostBotProcesses = Get-WmiObject Win32_Process -Filter "name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "dist/bot|src/bot" }
if ($hostBotProcesses) {
    Write-Host "   [WARN] Detected rogue host Telegram Bot process. Terminating to prevent split-brain 409 Conflict..."
    $hostBotProcesses | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
} else {
    Write-Host "   [OK] No rogue host Telegram bot processes detected (Host VBS launcher eliminated)"
}

$botStatus = docker inspect -f '{{.State.Status}}' "smmplan_bot" 2>$null
if ($botStatus -eq "running") {
    Write-Host "   [OK] Telegram Bot Docker Container (smmplan_bot) -> RUNNING"
} else {
    Write-Host "   [WARN] Telegram Bot Container is '$botStatus'. Starting Docker container..."
    docker start "smmplan_bot" | Out-Null
}

Write-Host "`n3. Checking Web Health Endpoint (http://127.0.0.1:3000/api/health):"
try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health" -Method Get -TimeoutSec 5
    if ($response.status -eq "healthy") {
        Write-Host "   [OK] http://127.0.0.1:3000/api/health -> 200 OK (HEALTHY)"
    } else {
        Write-Host "   [WARN] Response: " $response.status
    }
} catch {
    Write-Host "   [ERROR] Web endpoint unreachable: " $_.Exception.Message
}

Write-Host "`n======================================================================"
Write-Host "                       WATCHDOG CHECK COMPLETE                        "
Write-Host "======================================================================"
