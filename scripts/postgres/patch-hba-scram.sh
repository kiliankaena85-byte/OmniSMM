#!/bin/sh
set -e
HBA_FILE="/var/lib/postgresql/data/pg_hba.conf"
if [ ! -f "$HBA_FILE" ]; then
  echo "Error: pg_hba.conf not found"
  exit 1
fi
sed -i 's/trust/scram-sha-256/g' "$HBA_FILE"
psql -U postgres -d postgres -c "SELECT pg_reload_conf();"
