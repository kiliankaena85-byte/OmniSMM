<#
.SYNOPSIS
    Автоматизированное тестирование маршрутизации Clash Verge и проверка логов ядра.
.EXAMPLE
    .\clash-route-test.ps1
#>

[CmdletBinding()]
param(
    [string[]]$Domains = @(
        "panel.smmtoolbox.ru",
        "primelike.happydesk.ru",
        "ya.ru",
        "api.ipify.org"
    )
)

$logPath = "$env:APPDATA\io.github.clash-verge-rev.clash-verge-rev\logs\service\service_latest.log"

Write-Host "=== Тестирование Сетевой Маршрутизации ===" -ForegroundColor Cyan

foreach ($domain in $Domains) {
    Write-Host "`n--> Проверка $domain..." -NoNewline
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $response = curl.exe -I -s --connect-timeout 4 "https://$domain" 2>$null
    $sw.Stop()

    if ($response) {
        $statusLine = ($response | Select-Object -First 1).Trim()
        Write-Host " [OK] ($($sw.ElapsedMilliseconds) ms) - $statusLine" -ForegroundColor Green
    } else {
        Write-Host " [FAIL/TIMEOUT]" -ForegroundColor Red
    }

    # Поиск решения маршрутизации в логе ядра
    if (Test-Path $logPath) {
        $matchLine = Get-Content $logPath -Tail 40 | Where-Object { $_ -match "$domain" } | Select-Object -Last 1
        if ($matchLine) {
            if ($matchLine -match "using DIRECT") {
                Write-Host "    Маршрут в ядре: DIRECT (Прямой доступ в РФ)" -ForegroundColor Green
            } elseif ($matchLine -match "using GLOBAL|match Match") {
                Write-Host "    Маршрут в ядре: PROXY (Через VPN-узел)" -ForegroundColor Yellow
            }
            Write-Host "    Лог: $matchLine" -ForegroundColor DarkGray
        }
    }
}
Write-Host "`n=== Тест завершен ===" -ForegroundColor Cyan
