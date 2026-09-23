# Нагрузочное тестирование SMMplan (k6 Load Testing Suite)

В этом каталоге содержатся скрипты нагрузочного и стресс-тестирования платформы **SMMplan / SMMflux** с использованием инструмента **Grafana k6**.

---

## 🛠 1. Установка k6

### Windows (winget / choco / scoop)
```powershell
winget install k6 --source winget
# или через Chocolatey:
choco install k6
```

### macOS (Homebrew)
```bash
brew install k6
```

### Linux (Debian / Ubuntu)
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

---

## 🚀 2. Описание и запуск скриптов

### 2.1. Нагрузка на главную страницу (`k6-homepage.js`)
Проверяет пропускную способность лендинга, время отклика SSR-страниц и статических ресурсов.
```bash
k6 run load-tests/k6-homepage.js
# Запуск для конкретного домена/стеда:
k6 run -e BASE_URL=https://smmplan.pro load-tests/k6-homepage.js
```

### 2.2. Нагрузка на каталог услуг (`k6-services.js`)
Симулирует просмотр каталога, переходы по соцсетям и категориям (Telegram, VK, Instagram).
```bash
k6 run load-tests/k6-services.js
```

### 2.3. Нагрузка на сценарий заказа (`k6-order.js`)
Тестирует форму создания заказа, валидаторы и выбор платёжных систем.
```bash
k6 run load-tests/k6-order.js
```

### 2.4. Нагрузка на B2B API v2 (`k6-api.js`)
Проверяет производительность API-эндпоинтов реселлеров (`/api/v2?action=balance`, `services`, `status`).
```bash
k6 run -e API_KEY=smm_live_your_key_here load-tests/k6-api.js
```

---

## 📊 3. Ключевые метрики и интерпретация результатов

При выполнении каждого скрипта k6 выводит сводный отчёт со следующими метриками:

| Метрика | Описание |
|---|---|
| `http_req_duration` | Полное время выполнения HTTP-запроса (latency). |
| `http_req_failed` | Процент ошибочных ответов (4xx, 5xx). |
| `http_reqs` | Суммарное число запросов и интенсивность в секунду (RPS). |
| `vus` | Число активных виртуальных пользователей в данный момент. |
| `p(95)` / `p(99)` | 95-й и 99-й перцентили времени отклика. |

---

## 🎯 4. Допустимые пороги (Thresholds & SLA)

Все скрипты содержат автоматические критерии успешности (Thresholds):

* **Главная страница (`/`):**
  * `http_req_failed` < 1%
  * `p(95) http_req_duration` < 500ms
* **Каталог услуг (`/services`):**
  * `http_req_failed` < 2%
  * `p(95) http_req_duration` < 800ms
* **B2B API v2 (`/api/v2`):**
  * `http_req_failed` < 1%
  * `p(99) http_req_duration` < 400ms

---

## 💡 5. Полезные советы при прогонах

1. **Перед деплоем на Production:** запускайте тесты на Staging-окружении с аналогичной конфигурацией PostgreSQL и Redis.
2. **Мониторинг ресурсов:** во время прогона k6 следите за загрузкой CPU и RAM контейнеров `docker stats`.
3. **Кэширование Redis:** низкое время отклика на `/api/v2?action=services` свидетельствует об эффективной работе Redis-кэширования каталога.
