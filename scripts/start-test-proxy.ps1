# ==============================================================================
#  scripts/start-test-proxy.ps1
#  Запускает прозрачный прокси для test.smmplan.pro
#  Использование: .\scripts\start-test-proxy.ps1 -CfToken "YOUR_TOKEN"
# ==============================================================================
param(
    [Parameter(Mandatory=$true)]
    [string]$CfToken
)

$ErrorActionPreference = "Stop"
$TunnelLog = "$env:TEMP\smmplan_tunnel.log"

Write-Host "`n=== SMMplan Test Proxy Launcher ===" -ForegroundColor Cyan
Write-Host "1. Stopping any previous SSH tunnel processes..."
Get-Process -Name ssh -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "2. Installing SSH in Docker container (if needed)..."
docker exec -u root smmplan_web apk add --no-cache openssh-client *>$null

Write-Host "3. Starting localhost.run SSH tunnel inside Docker container..."
# Remove old log
docker exec smmplan_web sh -c "rm -f /tmp/tunnel.log" *>$null
# Start tunnel in background inside the container
docker exec -u root -d smmplan_web sh -c "ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 80:localhost:3000 nokey@localhost.run > /tmp/tunnel.log 2>&1"

Write-Host "4. Waiting for tunnel URL..." -NoNewline
$tunnelUrl = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    Write-Host "." -NoNewline
    $log = docker exec smmplan_web cat /tmp/tunnel.log 2>$null
    if ($log -match 'https://([a-z0-9]+\.lhr\.life)') {
        $tunnelUrl = "https://$($Matches[1])"
        break
    }
}

if (-not $tunnelUrl) {
    Write-Host "`n❌ Failed to get tunnel URL. Check Docker logs." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "   ✅ Tunnel is live: $tunnelUrl" -ForegroundColor Green

Write-Host "`n5. Deploying Cloudflare Worker reverse-proxy..."
$env:CLOUDFLARE_API_TOKEN = $CfToken
$env:TUNNEL_ORIGIN = $tunnelUrl
node_modules\.bin\tsx scripts\cloudflare\deploy-test-proxy-worker.ts

Write-Host "`n=== Done! ===" -ForegroundColor Green
Write-Host "🌐 Open: https://test.smmplan.pro" -ForegroundColor Yellow
Write-Host "⚠️  Keep this session open — closing it kills the tunnel!" -ForegroundColor DarkYellow
