#!/usr/bin/env bash
# (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
# Shell script to execute pgbench within Docker container

CONTAINER=${1:-"smmplan_lite_db"}
DB=${2:-"smmplan_lite"}
USER=${3:-"postgres"}
CLIENTS=${4:-10}
JOBS=${5:-2}
DURATION=${6:-5}
MODE=${7:-"checkout"}

npx tsx scripts/db-testing/run-pgbench.ts --container "$CONTAINER" --db "$DB" --user "$USER" --clients "$CLIENTS" --jobs "$JOBS" --duration "$DURATION" --mode "$MODE"
