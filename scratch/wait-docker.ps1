$timeout = 90
$elapsed = 0
while ($elapsed -lt $timeout) {
    & docker ps > $null 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Docker daemon is ready!"
        exit 0
    }
    Start-Sleep -Seconds 5
    $elapsed += 5
    Write-Host "Waiting for Docker daemon... ($elapsed seconds)"
}
Write-Host "Docker daemon failed to start within $timeout seconds."
exit 1
