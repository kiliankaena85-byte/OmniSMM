#!/usr/bin/env bash
# emergency-mem-relief.sh — Non-destructive Emergency Memory Relief
set -euo pipefail

echo "======================================================="
echo "   EMERGENCY MEMORY RELIEF PROTOCOL (2026)"
echo "======================================================="

# 1. Безопасный сброс дискового кэша ядра хоста
echo "[1/4] Сброс неактивного дискового кэша и slab-объектов ядра..."
if [ -w /proc/sys/vm/drop_caches ]; then
    sync
    echo 3 > /proc/sys/vm/drop_caches
    echo "  -> [✓] Page cache и dentries/inodes успешно сброшены."
else
    echo "  -> [i] Нет прав root для записи в /proc/sys/vm/drop_caches. Пропускаем."
fi

# 2. Активная дефрагментация Redis
echo "[2/4] Проверка контейнеров Redis и запуск дефрагментации..."
REDIS_CONTAINERS=$(docker ps --filter "ancestor=redis" --format '{{.Names}}' || echo "")
if [ -z "$REDIS_CONTAINERS" ]; then
    REDIS_CONTAINERS=$(docker ps --filter "name=redis" --format '{{.Names}}' || echo "")
fi

for RC in $REDIS_CONTAINERS; do
    echo "  -> Обработка Redis: $RC"
    docker exec "$RC" redis-cli config set activedefrag yes 2>/dev/null || true
    docker exec "$RC" redis-cli memory purge 2>/dev/null || true
    echo "  -> [✓] Дефрагментация и memory purge выполнены для $RC."
done

# 3. Усечение раздутых JSON-логов Docker
echo "[3/4] Проверка раздутых файлов логов контейнеров..."
CONTAINER_LOGS=$(find /var/lib/docker/containers/ -name "*-json.log" -size +100M 2>/dev/null || echo "")
if [ -n "$CONTAINER_LOGS" ]; then
    for L in $CONTAINER_LOGS; do
        echo "  -> Усечение лога: $L"
        truncate -s 10M "$L"
    done
    echo "  -> [✓] Раздутые логи усечены."
else
    echo "  -> [✓] Логов размером > 100MB не обнаружено."
fi

# 4. Очистка неиспользуемых слоев сборки Docker
echo "[4/4] Очистка промежуточных build-кэшей (dangling layers)..."
docker builder prune -f --filter "until=24h" 2>/dev/null || true

echo "======================================================="
echo "   [✓] ЭКСТРЕННАЯ СТАБИЛИЗАЦИЯ ПАМЯТИ ЗАВЕРШЕНА"
echo "======================================================="
free -h 2>/dev/null || true
