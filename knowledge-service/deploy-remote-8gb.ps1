# =============================================================================
# OmniSMM 1.0 — Remote Memory Node Deploy Script (Windows 8GB DDR3)
# =============================================================================

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "🚀 Запуск узла векторной памяти OmniSMM (8GB DDR3 Profile)" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Проверка доступной оперативной памяти
try {
    $os = Get-CimInstance Win32_OperatingSystem
    $totalRamMb = [math]::Round($os.TotalVisibleMemorySize / 1024)
    Write-Host "📊 Общий объем RAM на хосте: $totalRamMb MB" -ForegroundColor Yellow
} catch {
    # ignore
}

# 2. Проверка Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Ошибка: Docker Desktop не установлен или не запущен." -ForegroundColor Red
    exit 1
}

# 3. Запуск Docker Compose
Write-Host "🐳 Сборка и запуск контейнеров (Qdrant + FastAPI + Indexer)..." -ForegroundColor Cyan
docker compose -f docker-compose.remote-8gb.yml up -d --build

Write-Host "⏳ Ожидание инициализации сервисов (5 сек)..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# 4. Проверка статуса
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8100/health" -TimeoutSec 3 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Узел векторной памяти успешно запущен и готов к работе!" -ForegroundColor Green
        Write-Host "🌐 Локальный адрес: http://localhost:8100" -ForegroundColor Cyan
    }
} catch {
    Write-Host "⚠️ Сервер инициализируется. Проверьте логи: docker compose -f docker-compose.remote-8gb.yml logs -f" -ForegroundColor Yellow
}

Write-Host "========================================================" -ForegroundColor Cyan
