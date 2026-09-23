#!/bin/sh
# =============================================================================
# Smmplan — PostgreSQL Backup Script
# =============================================================================
# Режимы:
#   hourly  — финансовые таблицы (User, Order, Payment, LedgerEntry, Commission)
#   daily   — полный дамп всей БД
#   weekly  — верификация последнего дампа (восстановление + проверка)
#
# Переменные окружения (обязательные):
#   DATABASE_URL          — строка подключения PostgreSQL
#   BACKUP_GPG_PASSPHRASE — пароль для шифрования GPG
#   RCLONE_REMOTE         — имя remote в rclone (например: yadisk)
#   ADMIN_ALERT_BOT_TOKEN — токен Telegram-бота для алертов
#   ADMIN_ALERT_CHAT_ID   — ID чата для алертов
# =============================================================================

set -e

MODE="${1:-daily}" # hourly | daily | verify
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M)
DATE=$(date +%Y-%m-%d)

# Финансовые таблицы для hourly снапшота
FINANCIAL_TABLES="User Order Payment LedgerEntry Commission"

# =============================================================================
# Вспомогательные функции
# =============================================================================

send_telegram_alert() {
  local message="$1"
  local severity="${2:-INFO}" # INFO | WARNING | CRITICAL

  if [ -z "$ADMIN_ALERT_BOT_TOKEN" ] || [ -z "$ADMIN_ALERT_CHAT_ID" ]; then
    echo "[ALERT] $severity: $message"
    return
  fi

  case "$severity" in
    CRITICAL) emoji="🚨" ;;
    WARNING)  emoji="⚠️" ;;
    *)        emoji="ℹ️" ;;
  esac

  text="${emoji} <b>Smmplan Backup [${severity}]</b>%0A%0A${message}%0A%0A<i>$(date)</i>"

  wget -qO- "https://api.telegram.org/bot${ADMIN_ALERT_BOT_TOKEN}/sendMessage" \
    --post-data="chat_id=${ADMIN_ALERT_CHAT_ID}&text=${text}&parse_mode=HTML" \
    > /dev/null 2>&1 || true
}

# Парсим DATABASE_URL: postgresql://user:pass@host:port/dbname
parse_db_url() {
  # Формат: postgresql://user:pass@host:port/dbname?params
  DB_URL="${DATABASE_URL}"
  DB_USER=$(echo "$DB_URL" | sed 's|postgresql://\([^:]*\):.*|\1|')
  DB_PASS=$(echo "$DB_URL" | sed 's|postgresql://[^:]*:\([^@]*\)@.*|\1|')
  DB_HOST=$(echo "$DB_URL" | sed 's|postgresql://[^@]*@\([^:/]*\).*|\1|')
  DB_PORT=$(echo "$DB_URL" | sed 's|.*:\([0-9]*\)/.*|\1|')
  DB_NAME=$(echo "$DB_URL" | sed 's|.*/\([^?]*\).*|\1|')
}

encrypt_file() {
  local input="$1"
  local output="${input}.gpg"
  gpg --batch --yes --symmetric \
      --cipher-algo AES256 \
      --passphrase "$BACKUP_GPG_PASSPHRASE" \
      --output "$output" \
      "$input"
  rm -f "$input"
  echo "$output"
}

upload_to_yadisk() {
  local file="$1"
  local remote_path="$2"
  if command -v rclone > /dev/null 2>&1; then
    rclone copy "$file" "${RCLONE_REMOTE}:smmplan-backups/${remote_path}/" \
      --log-level INFO || {
        send_telegram_alert "Ошибка загрузки на Yandex Disk: $file" "WARNING"
        return 1
      }
    echo "[Backup] Uploaded to Yandex Disk: $remote_path/$(basename $file)"
  else
    echo "[Backup] rclone not found, skipping remote upload"
  fi
}

rotate_local() {
  local dir="$1"
  local pattern="$2"
  local keep_hours="$3" # в часах

  find "$dir" -name "$pattern" -mmin "+$((keep_hours * 60))" -delete 2>/dev/null || true
}

# =============================================================================
# Режим: hourly — финансовый снапшот
# =============================================================================

backup_hourly() {
  echo "[Backup] Starting hourly financial snapshot..."
  parse_db_url

  mkdir -p "${BACKUP_DIR}/hourly"
  local filename="financial_${TIMESTAMP}.sql.gz"
  local filepath="${BACKUP_DIR}/hourly/${filename}"

  # Строим список таблиц для pg_dump
  table_args=""
  for table in $FINANCIAL_TABLES; do
    table_args="$table_args -t \"$table\""
  done

  PGPASSWORD="$DB_PASS" pg_dump \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -t '"User"' -t '"Order"' -t '"Payment"' -t '"LedgerEntry"' -t '"Commission"' \
    --no-owner --no-acl \
    | gzip > "$filepath"

  local size=$(du -sh "$filepath" | cut -f1)
  echo "[Backup] Hourly dump created: $filename ($size)"

  # Шифрование
  local encrypted=$(encrypt_file "$filepath")
  echo "[Backup] Encrypted: $(basename $encrypted)"

  # Загрузка на Yandex Disk
  upload_to_yadisk "$encrypted" "hourly"

  # Ротация: удалять локальные файлы старше 48 часов
  rotate_local "${BACKUP_DIR}/hourly" "financial_*.sql.gz.gpg" 48

  send_telegram_alert "✅ Hourly финансовый снапшот: $filename ($size)" "INFO"
  echo "[Backup] Hourly backup completed."
}

# =============================================================================
# Режим: daily — полный дамп
# =============================================================================

backup_daily() {
  echo "[Backup] Starting daily full dump..."
  parse_db_url

  mkdir -p "${BACKUP_DIR}/daily"
  local filename="full_${DATE}.sql.gz"
  local filepath="${BACKUP_DIR}/daily/${filename}"

  PGPASSWORD="$DB_PASS" pg_dump \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-acl \
    | gzip > "$filepath"

  local size=$(du -sh "$filepath" | cut -f1)
  echo "[Backup] Daily dump created: $filename ($size)"

  # Шифрование
  local encrypted=$(encrypt_file "$filepath")
  echo "[Backup] Encrypted: $(basename $encrypted)"

  # Загрузка на Yandex Disk
  upload_to_yadisk "$encrypted" "daily"

  # Ротация: удалять локальные файлы старше 7 дней
  rotate_local "${BACKUP_DIR}/daily" "full_*.sql.gz.gpg" 168

  send_telegram_alert "✅ Daily полный дамп: $filename ($size)" "INFO"
  echo "[Backup] Daily backup completed."
}

# =============================================================================
# Режим: verify — еженедельная верификация восстановления
# =============================================================================

verify_backup() {
  echo "[Verify] Starting weekly backup verification..."
  parse_db_url

  # Найти последний daily дамп
  local latest=$(find "${BACKUP_DIR}/daily" -name "full_*.sql.gz.gpg" | sort | tail -1)

  if [ -z "$latest" ]; then
    send_telegram_alert "🚨 Верификация бэкапа ПРОВАЛЕНА: нет файлов дампа в ${BACKUP_DIR}/daily" "CRITICAL"
    exit 1
  fi

  echo "[Verify] Found latest backup: $latest"

  # Расшифровать во временный файл
  local tmp_dir="/tmp/smmplan-verify-$$"
  mkdir -p "$tmp_dir"
  local tmp_sql="${tmp_dir}/restore.sql.gz"

  gpg --batch --yes \
      --passphrase "$BACKUP_GPG_PASSPHRASE" \
      --output "$tmp_sql" \
      --decrypt "$latest"

  # Поднять временную БД PostgreSQL
  local verify_db="smmplan_verify_$$"
  PGPASSWORD="$DB_PASS" createdb \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$verify_db" 2>/dev/null || true

  # Восстановить дамп
  gunzip -c "$tmp_sql" | PGPASSWORD="$DB_PASS" psql \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$verify_db" \
    --quiet > /dev/null 2>&1

  # Проверить целостность
  local order_count=$(PGPASSWORD="$DB_PASS" psql \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$verify_db" \
    -t -c 'SELECT COUNT(*) FROM "Order";' 2>/dev/null | tr -d ' ')

  local user_count=$(PGPASSWORD="$DB_PASS" psql \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$verify_db" \
    -t -c 'SELECT COUNT(*) FROM "User";' 2>/dev/null | tr -d ' ')

  # Удалить временную БД и файлы
  PGPASSWORD="$DB_PASS" dropdb \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$verify_db" 2>/dev/null || true
  rm -rf "$tmp_dir"

  if [ -z "$order_count" ] || [ "$order_count" = "0" ]; then
    send_telegram_alert "🚨 Верификация бэкапа ПРОВАЛЕНА! Order count = ${order_count:-ОШИБКА}. Проверьте дамп немедленно!" "CRITICAL"
    exit 1
  fi

  send_telegram_alert "✅ Верификация бэкапа прошла успешно. Users: $user_count, Orders: $order_count. Файл: $(basename $latest)" "INFO"
  echo "[Verify] Backup verification passed. Users: $user_count, Orders: $order_count"
}

# =============================================================================
# Обработка ошибок
# =============================================================================

handle_error() {
  local exit_code=$?
  send_telegram_alert "🚨 Backup скрипт завершился с ошибкой! Mode: $MODE, Exit code: $exit_code" "CRITICAL"
  exit $exit_code
}

trap 'handle_error' ERR

# =============================================================================
# Точка входа
# =============================================================================

case "$MODE" in
  hourly) backup_hourly ;;
  daily)  backup_daily ;;
  verify) verify_backup ;;
  *)
    echo "Usage: $0 [hourly|daily|verify]"
    exit 1
    ;;
esac
