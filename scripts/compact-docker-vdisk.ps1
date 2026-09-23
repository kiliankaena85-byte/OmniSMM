# Compact Docker VHDX
$vhdxPath = "$env:LOCALAPPDATA\Docker\wsl\disk\docker_data.vhdx"
if (-not (Test-Path $vhdxPath)) {
    $vhdxPath = "$env:LOCALAPPDATA\Docker\wsl\data\ext4.vhdx"
}

Write-Host "Shutting down WSL..."
wsl --shutdown

$diskpartScript = @"
select vdisk file="$vhdxPath"
attach vdisk readonly
compact vdisk
detach vdisk
exit
"@

$tmpFile = "$env:TEMP\compact_docker.txt"
Set-Content -Path $tmpFile -Value $diskpartScript -Encoding ASCII

Write-Host "Running diskpart compaction on $vhdxPath..."
diskpart /s $tmpFile

Remove-Item -Path $tmpFile -Force -ErrorAction SilentlyContinue
Write-Host "Compaction completed!"
