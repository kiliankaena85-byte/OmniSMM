# ==============================================================================
#  scripts/start-test-proxy.ps1
#  Запускает прозрачный прокси для test.smmplan.pro
#  Использование: .\scripts\start-test-proxy.ps1 -CfToken "YOUR_TOKEN"
# ==============================================================================
param(
    [string]$CfToken = "cfut_EFnUoQN8CInbcwzNchPSrx0oWPReaNK8jtlvqENH1dec0681"
)

$ErrorActionPreference = "Stop"

Write-Host "`n═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🚀 SMMplan Transparent Proxy for test.smmplan.pro   " -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "1. [Checking Docker Container smmplan_web]..."
$webState = docker inspect smmplan_web --format "{{.State.Status}}" 2>$null
if ($webState -ne "running") {
    Write-Host "   Starting docker containers..."
    docker-compose up -d web worker bot
    Start-Sleep -Seconds 3
}

Write-Host "2. [Ensuring SSH client is installed in container]..."
docker exec -u root smmplan_web apk add --no-cache openssh-client *>$null

Write-Host "3. [Starting background SSH tunnel via localhost.run]..."
docker exec -u root smmplan_web sh -c 'pkill -f "ssh.*localhost.run" 2>/dev/null; rm -f /tmp/tunnel.log; nohup ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -o ServerAliveCountMax=5 -o ExitOnForwardFailure=yes -R 80:127.0.0.1:3000 nokey@localhost.run > /tmp/tunnel.log 2>&1 &'

Write-Host "4. [Waiting for tunnel URL]..." -NoNewline
$tunnelUrl = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    Write-Host "." -NoNewline
    $log = docker exec smmplan_web sh -c 'cat /tmp/tunnel.log 2>/dev/null || true'
    if ($log -match 'https://([a-z0-9]+\.lhr\.life)') {
        $tunnelUrl = "https://$($Matches[1])"
        break
    }
}

if (-not $tunnelUrl) {
    Write-Host "`n❌ Failed to obtain tunnel URL. Check docker logs." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "   ✅ Tunnel is LIVE: $tunnelUrl" -ForegroundColor Green

Write-Host "`n5. [Deploying Cloudflare Worker Reverse-Proxy]..."
docker cp "$PSScriptRoot\cloudflare\deploy-test-proxy-worker.mjs" smmplan_web:/tmp/deploy-worker.mjs
docker exec -e CLOUDFLARE_API_TOKEN="$CfToken" -e TUNNEL_ORIGIN="$tunnelUrl" smmplan_web node /tmp/deploy-worker.mjs

Write-Host "`n═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  🎉 SUCCESS! test.smmplan.pro is now LIVE!" -ForegroundColor Green
Write-Host "  🌐 URL: https://test.smmplan.pro" -ForegroundColor Yellow
Write-Host "  🌐 SMMflux: https://test.smmplan.pro/?tenant=flux" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════`n" -ForegroundColor Green
