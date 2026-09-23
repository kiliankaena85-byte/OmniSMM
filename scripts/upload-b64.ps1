# Upload a file to remote server via base64 chunks through SSH stdin
param(
    [string]$LocalFile = "smmplan_src.zip",
    [string]$RemotePath = "/tmp/smmplan_src.zip",
    [string]$RemoteHost = "root@smmplan.pro",
    [int]$ChunkSize = 8000
)

$bytes = [System.IO.File]::ReadAllBytes($LocalFile)
$b64 = [System.Convert]::ToBase64String($bytes)
$total = $b64.Length
$parts = [Math]::Ceiling($total / $ChunkSize)

Write-Host "File: $LocalFile ($([Math]::Round($bytes.Length/1MB,1))MB), Base64: $([Math]::Round($total/1MB,1))MB, Parts: $parts"

# Clear remote file
ssh $RemoteHost "rm -f $RemotePath.b64"

for ($i = 0; $i -lt $parts; $i++) {
    $start = $i * $ChunkSize
    $len = [Math]::Min($ChunkSize, $total - $start)
    $chunk = $b64.Substring($start, $len)
    
    # Use stdin pipe to avoid command line length limits
    $chunk | ssh $RemoteHost "cat >> $RemotePath.b64"
    
    if ($i % 50 -eq 0 -or $i -eq $parts - 1) {
        $pct = [Math]::Round(($i + 1) / $parts * 100, 1)
        Write-Host "  $pct% ($($i+1)/$parts)"
    }
}

# Decode on server
Write-Host "Decoding on server..."
ssh $RemoteHost "cat $RemotePath.b64 | tr -d '\n' | base64 -d > $RemotePath && rm $RemotePath.b64 && ls -lh $RemotePath && echo DONE"
