#!/usr/bin/env bash
set -e

# =============================================================================
# OmniSMM 1.0 — Remote Memory Node Deploy Script (Linux/Unix 8GB DDR3)
# =============================================================================

echo "========================================================"
echo "🚀 Запуск узла векторной памяти OmniSMM (8GB DDR3 Profile)"
echo "========================================================"

# 1. Проверка доступной оперативной памяти
if command -v free >/dev/null 2>&1; then
    TOTAL_MEM_MB=$(free -m | awk '/^Mem:/{print $2}')
    echo "📊 Общий объем RAM на хосте: ${TOTAL_MEM_MB} MB"
    if [ "$TOTAL_MEM_MB" -lt 6000 ]; then
        echo "⚠️ Предупреждение: Доступно менее 6 ГБ RAM. Контейнеры могут испытывать дефицит памяти."
    fi
fi

# 2. Проверка Docker
if ! command -v docker >/dev/null 2>&1; then
    echo "❌ Ошибка: Docker не установлен на данном ПК."
    exit 1
fi

# 3. Запуск Docker Compose
echo "🐳 Сборка и запуск контейнеров (Qdrant + FastAPI + Indexer)..."
docker compose -f docker-compose.remote-8gb.yml up -d --build

echo "⏳ Ожидание инициализации сервисов (5 сек)..."
sleep 5

# 4. Проверка статуса
if command -v curl >/dev/null 2>&1; then
    echo "🔍 Проверка Healthcheck на порту 8100..."
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8100/health || echo "000")
    if [ "$STATUS" = "200" ]; then
        echo "✅ Узел векторной памяти успешно запущен и готов к работе!"
        echo "🌐 Адрес для подключения: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'IP_ЭТОГО_ПК'):8100"
    else
        echo "⚠️ Сервер инициализируется (HTTP $STATUS). Проверьте логи: docker compose -f docker-compose.remote-8gb.yml logs -f"
    fi
fi
echo "========================================================"
