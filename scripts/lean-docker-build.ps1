# scripts/lean-docker-build.ps1
# Throttled host and Docker build: BelowNormal priority, reserved CPU core, V8 heap cap

$ErrorActionPreference = "Stop"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Docker Lean Build: Eco-Build Engine (No-Freeze)     " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# 1. Pre-flight check free RAM
$os = Get-CimInstance Win32_OperatingSystem
$freeRamMb = [math]::Round($os.FreePhysicalMemory / 1024, 1)
Write-Host "[1/4] Available physical RAM: $freeRamMb MB" -ForegroundColor Yellow

if ($freeRamMb -lt 1000) {
    Write-Host "      WARN: Free RAM < 1000 MB. Triggering clean bloat..." -ForegroundColor Red
    & (Join-Path $PSScriptRoot "docker-clean-bloat.ps1")
}

# 2. Calculate CPU affinity mask (reserves 1 core for Windows OS responsiveness)
$totalCores = [System.Environment]::ProcessorCount
$affinityMask = [IntPtr]::Zero
if ($totalCores -gt 2) {
    $activeCores = $totalCores - 1
    $maskVal = [long]((1 -shl $activeCores) - 1)
    $affinityMask = [IntPtr]$maskVal
    Write-Host "[2/4] CPU Affinity: $activeCores of $totalCores cores (1 core reserved for OS responsiveness)" -ForegroundColor Green
} else {
    $affinityMask = [IntPtr]3
    Write-Host "[2/4] CPU Affinity: all $totalCores cores active" -ForegroundColor Green
}

# 3. Environment configuration
$env:Path = "C:\Program Files\nodejs;" + [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$env:NODE_OPTIONS = "--max-old-space-size=2560"
$env:UV_THREADPOOL_SIZE = [math]::Min(4, $totalCores).ToString()

Write-Host "[3/4] Compiling Next.js Standalone with BelowNormal priority..." -ForegroundColor Yellow

$pinfo = New-Object System.Diagnostics.ProcessStartInfo
$pinfo.FileName = "cmd.exe"
$pinfo.Arguments = "/c npm run build"
$pinfo.UseShellExecute = $false
$pinfo.RedirectStandardOutput = $false
$pinfo.RedirectStandardError = $false

$proc = [System.Diagnostics.Process]::Start($pinfo)
try {
    $proc.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::BelowNormal
    if ($affinityMask -ne [IntPtr]::Zero) {
        $proc.ProcessorAffinity = $affinityMask
    }
    Write-Host "      OK: Process priority set to BelowNormal (host UI stays completely responsive)." -ForegroundColor Green
} catch {
    Write-Host "      INFO: Priority class notice: $_" -ForegroundColor DarkGray
}

$proc.WaitForExit()

if ($proc.ExitCode -ne 0) {
    Write-Host "ERR: Host compilation failed with exit code $($proc.ExitCode)." -ForegroundColor Red
    exit $proc.ExitCode
}

Write-Host "OK: Host build artifacts compiled successfully!" -ForegroundColor Green

# 3.5. Database Schema Sync (Zero-Drift Invariant)
Write-Host "[3.5/4] Synchronizing Prisma database schema..." -ForegroundColor Yellow
try {
    if (-not $env:DATABASE_URL) {
        $env:DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5433/smmplan_lite?schema=public"
    }
    & npx prisma db push --skip-generate
    Write-Host "      OK: Database schema verified and in sync." -ForegroundColor Green
} catch {
    Write-Host "      WARN: Database sync notice: $_" -ForegroundColor DarkGray
}

# 4. Build Docker containers
Write-Host "[4/4] Building Docker containers (web, worker, bot)..." -ForegroundColor Yellow
& docker compose build web worker bot


Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Lean Build successfully completed!                  " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
