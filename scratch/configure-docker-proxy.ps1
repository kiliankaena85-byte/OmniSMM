# 1. Stop all running Docker Desktop components
Write-Host "Stopping Docker Desktop..."
Get-Process -Name "Docker Desktop", "com.docker.backend", "vpnkit" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# 2. Write new settings-store.json with proxy settings
$settingsPath = "$env:APPDATA\Docker\settings-store.json"
$settingsJson = @'
{
  "AutoDownloadUpdates": true,
  "AutoPauseTimeoutSeconds": 900,
  "AutoStart": false,
  "DisplayedOnboarding": true,
  "EnableDockerAI": true,
  "EnableIntegrationWithDefaultWslDistro": false,
  "LastContainerdSnapshotterEnable": 1754227866,
  "LicenseTermsVersion": 2,
  "SettingsVersion": 43,
  "UpdateInstallTime": 0,
  "UseContainerdSnapshotter": true,
  "OverrideProxyHttp": "http://127.0.0.1:7897",
  "OverrideProxyHttps": "http://127.0.0.1:7897",
  "OverrideProxyExclude": "localhost,127.0.0.1",
  "UseOverrideProxy": true
}
'@

Write-Host "Writing proxy configurations to settings-store.json at $settingsPath..."
Set-Content -Path $settingsPath -Value $settingsJson -Encoding UTF8

# 3. Restart Docker Desktop
Write-Host "Restarting Docker Desktop..."
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# 4. Wait for Docker daemon to be ready
Write-Host "Waiting for Docker daemon to initialize with proxy settings..."
$timeout = 90
$elapsed = 0
while ($elapsed -lt $timeout) {
    & docker ps > $null 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Docker daemon is ready and configured with proxy!"
        exit 0
    }
    Start-Sleep -Seconds 5
    $elapsed += 5
    Write-Host "Waiting for Docker daemon... ($elapsed seconds)"
}
Write-Host "Docker daemon failed to start within $timeout seconds."
exit 1
