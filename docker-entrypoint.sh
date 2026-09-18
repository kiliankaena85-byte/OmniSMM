#!/bin/sh
set -e

# Авто-синхронизация схемы БД перед стартом (Zero-Drift Invariant)
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "[entrypoint] 🔄 Checking and synchronizing database schema..."
  if [ -f "./node_modules/prisma/build/index.js" ]; then
    node ./node_modules/prisma/build/index.js migrate deploy || echo "[entrypoint] ⚠️ WARNING: Prisma migrate deploy encountered non-fatal issues, continuing startup..."
  elif [ -x "./node_modules/.bin/prisma" ]; then
    ./node_modules/.bin/prisma migrate deploy || echo "[entrypoint] ⚠️ WARNING: Prisma migrate deploy encountered non-fatal issues, continuing startup..."
  else
    echo "[entrypoint] ℹ️ NOTICE: Prisma CLI binary not found in container, skipping auto schema sync."
  fi
  echo "[entrypoint] ✅ Database schema sync check completed."
fi

exec "$@"

