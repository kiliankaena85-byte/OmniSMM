$cloudflaredPath = "D:\SMM_plan_2\cloudflared.exe"
$token = $env:CLOUDFLARE_TUNNEL_TOKEN
if (-not $token) {
    Write-Host "ERROR: CLOUDFLARE_TUNNEL_TOKEN environment variable is not set." -ForegroundColor Red
    exit 1
}

Write-Host "Checking cloudflared executable..."
if (-not (Test-Path $cloudflaredPath)) {
    Write-Host "ERROR: cloudflared.exe not found at $cloudflaredPath"
    exit 1
}

$svc = Get-Service -Name "Cloudflared" -ErrorAction SilentlyContinue

if ($svc) {
    Write-Host "Cloudflared service already installed. Status: " $svc.Status
    if ($svc.Status -ne "Running") {
        Write-Host "Starting Cloudflared service..."
        Start-Service -Name "Cloudflared"
    }
} else {
    Write-Host "Installing Cloudflared service..."
    & $cloudflaredPath service install $token
    Start-Sleep -Seconds 2
    Start-Service -Name "Cloudflared" -ErrorAction SilentlyContinue
}

Set-Service -Name "Cloudflared" -StartupType Automatic -ErrorAction SilentlyContinue

$finalSvc = Get-Service -Name "Cloudflared" -ErrorAction SilentlyContinue
if ($finalSvc) {
    Write-Host "Final Status: " $finalSvc.Status
    Write-Host "Startup Type: Automatic"
}
