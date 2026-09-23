#!/usr/bin/env bash
# docker-oom-forensics.sh — Automated OOM Crash Investigation
set -euo pipefail

TARGET_CONTAINER="${1:-}"

if [ -z "$TARGET_CONTAINER" ]; then
    echo "Использование: $0 <container_name_or_id>"
    exit 1
fi

REPORT_DIR="/tmp/docker-forensics-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$REPORT_DIR"

echo "======================================================="
echo "   OOM FORENSIC INVESTIGATION: $TARGET_CONTAINER"
echo "   Отчет сохраняется в: $REPORT_DIR"
echo "======================================================="

# 1. Сбор Docker Inspect
echo "[1/4] Извлечение состояния Docker Inspect..."
docker inspect "$TARGET_CONTAINER" > "$REPORT_DIR/inspect.json"

EXIT_CODE=$(jq -r '.[0].State.ExitCode' "$REPORT_DIR/inspect.json")
OOM_KILLED=$(jq -r '.[0].State.OOMKilled' "$REPORT_DIR/inspect.json")
FINISHED_AT=$(jq -r '.[0].State.FinishedAt' "$REPORT_DIR/inspect.json")
FULL_ID=$(jq -r '.[0].Id' "$REPORT_DIR/inspect.json")

echo "  -> ExitCode: $EXIT_CODE"
echo "  -> OOMKilled: $OOM_KILLED"
echo "  -> FinishedAt: $FINISHED_AT"

# 2. Сбор последних логов приложения
echo "[2/4] Сбор предсмертных логов контейнера..."
docker logs --tail 300 "$TARGET_CONTAINER" > "$REPORT_DIR/container_tail.log" 2>&1 || true

# 3. Поиск записей в dmesg ядра
echo "[3/4] Сканирование кольцевого буфера ядра (dmesg)..."
if command -v dmesg >/dev/null 2>&1; then
    dmesg -T | grep -A 40 -B 10 -E -i "oom[-_]killer|killed process" > "$REPORT_DIR/kernel_oom.log" || true
    echo "  -> Записи OOM ядра сохранены в $REPORT_DIR/kernel_oom.log"
else
    echo "  -> dmesg недоступен в текущем окружении."
fi

# 4. Проверка cgroups v2 memory.events
echo "[4/4] Сбор метрик cgroups v2..."
CG_FILE="/sys/fs/cgroup/system.slice/docker-${FULL_ID}.scope/memory.events"
if [ ! -f "$CG_FILE" ]; then
    CG_FILE="/sys/fs/cgroup/docker/${FULL_ID}/memory.events"
fi

if [ -f "$CG_FILE" ]; then
    cp "$CG_FILE" "$REPORT_DIR/memory.events"
    echo "  -> Содержимое memory.events:"
    cat "$CG_FILE"
else
    echo "  -> Файл memory.events не найден (cgroup уже удален или v1)."
fi

echo "======================================================="
echo "   ВЕРДИКТ РАССЛЕДОВАНИЯ:"
if [ "$OOM_KILLED" = "true" ] || [ "$EXIT_CODE" -eq 137 ]; then
    echo "   [!] ПОДТВЕРЖДЕН OOM KILLED (Exit Code 137)"
    echo "   Причина: процесс превысил жесткий лимит memory.max."
    echo "   Действие: увеличьте лимит --memory или настройте NODE_OPTIONS."
else
    echo "   [i] OOMKilled = $OOM_KILLED (Exit Code: $EXIT_CODE)"
    echo "   Проверьте логи в $REPORT_DIR/container_tail.log на наличие внутренних исключений."
fi
echo "======================================================="
