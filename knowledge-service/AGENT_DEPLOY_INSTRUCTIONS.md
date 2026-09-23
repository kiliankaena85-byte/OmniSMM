# 🤖 ИНСТРУКЦИЯ ДЛЯ УДАЛЕННОГО AI-АГЕНТА ANTIGRAVITY (REMOTE NODE DEPLOYMENT)

> **Назначение документа**: Данное руководство предназначено для AI-агента Antigravity, запущенного на **удаленном ПК (8 ГБ RAM DDR3)**.
> **Цель агента**: Автономно развернуть узел долговременной векторной памяти OmniSMM 1.0, провести верификацию сервисов и предоставить параметры подключения для основного боевого сервера.

---

## 1. Роль и архитектурные инварианты удаленного узла

Удаленный ПК выполняет роль **выделенного узла векторной памяти (Vector Memory Node)** для разгрузки боевого сервера.

### Жесткие ограничения памяти (RAM Hard Limit $\le 1.28$ ГБ)
На удаленном ПК установлено **8 ГБ DDR3**. Для предотвращения деградации свопа (swap thrashing) и OOM-killer суммарное потребление всех контейнеров зафиксировано на уровне $\le 1.28$ ГБ:

| Контейнер | Назначение | Лимит RAM | Механизм экономии памяти |
| :--- | :--- | :--- | :--- |
| `remote-qdrant` | Векторная БД (Rust) | **384 МБ** | `QDRANT__STORAGE__ON_DISK_PAYLOAD=true` (векторы и пейлоад на диске через mmap) |
| `remote-graphrag-api` | FastAPI RAG шлюз | **512 МБ** | Локальная ультра-легкая модель `all-MiniLM-L6-v2` (80 МБ веса, $\approx 150$ МБ RAM) |
| `remote-graphrag-indexer` | AST-демон кодовой базы | **384 МБ** | `INDEX_INTERVAL=300` (сканирование раз в 5 минут, щадящий режим для DDR3) |
| **ИТОГО** | **Все сервисы** | **$\le 1280$ МБ (1.25 ГБ)** | **Свободно для ОС: $\ge 6.7$ ГБ** |

---

## 2. Предварительная проверка окружения (Pre-Flight Checks)

Перед запуском убедись, что Docker Desktop / Docker daemon запущен и порты свободны:

### Проверка в PowerShell (Windows):
```powershell
# 1. Проверка доступности Docker
docker info

# 2. Проверка, что порты 8100 и 6333 свободны
Get-NetTCPConnection -LocalPort 8100, 6333 -ErrorAction SilentlyContinue

# 3. Переход в рабочую директорию
cd knowledge-service
```

### Проверка в Bash (Linux):
```bash
# 1. Проверка доступности Docker
docker info > /dev/null 2>&1 && echo "Docker OK" || echo "Docker OFFLINE"

# 2. Проверка портов
sudo ss -tulpn | grep -E ':(8100|6333)'

# 3. Переход в директорию
cd knowledge-service
```

---

## 3. Команда развертывания (Deployment Command)

Запусти сборку и старт изолированного профиля для 8 ГБ DDR3:

```bash
docker compose -f docker-compose.remote-8gb.yml up -d --build
```

> **Примечание агенту**: Флаг `--build` обязателен при первом запуске для компиляции образов `remote-graphrag-api` и `remote-graphrag-indexer`.

Ожидаемое время сборки на DDR3: $\approx 2-4$ минуты.

---

## 4. Протокол самопроверки и верификации (Self-Verification)

Выполни последовательно следующие команды проверки и убедись в получении корректных HTTP 200 ответов:

### 4.1. Проверка статуса контейнеров
```bash
docker ps --filter "name=remote-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```
*Ожидаемый результат*: 3 работающих контейнера: `remote-qdrant`, `remote-graphrag-api`, `remote-graphrag-indexer`.

### 4.2. Проверка Healthcheck API (`/health`)
```bash
curl -s http://localhost:8100/health
```
*Ожидаемый ответ*:
```json
{"status":"healthy","qdrant":"healthy","neo4j":"disabled"}
```

### 4.3. Проверка статуса профиля 8GB (`/status`)
```bash
curl -s http://localhost:8100/status
```
*Ожидаемый ответ*:
```json
{
  "status": "online",
  "profile": "8GB_DDR3_LOW_MEMORY",
  "qdrant": "connected",
  "collections_count": 8,
  "embedder": "all-MiniLM-L6-v2",
  "max_memory_limit": "1.28GB"
}
```

### 4.4. Проверка состояния Qdrant
```bash
curl -s http://localhost:6333/readyz
# Ожидается: "all systems go" или HTTP 200

curl -s http://localhost:6333/collections
# Должны отображаться инициализированные коллекции (architecture_decisions, codebase и др.)
```

### 4.5. Тестовый семантический поиск через curl
```bash
curl -s -X POST http://localhost:8100/api/search \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"каталог провайдеры наценка\", \"top_k\": 2}"
```
*Ожидаемый результат*: массив или объект результатов с релевантными сниппетами и полем `assembled_context` (или `results`).

---

## 5. Как передать параметры подключения боевому серверу

После успешного прохождения верификации определи сетевой IP-адрес удаленного ПК:

### Определение IP:
- **Через Tailscale (Рекомендуется для защиты канала)**:
  ```bash
  tailscale ip -4
  # Например: 100.95.120.45
  ```
- **Через локальную сеть (LAN)**:
  - Windows: `(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"}).IPAddress`
  - Linux: `hostname -I | awk '{print $1}'`
  - Например: `192.168.1.50`

### Конфигурация для боевого сервера:
Передай управляющему агенту или оператору следующую строку конфигурации для добавления в `.env` боевого сервера:

```env
# Параметры подключения к удаленному узлу памяти (8GB Node):
VECTOR_MEMORY_URL=http://<REMOTE_IP>:8100
KNOWLEDGE_API_TOKEN=smmplan_remote_memory_token_2026
```

> **Безопасность**: Запросы к API используют заголовок `x-api-key: smmplan_remote_memory_token_2026`. Если токен изменен в `.env` на удаленном ПК, убедись, что на боевом сервере прописан идентичный токен.

---

## 6. Регламент действий при сбоях (Troubleshooting Runbook)

| Проблема | Причина | Действие агента |
| :--- | :--- | :--- |
| **Порт 8100 уже занят** | Старый процесс Python или Node.js | `Stop-Process -Id (Get-NetTCPConnection -LocalPort 8100).OwningProcess -Force` (Win) или `sudo fuser -k 8100/tcp` (Linux). |
| **Qdrant не запускается (OOM)** | Недостаток системной памяти | Проверить `docker stats`. Убедиться, что не запущены сторонние тяжелые программы. Проверить своп: `Get-CimInstance Win32_PageFileUsage`. |
| **Ошибка при `/health`: Service unhealthy** | Qdrant еще инициализирует коллекции | Подождать 15–20 секунд после `docker compose up` до завершения создания коллекций в `mcp_server.py`. |
| **Коллекции пустые (`points_count: 0`)** | Индексатор еще не завершил первый прогон | Заглянуть в логи: `docker logs --tail 50 remote-graphrag-indexer`. Индексация выполняется инкрементально с интервалом 300 сек. |
