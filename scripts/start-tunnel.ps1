$token = $env:CLOUDFLARE_TUNNEL_TOKEN
if (-not $token) {
    Write-Host "ERROR: CLOUDFLARE_TUNNEL_TOKEN environment variable is not set." -ForegroundColor Red
    exit 1
}
& "D:\SMM_plan_2\cloudflared.exe" tunnel --protocol http2 --edge-ip-version 4 --no-autoupdate --heartbeat-count 5 --heartbeat-interval 5s run --token $token
