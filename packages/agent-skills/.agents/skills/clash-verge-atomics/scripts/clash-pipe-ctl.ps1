<#
.SYNOPSIS
    CLI-инструмент прямого управления ядром Mihomo через Windows Named Pipe.
.EXAMPLE
    .\clash-pipe-ctl.ps1 -Action Status
    .\clash-pipe-ctl.ps1 -Action SwitchMode -Mode rule
    .\clash-pipe-ctl.ps1 -Action Reload
    .\clash-pipe-ctl.ps1 -Action FlushDns
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("Status", "Version", "SwitchMode", "Reload", "FlushDns", "ListRules")]
    [string]$Action,

    [Parameter(Mandatory=$false)]
    [ValidateSet("rule", "global", "direct")]
    [string]$Mode = "rule",

    [Parameter(Mandatory=$false)]
    [string]$Secret = "set-your-secret"
)

function Invoke-MihomoPipe {
    param(
        [string]$Method,
        [string]$Path,
        [string]$Body = ""
    )

    $pipe = New-Object System.IO.Pipes.NamedPipeClientStream(".", "verge-mihomo", [System.IO.Pipes.PipeDirection]::InOut)
    try {
        $pipe.Connect(3000)
        $writer = New-Object System.IO.StreamWriter($pipe, [System.Text.Encoding]::ASCII)
        $reader = New-Object System.IO.StreamReader($pipe, [System.Text.Encoding]::UTF8)

        $contentLength = [System.Text.Encoding]::UTF8.GetByteCount($Body)
        $req = "$Method $Path HTTP/1.1`r`n" +
               "Host: localhost`r`n" +
               "Authorization: Bearer $Secret`r`n" +
               "Content-Type: application/json`r`n" +
               "Content-Length: $contentLength`r`n" +
               "Connection: close`r`n`r`n" +
               $Body

        $writer.Write($req)
        $writer.Flush()
        $res = $reader.ReadToEnd()
        return $res
    } finally {
        if ($pipe) { $pipe.Dispose() }
    }
}

switch ($Action) {
    "Version" {
        $res = Invoke-MihomoPipe -Method "GET" -Path "/version"
        $json = ($res -split "`r`n`r`n", 2)[1]
        Write-Host "Версия ядра: $json" -ForegroundColor Green
    }
    "Status" {
        $res = Invoke-MihomoPipe -Method "GET" -Path "/configs"
        $json = ($res -split "`r`n`r`n", 2)[1] | ConvertFrom-Json
        Write-Host "=== Статус Mihomo ===" -ForegroundColor Cyan
        Write-Host "Режим (Mode): $($json.mode)" -ForegroundColor $(if ($json.mode -eq "rule") {"Green"} else {"Red"})
        Write-Host "TUN включен: $($json.tun.enable)"
        Write-Host "Стек TUN: $($json.tun.stack)"
        Write-Host "Mixed-Port: $($json.'mixed-port')"
    }
    "SwitchMode" {
        $body = "{`"mode`": `"$Mode`"}"
        $res = Invoke-MihomoPipe -Method "PATCH" -Path "/configs" -Body $body
        Write-Host "[+] Режим успешно переключен на: $Mode" -ForegroundColor Green
    }
    "Reload" {
        $configPath = "$env:APPDATA\io.github.clash-verge-rev.clash-verge-rev\clash-verge.yaml"
        $body = "{`"path`": `"$($configPath -replace '\\', '\\')`"}"
        Write-Host "Перезагрузка конфигурации из $configPath..." -ForegroundColor Yellow
        $res = Invoke-MihomoPipe -Method "PUT" -Path "/configs?force=true" -Body $body
        Write-Host "[+] Конфигурация успешно перезагружена в памяти ядра!" -ForegroundColor Green
    }
    "FlushDns" {
        $res = Invoke-MihomoPipe -Method "POST" -Path "/dns/flush"
        Write-Host "[+] Кеш DNS и Fake-IP успешно сброшен!" -ForegroundColor Green
    }
}
