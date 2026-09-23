#!/usr/bin/env bash
# docker-mem-audit.sh — Linux & cgroups v2 Memory Health & Risk Audit
set -euo pipefail

echo "======================================================="
echo "   DOCKER MEMORY & CGROUPS V2 AUDIT (2026)"
echo "======================================================="

command -v docker >/dev/null 2>&1 || { echo "Docker CLI не найден."; exit 1; }

echo "[✓] Сканирование контейнеров..."
CONTAINERS=$(docker ps -a --format '{{.ID}} {{.Names}}')

if [ -z "$CONTAINERS" ]; then
    echo "Контейнеры не найдены."
    exit 0
fi

printf "%-25s %-12s %-12s %-10s %-10s %-15s\n" "CONTAINER" "STATUS" "EXIT_CODE" "OOM_KILLED" "MEM_LIMIT" "CGROUP_EVENTS"
echo "-----------------------------------------------------------------------------------------------"

while read -r CID CNAME; do
    INSPECT=$(docker inspect "$CID")
    STATUS=$(echo "$INSPECT" | jq -r '.[0].State.Status')
    EXIT_CODE=$(echo "$INSPECT" | jq -r '.[0].State.ExitCode')
    OOM_KILLED=$(echo "$INSPECT" | jq -r '.[0].State.OOMKilled')
    MEM_LIMIT=$(echo "$INSPECT" | jq -r '.[0].HostConfig.Memory')
    
    if [ "$MEM_LIMIT" -eq 0 ]; then
        MEM_STR="UNLIMITED"
    else
        MEM_STR="$(( MEM_LIMIT / 1024 / 1024 ))MB"
    fi

    # Проверка cgroups v2 memory.events
    FULL_ID=$(echo "$INSPECT" | jq -r '.[0].Id')
    CGROUP_EVENTS="N/A"
    
    CG_FILE="/sys/fs/cgroup/system.slice/docker-${FULL_ID}.scope/memory.events"
    if [ ! -f "$CG_FILE" ]; then
        CG_FILE="/sys/fs/cgroup/docker/${FULL_ID}/memory.events"
    fi

    if [ -f "$CG_FILE" ]; then
        OOM_COUNT=$(grep "^oom " "$CG_FILE" | awk '{print $2}' || echo "0")
        OOM_KILLS=$(grep "^oom_kill " "$CG_FILE" | awk '{print $2}' || echo "0")
        HIGH_THROT=$(grep "^high " "$CG_FILE" | awk '{print $2}' || echo "0")
        CGROUP_EVENTS="oom:${OOM_COUNT}/kill:${OOM_KILLS}/throt:${HIGH_THROT}"
    fi

    printf "%-25s %-12s %-12s %-10s %-10s %-15s\n" "$CNAME" "$STATUS" "$EXIT_CODE" "$OOM_KILLED" "$MEM_STR" "$CGROUP_EVENTS"
done <<< "$CONTAINERS"

echo ""
echo "Текущее использование памяти (docker stats):"
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.PIDs}}"
