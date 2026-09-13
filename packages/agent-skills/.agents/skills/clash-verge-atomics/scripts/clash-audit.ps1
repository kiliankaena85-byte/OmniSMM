<#
.SYNOPSIS
    Комплексный атомарный аудит состояния Clash Verge Rev и ядра Mihomo.
.DESCRIPTION
    Проверяет процессы, службу Windows, Named Pipe, текущий режим (Rule vs Global),
    наличие правил для зоны .ru и целостность Profile Enhancement.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "SilentlyContinue"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "       CLASH VERGE REV & MIHOMO CORE ATOMIC AUDIT               " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# 1. Проверка процессов
Write-Host "`n[1] Процессы в системе:" -ForegroundColor Yellow
$processes = Get-Process | Where-Object { $_.ProcessName -match "clash|mihomo" }
if ($processes) {
    $processes | Select-Object Id, ProcessName, @{Name="RAM(MB)"; Expression={[math]::Round($_.WorkingSet64/1MB, 2)}} | Format-Table -AutoSize
} else {
    Write-Host "[-] Процессы Clash Verge / Mihomo НЕ найдены!" -ForegroundColor Red
}

# 2. Проверка службы Windows
Write-Host "[2] Служба Windows (clash_verge_service):" -ForegroundColor Yellow
$service = Get-Service -Name "clash_verge_service"
if ($service) {
    Write-Host "[+] Статус службы: $($service.Status)" -ForegroundColor Green
} else {
    Write-Host "[-] Служба clash_verge_service не установлена!" -ForegroundColor Red
}

# 3. Проверка Named Pipe и опрос REST API ядра
Write-Host "`n[3] Связь с ядром через Named Pipe (\\.\pipe\verge-mihomo):" -ForegroundColor Yellow
$pipe = New-Object System.IO.Pipes.NamedPipeClientStream(".", "verge-mihomo", [System.IO.Pipes.PipeDirection]::InOut)
$pipeConnected = $false
try {
    $pipe.Connect(2000)
    $writer = New-Object System.IO.StreamWriter($pipe, [System.Text.Encoding]::ASCII)
    $reader = New-Object System.IO.StreamReader($pipe, [System.Text.Encoding]::UTF8)

    # Запрос версии
    $req = "GET /version HTTP/1.1`r`nHost: localhost`r`nAuthorization: Bearer set-your-secret`r`nConnection: close`r`n`r`n"
    $writer.Write($req)
    $writer.Flush()
    $rawVersion = $reader.ReadToEnd()
    $versionJson = ($rawVersion -split "`r`n`r`n", 2)[1]
    Write-Host "[+] Ядро Mihomo ответило: $versionJson" -ForegroundColor Green
    $pipeConnected = $true
} catch {
    Write-Host "[-] Не удалось подключиться к именованному каналу: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    if ($pipe) { $pipe.Dispose() }
}

# 4. Проверка активного режима
if ($pipeConnected) {
    $pipe2 = New-Object System.IO.Pipes.NamedPipeClientStream(".", "verge-mihomo", [System.IO.Pipes.PipeDirection]::InOut)
    try {
        $pipe2.Connect(2000)
        $writer2 = New-Object System.IO.StreamWriter($pipe2, [System.Text.Encoding]::ASCII)
        $reader2 = New-Object System.IO.StreamReader($pipe2, [System.Text.Encoding]::UTF8)
        $req2 = "GET /configs HTTP/1.1`r`nHost: localhost`r`nAuthorization: Bearer set-your-secret`r`nConnection: close`r`n`r`n"
        $writer2.Write($req2)
        $writer2.Flush()
        $rawConfig = $reader2.ReadToEnd()
        $configJson = ($rawConfig -split "`r`n`r`n", 2)[1] | ConvertFrom-Json
        
        Write-Host "`n[4] Параметры маршрутизации ядра:" -ForegroundColor Yellow
        $modeColor = if ($configJson.mode -eq "rule") { "Green" } else { "Red" }
        Write-Host "  * Активный режим (mode): " -NoNewline
        Write-Host "$($configJson.mode)" -ForegroundColor $modeColor
        if ($configJson.mode -ne "rule") {
            Write-Host "  ⚠️ ВНИМАНИЕ: Режим '$($configJson.mode)' игнорирует правила! Требуется переключить в 'rule'!" -ForegroundColor Red
        }
        Write-Host "  * Режим TUN: $($configJson.tun.enable) (Device: $($configJson.tun.device), Stack: $($configJson.tun.stack))"
        Write-Host "  * Порты: Mixed=$($configJson.'mixed-port'), Redir=$($configJson.'redir-port')"
    } catch {
        Write-Host "[-] Ошибка чтения конфигурации: $($_.Exception.Message)" -ForegroundColor Red
    } finally {
        if ($pipe2) { $pipe2.Dispose() }
    }
}

# 5. Проверка файлов конфигурации
Write-Host "`n[5] Аудит файлов конфигурации:" -ForegroundColor Yellow
$appData = "$env:APPDATA\io.github.clash-verge-rev.clash-verge-rev"
$profilesYaml = "$appData\profiles.yaml"
if (Test-Path $profilesYaml) {
    Write-Host "[+] profiles.yaml найден" -ForegroundColor Green
    $profiles = Get-Content $profilesYaml -Raw
    if ($profiles -match "current:\s*(\w+)") {
        $currentUid = $matches[1]
        Write-Host "  * Текущий активный профиль: $currentUid"
    }
}

$rulesFile = Get-ChildItem -Path "$appData\profiles" -Filter "*rSIX*.yaml" | Select-Object -First 1
if ($rulesFile) {
    $rulesContent = Get-Content $rulesFile.FullName -Raw
    $hasRuRules = ($rulesContent -match "DOMAIN-SUFFIX,\s*ru,\s*DIRECT")
    Write-Host "  * Файл расширения правил: $($rulesFile.Name)"
    if ($hasRuRules) {
        Write-Host "[+] Правила прямого доступа (.ru, DIRECT) присутствуют в prepend" -ForegroundColor Green
    } else {
        Write-Host "[-] Правила зоны .ru ОТСУТСТВУЮТ в prepend!" -ForegroundColor Red
    }
}

Write-Host "`n================================================================" -ForegroundColor Cyan
