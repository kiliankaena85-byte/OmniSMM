# Сетевая безопасность и TLS

> **Содержание**
> 1. [Модель сетевой защиты PostgreSQL](#модель-сетевой-защиты)
> 2. [listen_addresses и порты](#listen-addresses)
> 3. [TLS/SSL в PostgreSQL](#tls-ssl)
> 4. [Шифры и протоколы](#шифры)
> 5. [Сертификаты и PKI](#сертификаты)
> 6. [Взаимная TLS (mTLS)](#mtls)
> 7. [Атака: MITM при sslmode=require](#mitm-require)
> 8. [Атака: downgrade до plaintext](#downgrade)
> 9. [Атака: слабые шифры](#weak-ciphers)
> 10. [Сетевая изоляция](#network-isolation)
> 11. [Kubernetes NetworkPolicies](#k8s-network-policies)
> 12. [Чеклист аудита сети](#чеклист-сети)

---

## Модель сетевой защиты

PostgreSQL по умолчанию слушает только `localhost` (с 9.x). Но в production
сервер часто настраивают слушать все интерфейсы — это первая линия защиты.

Слои:
1. **Сетевой** — firewall, security groups, NetworkPolicies.
2. **Протокольный** — TLS-рукопожатие, certificate verification.
3. **Прикладной** — `pg_hba.conf` (какие IP могут подключаться).
4. **Аутентификация** — SCRAM/cert/md5 (см. `authentication_security.md`).

Каждый слой должен быть в состоянии остановить атаку самостоятельно. Это
defense-in-depth.

---

## listen_addresses

### Аудит

```sql
SHOW listen_addresses;
SHOW port;
```

```bash
# Проверка эффективности:
sudo ss -tlnp | grep 5432
# Должно показывать, на каких интерфейсах слушает:
# 127.0.0.1:5432  → только localhost (хорошо для single-server)
# 0.0.0.0:5432    → все интерфейсы (требует firewall)
# 10.0.1.5:5432   → конкретный интерфейс (хорошо)
```

### Конфигурация

```conf
# postgresql.conf
listen_addresses = '10.0.1.5'  # конкретный внутренний IP
# или:
listen_addresses = 'localhost'  # только локальные подключения
# НИКОГДА в production без firewall:
# listen_addresses = '*'
```

### Анти-примеры

#### Анти-пример 1: listen_addresses = '*' без firewall

```conf
listen_addresses = '*'
```

Без firewall — порт 5432 доступен из интернета. Shodan регулярно находит
>500 000 публично доступных PostgreSQL-серверов. Большинство — с `trust` или
слабыми паролями → компрометация за минуты.

**Патч**:
```conf
listen_addresses = '10.0.1.5'  # внутренний IP
```
+ iptables/ufw/firewalld:
```bash
sudo ufw default deny incoming
sudo ufw allow from 10.0.1.0/24 to any port 5432
sudo ufw allow 22/tcp  # SSH
sudo ufw enable
```

#### Анти-пример 2: два сетевых интерфейса, слушает на обоих

Сервер с eth0 (внутренняя сеть) и eth1 (DMZ). По умолчанию `listen_addresses =
'localhost'` — хорошо. Но админ сделал `listen_addresses = 'eth0,eth1'` для
удобства — теперь DMZ-сеть имеет доступ к БД.

**Патч**:
```conf
listen_addresses = 'eth0'  # только внутренний
```

---

## TLS/SSL

### Включение

```conf
# postgresql.conf
ssl = on
ssl_ca_file = '/etc/postgresql/ssl/ca.pem'
ssl_cert_file = '/etc/postgresql/ssl/server.crt'
ssl_key_file = '/etc/postgresql/ssl/server.key'
ssl_crl_file = '/etc/postgresql/ssl/crl.pem'  # опционально
ssl_min_protocol_version = 'TLSv1.2'
ssl_max_protocol_version = 'TLSv1.3'  # опционально, для ограничения
```

### Аудит TLS

```sql
SHOW ssl;
SHOW ssl_ca_file;
SHOW ssl_cert_file;
SHOW ssl_key_file;
SHOW ssl_min_protocol_version;
SHOW ssl_max_protocol_version;
```

```bash
# Проверка TLS на сервере:
openssl s_client -connect localhost:5432 -starttls postgres < /dev/null 2>/dev/null \
  | openssl x509 -noout -text

# Проверка шифров:
nmap --script ssl-enum-ciphers -p 5432 localhost
```

### Анти-примеры

#### Анти-пример 1: ssl = off в production

```conf
ssl = off
```

Все данные (включая пароли при `password`-методе) идут plaintext. Включая
`pg_hba.conf`-проверки пароля через SCRAM (challenge-response, но сам канал
открыт → MITM может перехватить хеши).

**Патч**:
```conf
ssl = on
ssl_min_protocol_version = 'TLSv1.2'
# Сгенерировать сертификаты (см. ниже)
```

#### Анти-пример 2: самоподписанный сертификат без CA

```bash
# Быстро сгенерировали:
openssl req -new -x509 -days 365 -nodes -text \
  -out server.crt -keyout server.key -subj "/CN=localhost"
```

Проблема: клиенты не могут проверить сертификат → либо отключают проверку
(`sslmode=require`), либо добавляют в trust store любого самоподписанный
сертификат. MITM-атакующий может подменить сертификат.

**Патч**: использовать корпоративный CA или Let's Encrypt (если есть домен).

#### Анти-пример 3: права на server.key 644

```bash
ls -la /etc/postgresql/ssl/
# -rw-r--r-- server.key  ← ПРОБЛЕМА
```

Любой пользователь системы может прочитать приватный ключ. Утёкший ключ =
возможность имперсонации сервера.

**Патч**:
```bash
sudo chown postgres:postgres /etc/postgresql/ssl/server.key
sudo chmod 600 /etc/postgresql/ssl/server.key
# Проверить, что postgres автоматически запускается от имени postgres
```

---

## Шифры

### Современные рекомендации (2024+)

- **Протокол**: TLS 1.2 минимум, TLS 1.3 предпочтителен.
- **Шифры TLS 1.3**: `TLS_AES_256_GCM_SHA384`, `TLS_CHACHA20_POLY1305_SHA256`,
  `TLS_AES_128_GCM_SHA256`.
- **Шифры TLS 1.2**: только AEAD (`ECDHE-RSA-AES256-GCM-SHA384`,
  `ECDHE-RSA-CHACHA20-POLY1305`).
- **Избегать**: CBC-режим, RSA key exchange (нет forward secrecy), 3DES, RC4,
  SHA1.

### Конфигурация PostgreSQL

PostgreSQL не имеет прямых директив для cipher suite (как nginx). Он использует
системные настройки OpenSSL через `ssl_ecdh_curve` и `ssl_ciphers`:

```conf
# postgresql.conf
ssl_ciphers = 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305'
ssl_prefer_server_ciphers = on
ssl_ecdh_curve = 'prime256v1:secp384r1:secp521r1'
ssl_min_protocol_version = 'TLSv1.2'
```

### Аудит шифров

```bash
# Через testssl.sh:
testssl.sh --severity HIGH localhost:5432

# Через nmap:
nmap --script ssl-enum-ciphers -p 5432 localhost

# Через openssl:
openssl s_client -connect localhost:5432 -starttls postgres < /dev/null 2>/dev/null
# Смотреть "Cipher" и "SSL-Session: Protocol"
```

### Анти-примеры

#### Анти-пример 1: ssl_min_protocol_version = 'TLSv1'

```conf
ssl_min_protocol_version = 'TLSv1'
```

TLS 1.0 и 1.1 deprecated с 2020 (RFC 8996). Уязвимы к BEAST, POODLE, CRIME.

**Патч**:
```conf
ssl_min_protocol_version = 'TLSv1.2'
```

#### Анти-пример 2: ssl_ciphers = 'DEFAULT'

```conf
ssl_ciphers = 'DEFAULT'
```

`DEFAULT` в OpenSSL включает слабые шифры (3DES, RC4). На 2024+ неприемлемо.

**Патч**:
```conf
ssl_ciphers = 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256'
ssl_prefer_server_ciphers = on
```

#### Анти-пример 3: ssl_prefer_server_ciphers = off

Если клиент может выбрать слабый шифр, атакующий (MITM) может заставить
клиента выбрать слабый. Сервер должен настаивать на сильном.

**Патч**:
```conf
ssl_prefer_server_ciphers = on
```

---

## Сертификаты

### Генерация CSR для production

```bash
# 1. Приватный ключ:
openssl genrsa -out server.key 4096

# 2. CSR:
openssl req -new -key server.key -out server.csr \
  -subj "/C=RU/ST=Moscow/L=Moscow/O=MyCompany/OU=IT/CN=postgres.internal.mycompany.com"

# 3. Отправить CSR в CA (корпоративный или Let's Encrypt)
# 4. Получить signed certificate -> server.crt

# 5. Установить права:
sudo chown postgres:postgres server.key server.crt
sudo chmod 600 server.key
sudo chmod 644 server.crt
```

### Срок действия

- Сертификат должен быть действителен. Регулярная ротация.
- Установить мониторинг срока действия (Prometheus `blackbox_exporter` или
  `ssl_certificate_exporter`).

### CRL (Certificate Revocation List)

```conf
ssl_crl_file = '/etc/postgresql/ssl/crl.pem'
```

CRL — список отозванных сертификатов. Если атакующий украл сертификат клиента
(mTLS), CRL позволяет его отозвать.

```bash
# Генерация CRL — это задача CA, не PostgreSQL.
# Но периодически (раз в неделю) скачивать свежий CRL.
```

### OCSP stapling

PostgreSQL не поддерживает OCSP stapling напрямую. Если нужен real-time
revocation check — использовать mTLS с OCSP-проверкой на клиенте.

---

## mTLS

Mutual TLS: клиент и сервер проверяют сертификаты друг друга.

### Сервер

```conf
# postgresql.conf
ssl = on
ssl_ca_file = '/etc/postgresql/ssl/ca.pem'
ssl_cert_file = '/etc/postgresql/ssl/server.crt'
ssl_key_file = '/etc/postgresql/ssl/server.key'
```

```conf
# pg_hba.conf
host all all 0.0.0.0/0 cert clientcert=verify-full
# clientcert=verify-ca  → проверяет CA, но не CN
# clientcert=verify-full → проверяет CA и CN = username (PostgreSQL 12+)
```

### Клиент

```bash
psql "postgresql://user@host/db?sslmode=verify-full&\
sslrootcert=/etc/postgresql/ssl/ca.pem&\
sslcert=/etc/postgresql/ssl/client.crt&\
sslkey=/etc/postgresql/ssl/client.key"
```

### Анти-пример: sslmode=prefer

```
postgresql://user@host/db?sslmode=prefer
```

`prefer` = попробовать TLS, если не получилось — plaintext. Атакующий (MITM)
блокирует TLS-рукопожатие → клиент падает в plaintext.

**Патч**:
```
postgresql://user@host/db?sslmode=verify-full
# verify-full = обязательный TLS + проверка сертификата + проверка CN
```

### sslmode cheat sheet

| Mode | Шифрование | Проверка CA | Проверка CN | Защита от MITM |
|------|-----------|-------------|-------------|----------------|
| `disable` | ❌ | ❌ | ❌ | ❌ |
| `allow` | если сервер требует | ❌ | ❌ | ❌ |
| `prefer` | если возможно | ❌ | ❌ | ❌ |
| `require` | ✅ | ❌ | ❌ | ❌ (только passive eavesdropping) |
| `verify-ca` | ✅ | ✅ | ❌ | ⚠️ |
| `verify-full` | ✅ | ✅ | ✅ | ✅ |

`require` — НЕ защита от MITM. Атакующий может перехватить рукопожатие и
проксировать трафик.

---

## MITM при sslmode=require

### Сценарий

Клиент подключается с `sslmode=require`:
```
psql "postgresql://user@host/db?sslmode=require"
```

Это означает: TLS обязательный, но сертификат сервера НЕ проверяется.

Атакующий (в той же сети, через ARP spoofing / DNS spoofing / BGP hijack):
1. Перехватывает соединение.
2. Представляется сервером с собственным сертификатом.
3. Клиент принимает любой сертификат (т.к. `require` не проверяет).
4. Атакующий устанавливает TLS с клиентом и отдельный TLS с реальным сервером.
5. Прокси читает весь трафик (включая SQL-запросы и результаты).

### Защита

Только `sslmode=verify-full`:
```bash
psql "postgresql://user@host/db?sslmode=verify-full&sslrootcert=/etc/postgresql/ssl/ca.pem"
```

`verify-full` проверяет:
- Сертификат подписан доверенным CA.
- Сертификат не истёк.
- CN или SAN сертификата соответствует хосту в connection string.

---

## Downgrade

### Сценарий

Атакующий (MITM) удаляет `sslmode` из connection string или подменяет его на
`disable`. PostgreSQL поддерживает plaintext-подключения (если `ssl = on` не
строго требуется в `pg_hba.conf`).

### Защита

1. `pg_hba.conf` должен содержать только `host ... scram-sha-256` (без
   `host ... trust` или `password`). Это не включает TLS напрямую, но
   `scram-sha-256-plus` требует TLS:
   ```conf
   host all all 0.0.0.0/0 scram-sha-256-plus
   ```
   `scram-sha-256-plus` — это SCRAM с channel binding, который требует TLS.

2. `ssl = on` в `postgresql.conf`.

3. На клиенте — `sslmode=verify-full` (требует TLS).

4. **Никогда** не использовать `sslmode=allow` или `disable` в production.

---

## Слабые шифры

### Сценарий

Атакующий (MITM) в начале TLS-рукопожатия предлагает серверу выбрать слабый
шифр (например, `ECDHE-RSA-AES128-SHA`). Если сервер согласен — дальнейший
трафик можно расшифровать (SHA-1 уязвим, 128-bit AES может быть недостаточно).

### Защита

1. `ssl_min_protocol_version = 'TLSv1.2'` (минимум, лучше TLS 1.3).
2. `ssl_ciphers` — явный список сильных шифров.
3. `ssl_prefer_server_ciphers = on`.
4. Периодический аудит через `testssl.sh` или `nmap --script ssl-enum-ciphers`.

### Аудит

```bash
# Проверка слабых шифров:
testssl.sh --severity HIGH localhost:5432
# Должно быть: "All cipher suites supported by TLS 1.2/1.3 are OK"

# Или:
nmap --script ssl-enum-ciphers -p 5432 localhost | \
  grep -E "(TLS|SSL) |A |F |"
# Ищем grade ниже A
```

---

## Сетевая изоляция

### Принципы

1. **PostgreSQL не должен быть доступен из интернета**. Никогда.
2. **Внутренняя сеть**: только specific-подсети (app-tier, BI, admin VPN).
3. **Application tier** → БД: только port 5432, только specific DB role.
4. **Admin/DBA** → БД: через bastion / jump host с audit-логированием.

### iptables

```bash
# Default deny:
sudo iptables -P INPUT DROP
sudo iptables -P FORWARD DROP
sudo iptables -P OUTPUT ACCEPT

# Loopback:
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A OUTPUT -o lo -j ACCEPT

# Established:
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# SSH:
sudo iptables -A INPUT -p tcp --dport 22 -s 10.0.0.0/8 -j ACCEPT

# PostgreSQL — только из app-tier:
sudo iptables -A INPUT -p tcp --dport 5432 -s 10.0.1.0/24 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 5432 -s 10.0.5.0/24 -j ACCEPT  # BI

# Логирование отказов:
sudo iptables -A INPUT -p tcp --dport 5432 -j LOG --log-prefix "PG_BLOCK: "
sudo iptables -A INPUT -p tcp --dport 5432 -j DROP

# Сохранение:
sudo apt install iptables-persistent
sudo netfilter-persistent save
```

### ufw (упрощённо)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 10.0.0.0/8 to any port 22 proto tcp
sudo ufw allow from 10.0.1.0/24 to any port 5432 proto tcp
sudo ufw allow from 10.0.5.0/24 to any port 5432 proto tcp
sudo ufw enable
sudo ufw status verbose
```

### firewalld (RHEL/CentOS)

```bash
sudo firewall-cmd --permanent --zone=trusted --add-source=10.0.1.0/24
sudo firewall-cmd --permanent --zone=trusted --add-port=5432/tcp
sudo firewall-cmd --reload
```

---

## K8s NetworkPolicies

В Kubernetes NetworkPolicy — это explicit allow. Без политики — все pod-ы могут
общаться.

### Запретить всё по умолчанию

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: database
spec:
  podSelector: {}  # все pod-ы в namespace
  policyTypes:
    - Ingress
    - Egress
  # Нет правил = ничего не разрешено
```

### Разрешить app-tier → postgres

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: postgres-allow-app
  namespace: database
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: app-tier
          podSelector:
            matchLabels:
              app: webapp
      ports:
        - protocol: TCP
          port: 5432
```

### Разрешить egress postgres → ? (обычно только DNS)

PostgreSQL редко должен сам куда-то подключаться (кроме репликации). Egress
ограничиваем:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: postgres-egress
  namespace: database
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
    - Egress
  egress:
    # DNS
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: UDP
          port: 53
    # Репликация к другим postgres-pod
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
```

### Аудит NetworkPolicies

```bash
kubectl get networkpolicy -A -o yaml
# Проверить, что для каждого namespace с postgres есть:
# 1. Default deny ingress/egress
# 2. Явное allow для app-tier
```

---

## Чеклист аудита сети

- [ ] `listen_addresses` ограничен конкретными IP (не `*`).
- [ ] Порт 5432 НЕ доступен из интернета (проверить через внешний nmap).
- [ ] `ssl = on`.
- [ ] `ssl_min_protocol_version = 'TLSv1.2'` (минимум).
- [ ] `ssl_ciphers` — явный список сильных шифров.
- [ ] `ssl_prefer_server_ciphers = on`.
- [ ] Сертификат сервера от доверенного CA (не самоподписанный).
- [ ] `server.key` имеет права `600 postgres:postgres`.
- [ ] Срок действия сертификата мониторится.
- [ ] Клиенты используют `sslmode=verify-full` (не `require`/`prefer`).
- [ ] `pg_hba.conf` использует `scram-sha-256-plus` для network-подключений.
- [ ] firewall настроен (iptables/ufw/firewalld) — только trusted IPs.
- [ ] В K8s — NetworkPolicies ограничивают ingress и egress.
- [ ] Bastion/jump host для admin-доступа (не прямой доступ к БД).
- [ ] Логирование firewall-отказов настроено.
- [ ] Периодический аудит через `testssl.sh` или `nmap --script ssl-enum-ciphers`.
- [ ] Нет правил NAT, экспонирующих 5432 наружу.
- [ ] DNS для postgres-хоста — внутренний (не публичный).
- [ ] IPv6 тоже ограничен (не забыть `ip6tables` / IPv6 в firewall).
