#!/usr/bin/env bash
# ============================================================
# Antigravity: PostgreSQL Bash Security Audit
# Запуск:
#   sudo bash bash_checks.sh > bash_checks_$(date +%F).log 2>&1
# Все проверки — read-only. Ничего не модифицирует.
# ============================================================

set -u  # не падать на unset переменных, но продолжать

# Защита от unset переменных — все обращения через ${VAR:-}
PGDATA=""
PG_CONF=""
PG_HBA=""
PG_IDENT=""
ARCHIVE_DIR=""

# Цвета для вывода (если интерактивный терминал)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    NC='\033[0m'  # No Color
else
    RED=''
    GREEN=''
    YELLOW=''
    NC=''
fi

echo "============================================================"
echo "ANTIGRAVITY POSTGRESQL BASH SECURITY AUDIT"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Host: $(hostname)"
echo "User: $(whoami)"
echo "OS: $(uname -a)"
echo "============================================================"
echo ""

# ============================================================
echo "============================================================"
echo "SECTION 1: POSTGRESQL PROCESS & VERSION"
echo "============================================================"

echo ""
echo "[1.1] PostgreSQL processes:"
ps aux | grep -E "postgres|postmaster" | grep -v grep

echo ""
echo "[1.2] PostgreSQL version (from binary):"
for bin in /usr/lib/postgresql/*/bin/postgres /usr/pgsql-*/bin/postgres /usr/local/bin/postgres; do
    if [ -x "$bin" ]; then
        echo "Binary: $bin"
        "$bin" --version
    fi
done

echo ""
echo "[1.3] PostgreSQL user (from /etc/passwd):"
getent passwd postgres

echo ""
echo "[1.4] System groups containing postgres:"
getent group | grep -E "postgres" || echo "  (no postgres groups)"

echo ""
echo "[1.5] PostgreSQL packages installed (apt/rpm):"
if command -v dpkg >/dev/null; then
    dpkg -l | grep -E "postgresql|psql|pgaudit" || echo "  (no postgresql packages via dpkg)"
elif command -v rpm >/dev/null; then
    rpm -qa | grep -E "postgresql|psql|pgaudit" || echo "  (no postgresql packages via rpm)"
fi

echo ""
echo "[1.6] PostgreSQL service status:"
if command -v systemctl >/dev/null; then
    systemctl status "postgresql*" --no-pager 2>/dev/null | head -30 || echo "  (systemctl not available or no postgres service)"
fi

# ============================================================
echo ""
echo "============================================================"
echo "SECTION 2: LISTENING PORTS & NETWORK"
echo "============================================================"

echo ""
echo "[2.1] Listening ports for 5432 (must NOT be 0.0.0.0:5432 exposed externally):"
if command -v ss >/dev/null; then
    ss -tlnp | grep -E "5432|postgres" || echo "  (port 5432 not found)"
elif command -v netstat >/dev/null; then
    netstat -tlnp 2>/dev/null | grep -E "5432|postgres" || echo "  (port 5432 not found)"
fi

echo ""
echo "[2.2] All listening ports:"
ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null

echo ""
echo "[2.3] Established connections to PostgreSQL:"
ss -tn state established '( dport = 5432 or sport = 5432 )' 2>/dev/null || \
    netstat -tn 2>/dev/null | grep ":5432"

echo ""
echo "[2.4] iptables rules (firewall):"
iptables -L -n -v 2>/dev/null | head -50 || echo "  (iptables not available)"

echo ""
echo "[2.5] ip6tables rules (IPv6 firewall):"
ip6tables -L -n -v 2>/dev/null | head -30 || echo "  (ip6tables not available)"

echo ""
echo "[2.6] ufw status (if Ubuntu):"
ufw status verbose 2>/dev/null || echo "  (ufw not available)"

echo ""
echo "[2.7] firewalld status (if RHEL/CentOS):"
firewall-cmd --list-all 2>/dev/null || echo "  (firewalld not available)"

# ============================================================
echo ""
echo "============================================================"
echo "SECTION 3: POSTGRESQL CONFIGURATION FILES"
echo "============================================================"

# Найти postgresql.conf
CONF_DIR=${POSTGRESQL_CONF_DIR:-/etc/postgresql}
PG_HBA=""
PG_CONF=""
PG_IDENT=""

if [ -d "$CONF_DIR" ]; then
    echo ""
    echo "[3.1] PostgreSQL config directory contents ($CONF_DIR):"
    find "$CONF_DIR" -type f -name "*.conf" -ls

    # Найти активные конфиги
    for f in $(find "$CONF_DIR" -type f -name "postgresql.conf" 2>/dev/null); do
        if [ -r "$f" ]; then
            echo ""
            echo "[3.2] Active postgresql.conf: $f"
            PG_CONF="$f"
            # Показать незакомментированные настройки
            grep -vE "^\s*#|^\s*$" "$f" | head -100
            break
        fi
    done

    for f in $(find "$CONF_DIR" -type f -name "pg_hba.conf" 2>/dev/null); do
        if [ -r "$f" ]; then
            echo ""
            echo "[3.3] Active pg_hba.conf: $f"
            PG_HBA="$f"
            echo "--- Contents (non-comment lines) ---"
            grep -vE "^\s*#|^\s*$" "$f"
            echo "--- End of pg_hba.conf ---"
            break
        fi
    done

    for f in $(find "$CONF_DIR" -type f -name "pg_ident.conf" 2>/dev/null); do
        if [ -r "$f" ]; then
            echo ""
            echo "[3.4] Active pg_ident.conf: $f"
            PG_IDENT="$f"
            echo "--- Contents (non-comment lines) ---"
            grep -vE "^\s*#|^\s*$" "$f"
            echo "--- End of pg_ident.conf ---"
            break
        fi
    done
fi

# ============================================================
echo ""
echo "============================================================"
echo "SECTION 4: SECURITY CHECKS ON pg_hba.conf"
echo "============================================================"

if [ -n "${PG_HBA:-}" ] && [ -r "$PG_HBA" ]; then
    echo ""
    echo "[4.1] CRITICAL — trust authentication in pg_hba.conf:"
    if grep -vE "^\s*#" "$PG_HBA" | grep -i "trust"; then
        echo -e "  ${RED}FOUND trust entries!${NC}"
        grep -nvE "^\s*#" "$PG_HBA" | grep -i "trust"
    else
        echo -e "  ${GREEN}No trust entries found.${NC}"
    fi

    echo ""
    echo "[4.2] DEPRECATED — md5 / password authentication:"
    if grep -vE "^\s*#" "$PG_HBA" | grep -iE "(md5|password)\b"; then
        echo -e "  ${YELLOW}FOUND md5/password entries (should be scram-sha-256)${NC}"
        grep -nvE "^\s*#" "$PG_HBA" | grep -iE "(md5|password)\b"
    else
        echo -e "  ${GREEN}No md5/password entries.${NC}"
    fi

    echo ""
    echo "[4.3] WIDE-OPEN networks (0.0.0.0/0, ::/0):"
    if grep -vE "^\s*#" "$PG_HBA" | grep -E "(0\.0\.0\.0/0|::/0)"; then
        echo -e "  ${RED}FOUND 0.0.0.0/0 or ::/0 entries!${NC}"
        grep -nvE "^\s*#" "$PG_HBA" | grep -E "(0\.0\.0\.0/0|::/0)"
    else
        echo -e "  ${GREEN}No wide-open networks.${NC}"
    fi
else
    echo ""
    echo "[4.x] pg_hba.conf not found or not readable."
fi

# ============================================================
echo ""
echo "============================================================"
echo "SECTION 5: FILE PERMISSIONS & OWNERSHIP"
echo "============================================================"

# Найти PGDATA
PGDATA=$(sudo -u postgres psql -tAX -c "SHOW data_directory;" 2>/dev/null || echo "")
if [ -z "$PGDATA" ]; then
    # Fallback
    for d in /var/lib/postgresql/*/main /var/lib/pgsql/*/data /var/lib/postgres/data; do
        if [ -d "$d" ]; then
            PGDATA="$d"
            break
        fi
    done
fi

echo ""
echo "[5.1] PostgreSQL data directory: $PGDATA"

if [ -n "$PGDATA" ] && [ -d "$PGDATA" ]; then
    echo ""
    echo "[5.2] Permissions on PGDATA (must be 700 postgres:postgres):"
    ls -ld "$PGDATA"
    PERMS=$(stat -c "%a" "$PGDATA" 2>/dev/null || stat -f "%Lp" "$PGDATA" 2>/dev/null)
    OWNER=$(stat -c "%U:%G" "$PGDATA" 2>/dev/null || stat -f "%Su:%Sg" "$PGDATA" 2>/dev/null)
    if [ "$PERMS" = "700" ] || [ "$PERMS" = "0700" ]; then
        echo -e "  ${GREEN}OK: permissions are 700${NC}"
    else
        echo -e "  ${RED}WARNING: permissions are $PERMS (should be 700)${NC}"
    fi
    if [ "$OWNER" = "postgres:postgres" ]; then
        echo -e "  ${GREEN}OK: owner is postgres:postgres${NC}"
    else
        echo -e "  ${RED}WARNING: owner is $OWNER (should be postgres:postgres)${NC}"
    fi

    echo ""
    echo "[5.3] Files in PGDATA with group/other write access (should be none):"
    find "$PGDATA" -type f \( -perm /g+w -o -perm /o+w \) -ls 2>/dev/null | head -20

    echo ""
    echo "[5.4] Files in PGDATA owned by non-postgres user (should be none):"
    find "$PGDATA" ! -user postgres -ls 2>/dev/null | head -20

    echo ""
    echo "[5.5] Symbolic links in PGDATA (review for path traversal):"
    find "$PGDATA" -type l -ls 2>/dev/null
fi

# Конфиги
echo ""
echo "[5.6] Permissions on config files:"
for f in "${PG_CONF:-}" "${PG_HBA:-}" "${PG_IDENT:-}"; do
    if [ -n "$f" ] && [ -e "$f" ]; then
        ls -la "$f"
    fi
done

# SSL-сертификаты
echo ""
echo "[5.7] SSL certificate files (must be 600 for .key):"
if [ -n "${PG_CONF:-}" ]; then
    SSL_DIR=$(dirname "$PG_CONF")/ssl
    if [ -d "$SSL_DIR" ]; then
        ls -la "$SSL_DIR"
    fi
fi

# Поиск всех server.key
echo ""
echo "[5.8] All server.key files on system:"
find /etc/postgresql /var/lib/postgresql /etc/pgsql -name "server.key" -ls 2>/dev/null

# Проверка прав на найденные
for keyfile in $(find /etc/postgresql /var/lib/postgresql -name "server.key" 2>/dev/null); do
    PERMS=$(stat -c "%a" "$keyfile" 2>/dev/null)
    OWNER=$(stat -c "%U:%G" "$keyfile" 2>/dev/null)
    if [ "$PERMS" != "600" ] && [ "$PERMS" != "0600" ]; then
        echo -e "  ${RED}WARNING: $keyfile has permissions $PERMS (should be 600)${NC}"
    fi
    if [ "$OWNER" != "postgres:postgres" ]; then
        echo -e "  ${RED}WARNING: $keyfile owner is $OWNER (should be postgres:postgres)${NC}"
    fi
done

# ============================================================
echo ""
echo "============================================================"
echo "SECTION 6: SSL/TLS CERTIFICATE INSPECTION"
echo "============================================================"

if [ -n "${PG_CONF:-}" ]; then
    CERT_FILE=$(grep -E "^\s*ssl_cert_file" "$PG_CONF" 2>/dev/null | sed "s/.*= *'\\?//; s/'\\?.*//")
    KEY_FILE=$(grep -E "^\s*ssl_key_file" "$PG_CONF" 2>/dev/null | sed "s/.*= *'\\?//; s/'\\?.*//")
    CA_FILE=$(grep -E "^\s*ssl_ca_file" "$PG_CONF" 2>/dev/null | sed "s/.*= *'\\?//; s/'\\?.*//")

    : "${CERT_FILE:=/etc/postgresql/ssl/server.crt}"
    : "${KEY_FILE:=/etc/postgresql/ssl/server.key}"
    : "${CA_FILE:=/etc/postgresql/ssl/ca.pem}"

    for cf in "$CERT_FILE" "$CA_FILE"; do
        if [ -r "$cf" ]; then
            echo ""
            echo "[6.1] Certificate: $cf"
            openssl x509 -in "$cf" -noout -text 2>/dev/null | grep -E "(Subject:|Issuer:|Not Before|Not After|Public Key Algorithm|Signature Algorithm|DNS:|IP:)"
            echo ""
            echo "  Expiry check:"
            openssl x509 -in "$cf" -noout -checkend 86400 2>&1
        fi
    done
fi

# Тест TLS-соединения
echo ""
echo "[6.2] TLS test on localhost:5432 (if PostgreSQL is running):"
if command -v openssl >/dev/null; then
    timeout 10 openssl s_client -connect localhost:5432 -starttls postgres < /dev/null 2>&1 | \
        grep -E "(Protocol|Cipher|Verify return code|Server certificate|subject=|issuer=|Not After)" | head -10
fi

# ============================================================
echo ""
echo "============================================================"
echo "SECTION 7: SYSTEM USER 'postgres' AUDIT"
echo "============================================================"

echo ""
echo "[7.1] Sudo privileges for postgres user:"
sudo -l -U postgres 2>/dev/null || echo "  (cannot query sudo)"

echo ""
echo "[7.2] Crontab for postgres user:"
sudo -u postgres crontab -l 2>/dev/null || echo "  (no crontab)"

echo ""
echo "[7.3] System cron entries mentioning postgres:"
grep -r "postgres" /etc/cron* /var/spool/cron 2>/dev/null | head -20

echo ""
echo "[7.4] SSH authorized_keys for postgres (potential backdoor):"
PG_HOME=$(getent passwd postgres | cut -d: -f6)
if [ -n "$PG_HOME" ] && [ -d "$PG_HOME/.ssh" ]; then
    ls -la "$PG_HOME/.ssh/"
    echo "--- authorized_keys content ---"
    cat "$PG_HOME/.ssh/authorized_keys" 2>/dev/null
    echo "--- end ---"
else
    echo "  (no .ssh directory for postgres)"
fi

echo ""
echo "[7.5] Profile files for postgres (review for backdoors):"
if [ -n "$PG_HOME" ]; then
    for f in .bashrc .bash_profile .profile .bash_login; do
        if [ -f "$PG_HOME/$f" ]; then
            echo "--- $PG_HOME/$f ---"
            cat "$PG_HOME/$f"
        fi
    done
fi

echo ""
echo "[7.6] postgres user shell (should be /bin/bash for admin, /bin/false for service):"
getent passwd postgres | cut -d: -f7

# ============================================================
echo ""
echo "============================================================"
echo "SECTION 8: SYSTEM HARDENING"
echo "============================================================"

echo ""
echo "[8.1] Kernel security parameters:"
sysctl kernel.randomize_va_space 2>/dev/null
sysctl kernel.dmesg_restrict 2>/dev/null
sysctl kernel.kptr_restrict 2>/dev/null
sysctl kernel.unprivileged_bpf_disabled 2>/dev/null
sysctl kernel.unprivileged_userns_clone 2>/dev/null
sysctl net.ipv4.conf.all.rp_filter 2>/dev/null
sysctl net.ipv4.conf.all.accept_redirects 2>/dev/null
sysctl net.ipv4.conf.all.send_redirects 2>/dev/null
sysctl net.ipv4.tcp_syncookies 2>/dev/null
sysctl vm.overcommit_memory 2>/dev/null

echo ""
echo "[8.2] SELinux / AppArmor status:"
if command -v getenforce >/dev/null; then
    echo "SELinux: $(getenforce)"
elif command -v aa-status >/dev/null; then
    aa-status 2>/dev/null | head -10
else
    echo "  (neither SELinux nor AppArmor detected)"
fi

echo ""
echo "[8.3] AIDE / Tripwire (File Integrity Monitoring):"
if command -v aide >/dev/null; then
    echo "AIDE is installed"
    aide --version 2>&1 | head -1
elif command -v tripwire >/dev/null; then
    echo "Tripwire is installed"
else
    echo -e "  ${YELLOW}No FIM tool installed. Consider installing AIDE or Tripwire.${NC}"
fi

echo ""
echo "[8.4] Open files limit for postgres (ulimit):"
sudo -u postgres bash -c "ulimit -n" 2>/dev/null

echo ""
echo "[8.5] PostgreSQL systemd service hardening (if applicable):"
# shopt nullglob ensures patterns expand to nothing (not literal) if no match
shopt -s nullglob
svcs_found=()
for svc in postgresql postgresql@*; do
    if systemctl cat "$svc" >/dev/null 2>&1; then
        svcs_found+=("$svc")
    fi
done
shopt -u nullglob
if [ ${#svcs_found[@]} -gt 0 ]; then
    for svc in "${svcs_found[@]}"; do
        echo "--- Service: $svc ---"
        systemctl cat "$svc" 2>/dev/null
        echo ""
        echo "Effective hardening flags:"
        systemctl show "$svc" 2>/dev/null | grep -E "^(NoNewPrivileges|PrivateTmp|PrivateDevices|ProtectSystem|ProtectHome|ReadWritePaths|ProtectKernelTunables|ProtectKernelModules|ProtectControlGroups|LockPersonality|RestrictAddressFamilies|RestrictNamespaces|RestrictRealtime|RestrictSUIDSGID|MemoryDenyWriteExecute|SystemCallFilter|CapabilityBoundingSet|AmbientCapabilities)=" | head -20
        break  # показываем только первый найденный
    done
else
    echo "  (no postgresql systemd service found)"
fi

# ============================================================
echo ""
echo "============================================================"
echo "SECTION 9: BACKUP & ARCHIVE CONFIGURATION"
echo "============================================================"

echo ""
echo "[9.1] Backup scripts in /etc/cron*, /usr/local/bin, /opt:"
find /etc/cron* /usr/local/bin /opt -type f -exec grep -l "pg_dump\|pg_basebackup\|wal-g\|pgbackrest" {} \; 2>/dev/null | head -10

echo ""
echo "[9.2] Recent backup activity (last 7 days, in common backup locations):"
# Не сканируем всю ФС — это долго. Ограничиваем типичными локациями бэкапов.
find /var/backups /backup /backups /opt/backups /srv/backups /home \
     -maxdepth 4 -type f \( -name "*.sql.gz" -o -name "*.dump" -o -name "base.tar.gz" \) \
     -mtime -7 -ls 2>/dev/null | head -10

echo ""
echo "[9.3] archive_command in postgresql.conf:"
if [ -n "${PG_CONF:-}" ] && [ -r "$PG_CONF" ]; then
    grep -E "^\s*archive_command" "$PG_CONF"
fi

echo ""
echo "[9.4] WAL archive directory (if local):"
if [ -n "${PG_CONF:-}" ] && [ -r "$PG_CONF" ]; then
    ARCHIVE_DIR=$(grep -E "^\s*archive_command" "$PG_CONF" 2>/dev/null | grep -oE "/[^ ]+" | head -1)
    if [ -n "$ARCHIVE_DIR" ]; then
        echo "Archive directory referenced: $ARCHIVE_DIR"
    else
        echo "  (no archive_command with a path found in postgresql.conf)"
    fi
else
    echo "  (postgresql.conf not available — skipping)"
fi

# ============================================================
echo ""
echo "============================================================"
echo "SECTION 10: DOCKER / KUBERNETES (if applicable)"
echo "============================================================"

echo ""
echo "[10.1] PostgreSQL containers running:"
if command -v docker >/dev/null; then
    docker ps --filter "ancestor=postgres" 2>/dev/null
    docker ps 2>/dev/null | grep -i postgres
fi

echo ""
echo "[10.2] Docker Compose files with postgres:"
find /opt /srv /home /root -maxdepth 4 -name "docker-compose*.yml" 2>/dev/null | \
    xargs grep -l "postgres" 2>/dev/null | head -10

echo ""
echo "[10.3] Kubernetes PostgreSQL pods (if kubectl available):"
if command -v kubectl >/dev/null; then
    kubectl get pods -A -l "app=postgres" -o wide 2>/dev/null
    kubectl get pods -A 2>/dev/null | grep -i postgres
fi

echo ""
echo "[10.4] Kubernetes PostgreSQL StatefulSets:"
if command -v kubectl >/dev/null; then
    kubectl get statefulset -A 2>/dev/null | grep -i postgres
fi

# ============================================================
echo ""
echo "============================================================"
echo "AUDIT COMPLETE"
echo "============================================================"
echo "Review findings above. For each WARNING/CRITICAL:"
echo "  1. Read relevant references/*.md"
echo "  2. Apply patches per reference guidance"
echo "  3. Document findings in report"
echo "============================================================"
