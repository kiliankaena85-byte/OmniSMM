# Управление Ядром Mihomo через Windows Named Pipe

## 1. Зачем Нужен Named Pipe

В большинстве сборок Clash Verge Rev параметр `external-controller` отключен (`external-controller: ''`), либо служба `clash_verge_service` работает под системным аккаунтом `SYSTEM`, в то время как пользовательский процесс `clash-verge.exe` работает без административных прав.

Чтобы обеспечить безопасное, быстрое и неблокируемое взаимодействие, ядро Mihomo регистрирует именованный канал Windows:
`\\.\pipe\verge-mihomo`

Канал доступен для локальных процессов текущего пользователя и позволяет посылать полноразмерные HTTP/1.1 REST-запросы.

---

## 2. Протокол Обмена Данными

Запросы формируются в формате чистого HTTP/1.1 поверх именованного потока `NamedPipeClientStream`:

```http
GET /version HTTP/1.1
Host: localhost
Authorization: Bearer set-your-secret
Connection: close
```

> **ВАЖНО**: При отправке запроса ОБЯЗАТЕЛЬНО указывать заголовок `Connection: close`, в противном случае соединение не закроется сервером после передачи тела, и `StreamReader.ReadToEnd()` в PowerShell/C# зависнет в ожидании EOF.

---

## 3. Полный Справочник REST API Ядра Mihomo

### 1. Проверка статуса:
- **Запрос**: `GET /version`
- **Ответ**: `{"meta":true,"version":"v1.19.29"}`

### 2. Чтение текущего конфига:
- **Запрос**: `GET /configs`
- **Ответ**: JSON с полным дампом параметров (`mode`, `tun`, `ports`, `log-level`).

### 3. Горячая смена режима маршрутизации:
- **Запрос**: `PATCH /configs`
- **Тело**:
  ```json
  { "mode": "rule" }
  ```
- **Ответ**: `HTTP 204 No Content`

### 4. Горячая перезагрузка конфигурации (Hot-Reload):
- **Запрос**: `PUT /configs?force=true`
- **Тело**:
  ```json
  { "path": "C:\\Users\\Shadow\\AppData\\Roaming\\io.github.clash-verge-rev.clash-verge-rev\\clash-verge.yaml" }
  ```
- **Ответ**: `HTTP 204 No Content`
- **Эффект**: Ядро на лету перечитывает YAML-файл, перестраивает списки правил, переподключает провайдеры и обновляет DNS-таблицу без разрыва активных системных соединений.

### 5. Сброс DNS и Fake-IP кеша:
- **Запрос**: `POST /dns/flush`
- **Ответ**: `HTTP 204 No Content`

### 6. Мониторинг соединений в реальном времени:
- **Запрос**: `GET /connections`
- **Ответ**: JSON со списком активных сокетов:
  ```json
  {
    "downloadTotal": 1492023,
    "uploadTotal": 394201,
    "connections": [
      {
        "id": "c8f2...",
        "metadata": {
          "host": "panel.smmtoolbox.ru",
          "destinationPort": "443"
        },
        "rule": "Domain",
        "rulePayload": "panel.smmtoolbox.ru",
        "chains": ["DIRECT"]
      }
    ]
  }
  ```
