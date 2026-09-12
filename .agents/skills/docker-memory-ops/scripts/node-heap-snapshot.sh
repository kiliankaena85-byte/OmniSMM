#!/usr/bin/env bash
# node-heap-snapshot.sh — Live Node.js Heap Snapshot Extractor
set -euo pipefail

TARGET_CONTAINER="${1:-}"

if [ -z "$TARGET_CONTAINER" ]; then
    echo "Использование: $0 <container_name>"
    echo "Пример: $0 smmplan_app"
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
HOST_OUT_DIR="./dumps"
mkdir -p "$HOST_OUT_DIR"

CONTAINER_DUMP_FILE="/tmp/heap-${TIMESTAMP}.heapsnapshot"
HOST_DUMP_FILE="${HOST_OUT_DIR}/${TARGET_CONTAINER}-${TIMESTAMP}.heapsnapshot"

echo "======================================================="
echo "   ГЕНЕРАЦИЯ V8 HEAP SNAPSHOT В КОНТЕЙНЕРЕ: $TARGET_CONTAINER"
echo "======================================================="

# Проверка, запущен ли контейнер
IS_RUNNING=$(docker inspect "$TARGET_CONTAINER" --format '{{.State.Running}}' 2>/dev/null || echo "false")
if [ "$IS_RUNNING" != "true" ]; then
    echo "Ошибка: Контейнер $TARGET_CONTAINER не запущен."
    exit 1
fi

echo "[1/3] Поиск PID Node.js внутри контейнера..."
NODE_PID=$(docker exec "$TARGET_CONTAINER" sh -c "pgrep -f 'node|tsx' | head -n 1" || echo "")

if [ -z "$NODE_PID" ]; then
    echo "Ошибка: Процесс Node.js/tsx не найден внутри контейнера."
    exit 1
fi
echo "  -> Найден Node PID: $NODE_PID"

echo "[2/3] Инициация генерации Heap Snapshot..."
# Вариант 1: Через Node.js встроенный скрипт
docker exec "$TARGET_CONTAINER" node -e "
const v8 = require('v8');
const fs = require('fs');
console.log('Начало создания слепка кучи...');
const snapshotFile = '$CONTAINER_DUMP_FILE';
const stream = v8.getHeapSnapshot();
const fileStream = fs.createWriteStream(snapshotFile);
stream.pipe(fileStream);
fileStream.on('finish', () => console.log('Слепок успешно записан в ' + snapshotFile));
" || {
    echo "Альтернативная попытка через сигнал SIGUSR2..."
    docker exec "$TARGET_CONTAINER" kill -USR2 "$NODE_PID"
}

sleep 2

echo "[3/3] Копирование слепка на хост-машину..."
if docker cp "${TARGET_CONTAINER}:${CONTAINER_DUMP_FILE}" "$HOST_DUMP_FILE" 2>/dev/null; then
    docker exec "$TARGET_CONTAINER" rm -f "$CONTAINER_DUMP_FILE" || true
    echo "======================================================="
    echo "   [✓] УСПЕХ: Дамп кучи сохранен в:"
    echo "   $HOST_DUMP_FILE"
    echo "   Размер: $(ls -lh "$HOST_DUMP_FILE" | awk '{print $5}')"
    echo "   Инструкция: откройте Chrome -> DevTools -> Memory -> Load"
    echo "======================================================="
else
    echo "Внимание: Файл $CONTAINER_DUMP_FILE не найден. Проверьте диагностические отчеты:"
    docker exec "$TARGET_CONTAINER" ls -la /tmp/
fi
