# docker-mem-audit.ps1 — Docker Container Memory Audit & Risk Assessment
[CmdletBinding()]
param(
    [int]$WarningThresholdPercent = 80,
    [int]$CriticalThresholdPercent = 92
)

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "   DOCKER MEMORY AUDIT & OOM RISK ASSESSMENT (2026)" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verify Docker daemon is accessible
try {
    $dockerInfo = docker info --format '{{.OSType}} (CgroupVersion: {{.CgroupVersion}})' 2>$null
    if (-not $dockerInfo) {
        Write-Warning "Docker daemon is unreachable or not running. Check Docker Desktop / WSL2."
        exit 1
    }
    Write-Host "[OK] Docker Engine is active: $dockerInfo" -ForegroundColor Green
} catch {
    Write-Error "Docker CLI invocation error: $_"
    exit 1
}

# 2. Query all containers
$rawJson = docker ps -a --format '{{json .}}'
if (-not $rawJson) {
    Write-Host "No active or stopped containers found." -ForegroundColor Yellow
    exit 0
}

$containersJson = $rawJson | ForEach-Object { ConvertFrom-Json $_ }

$results = @()

foreach ($c in $containersJson) {
    $id = $c.ID
    $name = $c.Names

    $inspectRaw = docker inspect $id | ConvertFrom-Json
    $inspect = $inspectRaw[0]

    $state = $inspect.State
    $exitCode = $state.ExitCode
    $oomKilled = $state.OOMKilled
    $running = $state.Running

    $hostConfig = $inspect.HostConfig
    $memoryLimitBytes = [int64]$hostConfig.Memory
    $memoryResBytes = [int64]$hostConfig.MemoryReservation

    $limitStr = if ($memoryLimitBytes -eq 0) { "UNLIMITED" } else { "$([math]::Round($memoryLimitBytes / 1MB, 1)) MB" }
    $resStr = if ($memoryResBytes -eq 0) { "NONE" } else { "$([math]::Round($memoryResBytes / 1MB, 1)) MB" }

    $riskStatus = "OK"
    $riskColor = "Green"

    if ($oomKilled -eq $true -or $exitCode -eq 137) {
        $riskStatus = "CRITICAL (OOM KILLED / EXIT 137)"
        $riskColor = "Red"
    } elseif ($memoryLimitBytes -eq 0) {
        $riskStatus = "WARNING (No Memory Limit)"
        $riskColor = "Yellow"
    }

    $results += [PSCustomObject]@{
        Name       = $name
        Status     = if ($running) { "Running" } else { "Exited ($exitCode)" }
        Limit      = $limitStr
        Reserved   = $resStr
        OOMKilled  = if ($oomKilled) { "YES" } else { "NO" }
        Assessment = $riskStatus
        Color      = $riskColor
    }
}

# 3. Print container summary table
Write-Host "Container Memory Configuration Inspection:" -ForegroundColor Cyan
foreach ($r in $results) {
    Write-Host ("- {0,-25} | {1,-14} | Limit: {2,-10} | Res: {3,-8} | OOM: {4,-3} | {5}" -f `
        $r.Name, $r.Status, $r.Limit, $r.Reserved, $r.OOMKilled, $r.Assessment) -ForegroundColor $r.Color
}

# 4. Live memory consumption snapshot
Write-Host ""
Write-Host "Live Memory Consumption Snapshot (docker stats):" -ForegroundColor Cyan
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.PIDs}}"

Write-Host ""
Write-Host "Recommendations:" -ForegroundColor Yellow
Write-Host "1. Ensure all production containers have hard limits set (--memory)."
Write-Host "2. For Node.js containers, set NODE_OPTIONS=--max-old-space-size to 75% of container limit."
Write-Host "3. For crash analysis guidelines, refer to: references/oom_killer_forensics.md"
Write-Host ""
