$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Stop-Process -Name node -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Remove-Item tunnel.log -ErrorAction SilentlyContinue

Write-Host "Starting Worker..."
Start-Process -FilePath "node.exe" -ArgumentList "--env-file=.env dist/worker.js" -WorkingDirectory (Get-Location) -WindowStyle Hidden

Write-Host "Starting Next.js App..."
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx next dev -p 3000 -H 0.0.0.0" -WorkingDirectory (Get-Location) -WindowStyle Hidden

Write-Host "Starting Localtunnel..."
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx localtunnel --port 3000 > tunnel.log 2>&1" -WorkingDirectory (Get-Location) -WindowStyle Hidden

Start-Sleep -Seconds 7
Get-Content tunnel.log
