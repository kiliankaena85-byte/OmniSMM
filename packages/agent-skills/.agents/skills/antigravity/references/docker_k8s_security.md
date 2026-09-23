# Контейнерная безопасность PostgreSQL (Docker/K8s)

> **Содержание**
> 1. [Угрозы в контейнерном PostgreSQL](#угрозы)
> 2. [Docker-образ PostgreSQL](#docker-image)
> 3. [Docker-compose hardening](#docker-compose)
> 4. [Kubernetes: StatefulSet + PVC](#k8s-statefulset)
> 5. [Kubernetes NetworkPolicies](#k8s-network-policies)
> 6. [Secrets management](#secrets)
> 7. [Init containers для hardening](#init-containers)
> 8. [Pod Security Standards](#pod-security)
> 9. [Helm-чарты: аудит](#helm)
> 10. [Operator: CloudNativePG / CrunchyData](#operators)
> 11. [Чеклист](#чеклист)

---

## Угрозы

Контейнерный PostgreSQL наследует все угрозы обычного + добавляет
контейнер-специфичные:

1. **Secrets в image / env / ConfigMap** — самый частый leak.
2. **Privileged containers** — escape на host.
3. **PVC на нешифрованных дисках** — данные в покое не зашифрованы.
4. **Public image tags** — `postgres:latest` может быть чем угодно.
5. **No resource limits** — DoS через fork bomb или memory.
6. **No network policy** — все pod-ы кластера могут подключаться.
7. **Init scripts с секретами** — `initdb` скрипты в image содержат пароли.

---

## Docker-image

### Официальный образ

`postgres:15` — официальный образ от Docker Hub. Что в нём:
1. Запускается от пользователя `postgres` (uid 999). Хорошо.
2. По умолчанию `POSTGRES_PASSWORD` env var.
3. `docker-entrypoint.sh` инициализирует БД при первом запуске.
4. Базовый образ — Debian.

### Аудит image

```bash
# Список слоёв:
docker history postgres:15 --no-trunc

# Поиск секретов в слоях:
docker save postgres:15 -o /tmp/pg.tar
tar -xf /tmp/pg.tar -C /tmp/pg-layers
grep -rE "(password|secret|token|key)" /tmp/pg-layers/ 2>/dev/null | head -20

# Проверка пользователя:
docker inspect postgres:15 --format '{{.Config.User}}'
# Должен быть "999" или "postgres", НЕ пустой (root)

# Проверка exposed ports:
docker inspect postgres:15 --format '{{json .Config.ExposedPorts}}'
# Должен быть только 5432

# Проверка cmd/entrypoint:
docker inspect postgres:15 --format '{{json .Config.Cmd}}'
docker inspect postgres:15 --format '{{json .Config.Entrypoint}}'
```

### Анти-примеры

#### Анти-пример 1: Dockerfile с секретом

```dockerfile
FROM postgres:15
ENV POSTGRES_PASSWORD=mysecretpassword  # ОШИБКА: секрет в image
ENV POSTGRES_DB=appdb
COPY init.sql /docker-entrypoint-initdb.d/
```

Секрет в image. Любой, кто имеет доступ к image, видит пароль. Даже если
image в private registry.

**Патч**:
```dockerfile
FROM postgres:15
ENV POSTGRES_DB=appdb
COPY init.sql /docker-entrypoint-initdb.d/
# POSTGRES_PASSWORD передавать при запуске через env file или secret
```

```bash
# Запуск:
docker run --env-file /etc/postgres.env postgres:15
# /etc/postgres.env: POSTGRES_PASSWORD=... (chmod 600, owned by root)
```

#### Анти-пример 2: COPY с правами root

```dockerfile
COPY init.sql /docker-entrypoint-initdb.d/init.sql
# Файл будет принадлежать root, postgres не сможет прочитать
# Если в скрипте нужно что-то записать — упадёт
```

**Патч**:
```dockerfile
COPY --chown=postgres:postgres init.sql /docker-entrypoint-initdb.d/init.sql
RUN chmod 600 /docker-entrypoint-initdb.d/init.sql
```

#### Анти-пример 3: тег latest

```dockerfile
FROM postgres:latest
```

`latest` — плавающий тег. Через неделю может оказаться PostgreSQL 16, а
ваши миграции несовместимы. Или image может быть tampered (если registry
скомпрометирован).

**Патч**:
```dockerfile
FROM postgres:15.8-alpine
# Конкретный minor + конкретный base image
# Alpine — меньше attack surface, но musl может ломать совместимость
```

#### Анти-пример 4: USER root

```dockerfile
FROM postgres:15
USER root
# Или вообще без USER — по умолчанию root
```

Если атакующий получит RCE через PostgreSQL (COPY PROGRAM, plpythonu) —
он получит root в контейнере, что упрощает escape на host.

**Патч**:
```dockerfile
FROM postgres:15
USER postgres
```

---

## Docker-compose

### Минимальный безопасный compose

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15.8
    user: "999:999"  # postgres
    environment:
      POSTGRES_DB: appdb
      # POSTGRES_PASSWORD — из secret
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init:/docker-entrypoint-initdb.d:ro
      - ./postgresql.conf:/etc/postgresql/postgresql.conf:ro
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    ports:
      - "127.0.0.1:5432:5432"  # только localhost
    # НЕ порты 5432:5432 (это 0.0.0.0:5432:5432)
    networks:
      - backend
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 1G
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETUID
      - SETGID
      - DAC_OVERRIDE
    read_only: true
    tmpfs:
      - /tmp
      - /var/run/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 30s
      timeout: 5s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

secrets:
  db_password:
    file: /etc/postgres_password.txt

volumes:
  pgdata:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/postgres-data  # На хосте: шифрованный LUKS-раздел

networks:
  backend:
    driver: bridge
    internal: true  # Изолировать от внешней сети
```

### Аудит compose

```bash
# Использовать docker-bench-security:
docker run --rm --net host --pid --userns host --cap-add audit_control \
  -e DOCKER_CONTENT_TRUST=$DOCKER_CONTENT_TRUST \
  -v /var/lib:/var/lib:ro \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /etc:/etc:ro \
  --label docker_bench_security \
  docker/docker-bench-security
```

---

## K8s-StatefulSet

StatefulSet — правильный способ деплоить PostgreSQL в K8s (не Deployment,
т.к. нужно стабильное имя + PVC).

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: database
spec:
  serviceName: postgres-headless
  replicas: 1  # Для репликации использовать operator, не StatefulSet с replica > 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      serviceAccountName: postgres  # Не default
      securityContext:
        runAsUser: 999
        runAsGroup: 999
        fsGroup: 999
        runAsNonRoot: true
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: postgres
          image: postgres:15.8
          imagePullPolicy: IfNotPresent
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            runAsNonRoot: true
            runAsUser: 999
            capabilities:
              drop: ["ALL"]
              add: ["CHOWN", "SETUID", "SETGID", "DAC_OVERRIDE"]
          env:
            - name: POSTGRES_DB
              value: appdb
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-credentials
                  key: password
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          ports:
            - containerPort: 5432
              name: postgres
          volumeMounts:
            - name: pgdata
              mountPath: /var/lib/postgresql/data
            - name: config
              mountPath: /etc/postgresql
              readOnly: true
            - name: tmp
              mountPath: /tmp
            - name: run
              mountPath: /var/run/postgresql
          resources:
            requests:
              cpu: 500m
              memory: 1Gi
            limits:
              cpu: 2000m
              memory: 4Gi
          readinessProbe:
            exec:
              command: ["pg_isready", "-U", "postgres"]
            initialDelaySeconds: 30
            periodSeconds: 10
          livenessProbe:
            exec:
              command: ["pg_isready", "-U", "postgres"]
            initialDelaySeconds: 60
            periodSeconds: 30
      volumes:
        - name: config
          configMap:
            name: postgres-config
        - name: tmp
          emptyDir: {}
        - name: run
          emptyDir: {}
  volumeClaimTemplates:
    - metadata:
        name: pgdata
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: encrypted-sc  # StorageClass с шифрованием
        resources:
          requests:
            storage: 100Gi
```

### Аудит StatefulSet

```bash
# Проверить, что используется StatefulSet (не Deployment):
kubectl get statefulset -n database

# Проверить securityContext:
kubectl get statefulset postgres -n database -o jsonpath='{.spec.template.spec.securityContext}'
# Должен содержать: runAsNonRoot=true, seccompProfile

# Проверить readOnlyRootFilesystem:
kubectl get statefulset postgres -n database -o jsonpath='{.spec.template.spec.containers[0].securityContext}'

# Проверить resources:
kubectl get statefulset postgres -n database -o jsonpath='{.spec.template.spec.containers[0].resources}'
```

---

## K8s-NetworkPolicies

См. `network_tls.md#k8s-network-policies`. Для PostgreSQL дополнительно:

```yaml
# Разрешить egress postgres к DNS и к самому себе (для репликации)
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
        - protocol: TCP
          port: 53
    # Репликация между pod-ами postgres (если есть)
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
```

---

## Secrets

### НЕПРАВИЛЬНО: секреты в ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-config
data:
  POSTGRES_PASSWORD: mysecretpassword  # БЕЗ ШИФРОВАНИЯ!
```

ConfigMap — plaintext. Любой с `kubectl get cm` видит пароль.

### НЕПРАВИЛЬНО: секреты в env напрямую

```yaml
env:
  - name: POSTGRES_PASSWORD
    value: mysecretpassword  # В YAML-файле, в git!
```

### ПРАВИЛЬНО: Kubernetes Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: postgres-credentials
  namespace: database
type: Opaque
data:
  password: <base64-encoded-password>
```

```yaml
# В StatefulSet:
env:
  - name: POSTGRES_PASSWORD
    valueFrom:
      secretKeyRef:
        name: postgres-credentials
        key: password
```

**Важно**: Kubernetes Secret по умолчанию НЕ зашифрован at-rest (только base64).
Нужно включить encryption at rest:

```yaml
# /etc/kubernetes/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
    providers:
      - aescbc:
          keys:
            - name: key1
              secret: <base64-encoded-32-byte-key>
      - identity: {}
```

### ЕЩЁ ЛУЧШЕ: External Secrets Operator + Vault

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: postgres-credentials
  namespace: database
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: postgres-credentials
    creationPolicy: Owner
  data:
    - secretKey: password
      remoteRef:
        key: secret/database/postgres
        property: password
```

Пароль хранится в HashiCorp Vault (или AWS Secrets Manager). В K8s Secret
попадает автоматически, ротация — в Vault.

### Аудит секретов

```bash
# Найти все Secrets в namespace:
kubectl get secrets -n database -o yaml

# Проверить, кто использует Secret:
kubectl get pod -n database -o jsonpath='{.items[*].spec.containers[*].envFrom}' | jq .

# Найти секреты в ConfigMaps (наш famoso анти-пример):
kubectl get cm -A -o jsonpath='{range .items[*]}{.metadata.namespace}{"/"}{.metadata.name}{": "}{.data}{"\n"}{end}' | \
  grep -iE "(password|secret|token|key)"

# Проверить encryption at rest:
kubectl get --raw /api/v1/secrets  # Если возвращает plaintext — encryption disabled
```

---

## Init-containers

Init containers могут делать pre-setup: настройка прав, инициализация
конфигов, генерация DH-параметров.

```yaml
spec:
  initContainers:
    - name: init-permissions
      image: busybox
      command:
        - sh
        - -c
        - |
          chown -R 999:999 /var/lib/postgresql/data
          chmod 700 /var/lib/postgresql/data
      securityContext:
        runAsUser: 0  # root для chown
        runAsNonRoot: false
      volumeMounts:
        - name: pgdata
          mountPath: /var/lib/postgresql/data
    - name: generate-dh-params
      image: postgres:15.8
      command:
        - sh
        - -c
        - |
          if [ ! -f /etc/postgresql/dhparam.pem ]; then
            openssl dhparam -out /etc/postgresql/dhparam.pem 2048
          fi
      securityContext:
        runAsUser: 999
        runAsNonRoot: true
      volumeMounts:
        - name: config
          mountPath: /etc/postgresql
```

---

## Pod-Security

Kubernetes Pod Security Standards (PSS) — три уровня:
- **Privileged** (небезопасный, по умолчанию в старых кластерах).
- **Baseline** (минимальная защита).
- **Restricted** (максимальная защита).

Для PostgreSQL использовать Restricted:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: database
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

При `restricted` запрещены:
- `privileged: true`
- `hostNetwork`, `hostPID`, `hostIPC`
- `hostPath` volumes
- `runAsUser: 0` (root)
- `allowPrivilegeEscalation: true`
- Большинство capabilities

### Аудит PSS

```bash
# Проверить label namespace:
kubectl get namespace database -o jsonpath='{.metadata.labels}'

# Найти поды, нарушающие restricted:
kubectl get pod -n database -o jsonpath='{range .items[*]}{.metadata.name}{": "}{.spec.securityContext}{"\n"}{end}' | \
  grep -v "runAsNonRoot"
```

---

## Helm

PostgreSQL часто деплоится через Helm-чарты:
- `bitnami/postgresql` — самый популярный.
- `stable/postgresql` — устаревший.
- `ingress-nginx/postgresql` — редко.

### Аудит Helm-чартов

```bash
# Template что реально деплоится:
helm template my-release bitnami/postgresql --values values.yaml > /tmp/rendered.yaml

# Проверить на опасные настройки:
grep -E "(privileged|runAsUser: 0|hostPath|hostNetwork|POSTGRES_PASSWORD:.*value)" /tmp/rendered.yaml

# Проверить image (конкретный тег, не latest):
grep "image:" /tmp/rendered.yaml
```

### Безопасные values.yaml

```yaml
image:
  registry: docker.io
  repository: bitnami/postgresql
  tag: 15.8.0-debian-12-r15  # конкретный tag
  digest: sha256:...  # pin по digest — ещё лучше
  
# НЕ: tag: latest

auth:
  enablePostgresUser: true
  postgresPassword: ""  # из secret
  existingSecret: postgres-credentials
  secretKeys:
    adminPasswordKey: password
    replicationPasswordKey: replication-password

primary:
  podSecurityContext:
    enabled: true
    runAsUser: 999
    runAsGroup: 999
    fsGroup: 999
  containerSecurityContext:
    enabled: true
    runAsNonRoot: true
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    capabilities:
      drop: ["ALL"]
      add: ["CHOWN", "SETUID", "SETGID", "DAC_OVERRIDE"]
  
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 2000m
      memory: 4Gi
  
  persistence:
    enabled: true
    size: 100Gi
    storageClass: encrypted-sc
  
  networkPolicy:
    enabled: true
    allowExternal: false
    explicitNamespacesSelector:
      matchLabels:
        name: app-tier
  
  extendedConfiguration: |
    password_encryption = scram-sha-256
    ssl = on
    ssl_min_protocol_version = 'TLSv1.2'
    log_connections = on
    log_disconnections = on
    log_statement = 'ddl'
    shared_preload_libraries = 'pgaudit'
    pgaudit.log = 'write, ddl'
```

---

## Operators

### CloudNativePG

CNPG — operator от EnterpriseDB. Рекомендуется для production.

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: postgres
  namespace: database
spec:
  instances: 3
  
  postgresql:
    parameters:
      password_encryption: scram-sha-256
      ssl: "on"
      ssl_min_protocol_version: TLSv1.2
      log_connections: "on"
      log_statement: "ddl"
      shared_preload_libraries: pgaudit
      pgaudit.log: "write, ddl"
  
  bootstrap:
    initdb:
      database: appdb
      owner: app
      secret:
        name: postgres-credentials
  
  storage:
    storageClass: encrypted-sc
    size: 100Gi
  
  affinity:
    enablePodAntiAffinity: true
    topologyKey: kubernetes.io/hostname
  
  backup:
    barmanObjectStore:
      destinationPath: s3://backups/
      endpointURL: https://s3.example.com
      s3Credentials:
        accessKeyId:
          name: backup-creds
          key: ACCESS_KEY_ID
        secretAccessKey:
          name: backup-creds
          key: ACCESS_SECRET_KEY
  
  monitoring:
    enabled: true
    podMonitor:
      enabled: true
```

### CrunchyData PGO

Альтернатива, более mature. Аудит — через `pgo show`.

---

## Чеклист

- [ ] Image имеет конкретный тег (не `latest`), желательно pin по digest.
- [ ] Image запускается от non-root пользователя (`postgres`, uid 999).
- [ ] Секреты НЕ в image, НЕ в ConfigMap, НЕ в env напрямую.
- [ ] Секреты в Kubernetes Secret с encryption at rest или в External Secrets Operator.
- [ ] PVC на storageClass с шифрованием.
- [ ] `readOnlyRootFilesystem: true` + tmpfs для /tmp и /var/run/postgresql.
- [ ] `runAsNonRoot: true`, `runAsUser: 999`.
- [ ] `allowPrivilegeEscalation: false`.
- [ ] `capabilities.drop: [ALL]`, add только нужные (CHOWN, SETUID, SETGID, DAC_OVERRIDE).
- [ ] `seccompProfile: RuntimeDefault`.
- [ ] Resource requests и limits установлены.
- [ ] NetworkPolicy: default deny + явные allow для app-tier.
- [ ] Namespace имеет label `pod-security.kubernetes.io/enforce: restricted`.
- [ ] `init.sql` скрипты принадлежат postgres и chmod 600.
- [ ] Логи собираются в central system (Loki, ELK).
- [ ] Бэкапы автоматически (barman / pgBackRest), шифруются.
- [ ] Restore-test ежеквартально.
- [ ] Liveness/readiness probes настроены.
- [ ] Если используется operator (CNPG/PGO) — параметры PostgreSQL заданы в `spec.postgresql.parameters`.
- [ ] Pod anti-affinity для multi-instance (replicas на разных nodes).
- [ ] Monitoring (Prometheus postgres_exporter) настроен.
