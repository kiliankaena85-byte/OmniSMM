# SMMplan Self-Healing Health Watchdog
# Checks all services, Docker containers, and Telegram bot container

Write-Host "======================================================================"
Write-Host "            SMMplan SELF-HEALING SYSTEM WATCHDOG                      "
Write-Host "======================================================================"

function Check-ContainerStatus ([string]$c) {
    $inspectOutput = docker inspect -f '{{.State.Status}}' $c 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   [ERROR] Container '$c' NOT FOUND (non-existent container or image)"
        return
    }

    $status = ($inspectOutput | Out-String).Trim()
    if ($status -eq "running") {
        Write-Host "   [OK] Container $c -> RUNNING"
    } else {
        Write-Host "   [WARN] Container $c is in state '$status'. Attempting to start..."
        docker start $c | Out-Null
        Start-Sleep -Seconds 2
        $recheckOutput = docker inspect -f '{{.State.Status}}' $c 2>$null
        $recheck = if ($recheckOutput) { ($recheckOutput | Out-String).Trim() } else { "unknown" }
        if ($recheck -eq "running") {
            Write-Host "   [OK] Container $c -> RUNNING (restarted successfully)"
        } else {
            Write-Host "   [ERROR] Container $c failed to start (status: '$recheck')"
        }
    }
}

Write-Host "1. Checking Docker Containers:"
$containers = @("smmplan_web", "smmplan_lite_worker", "smmplan_bot", "smmplan_lite_db", "smmplan_lite_redis", "smmplan_clash")

foreach ($c in $containers) {
    Check-ContainerStatus -c $c
}

Write-Host "`n2. Guarding Against Host Telegram Bot Split-Brain & Inspecting smmplan_bot:"
# Ensure no rogue host node processes are running to eliminate split-brain with Docker container
$hostBotProcesses = Get-WmiObject Win32_Process -Filter "name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object { 
    $_.CommandLine -match 'node(\.exe)?\s+.*(dist[/\\]bot\.js|src[/\\]bot[/\\]index\.ts)' -and
    $_.CommandLine -notmatch 'vitest|eslint|typescript-language-server|vscode'
}

if ($hostBotProcesses) {
    Write-Host "   [WARN] Detected rogue host Telegram Bot process. Terminating to prevent split-brain 409 Conflict..."
    $hostBotProcesses | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
} else {
    Write-Host "   [OK] No rogue host Telegram bot processes detected"
}

Check-ContainerStatus -c "smmplan_bot"

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

