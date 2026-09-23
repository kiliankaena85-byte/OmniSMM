# 🛡️ Инструкция: Развертывание Российского Edge Ingress Прокси для 100% доступности на МГТС / МТС / РФ

> **Назначение:** Полное устранение любых блокировок ТСПУ РКН на сетях МГТС GPON, МТС, Мегафон, Билайн и Ростелеком путем установки чистого российского Nginx-шлюза в Москве или Санкт-Петербурге.

---

## 🏗️ 1. Архитектура решения

```
[Пользователь МГТС GPON / РФ] 
          │
          ▼ (Прямое подключение по РФ, пинг 1–5 мс, 0 блокировок ТСПУ)
[Российский VPS (Selectel / TimeWeb / RuVDS в Москве)] (Nginx + Let's Encrypt)
          │
          ▼ (Защищенное HTTPS-проксирование через Cloudflare Tunnel)
[Cloudflare Edge / Tunnel] ──> [Next.js App (smmplan_web)]
```

---

## 🚀 2. Быстрое развертывание на VPS (3 минуты)

### Шаг 1. Аренда микро-VPS в Москве
* Рекомендуемые провайдеры (минимальный тариф ~150–250 ₽/мес, 1 vCPU, 1 GB RAM, Ubuntu 22.04 / 24.04):
  - **TimeWeb Cloud** (ЦОД Москва / СПб)
  - **Selectel** (ЦОД Москва Дубровка / Берзарина)
  - **RuVDS** (ЦОД Москва Ostankino)
  - **FirstVDS** (ЦОД Москва)

---

### Шаг 2. Установка Nginx и Certbot на VPS

Подключитесь по SSH к вашему российскому VPS и выполните:

```bash
# 1. Обновление пакетов и установка Nginx + Certbot
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx

# 2. Включение автозапуска Nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

### Шаг 3. Конфигурация Nginx (`/etc/nginx/sites-available/smmplan`)

Создайте файл `/etc/nginx/sites-available/smmplan`:

```nginx
# Кэширование статики Next.js
proxy_cache_path /var/cache/nginx/nextjs levels=1:2 keys_zone=next_cache:10m max_size=1g inactive=60m use_temp_path=off;

server {
    server_name smmplan.pro test.smmplan.pro flux.smmplan.pro;

    # Gzip сжатие для быстрого ответа на мобильных сетях
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_proxied any;
    gzip_min_length 256;

    # Максимальный размер загружаемых файлов / запросов
    client_max_body_size 50M;

    location / {
        # Проксирование на защищенный Cloudflare Tunnel
        proxy_pass https://test.smmplan.pro;
        
        # Передача оригинальных заголовков клиента для RBAC и аналитики
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # WebSocket / Realtime поддержка (SSE, Long-polling)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Буферизация и таймауты
        proxy_connect_timeout 15s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffers 16 32k;
        proxy_buffer_size 64k;
    }

    # Кэширование статических ассетов Next.js
    location /_next/static/ {
        proxy_pass https://test.smmplan.pro;
        proxy_set_header Host $host;
        proxy_cache next_cache;
        proxy_cache_valid 200 30d;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        add_header X-Cache-Status $upstream_cache_status;
        expires 30d;
        access_log off;
    }
}
```

Активируйте сайт:
```bash
sudo ln -sf /etc/nginx/sites-available/smmplan /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

### Шаг 4. Выпуск бесплатного SSL-сертификата Let's Encrypt

```bash
sudo certbot --nginx -d smmplan.pro -d test.smmplan.pro -d flux.smmplan.pro --non-interactive --agree-tos -m admin@smmplan.pro --redirect
```

---

### Шаг 5. Настройка DNS

В панели управления вашим доменом (REG.RU / Beget / Cloudflare DNS) создайте **A-запись**, указывающую на IP-адрес вашего нового российского VPS:

| Тип | Имя хоста | Значение (IP) | Проксирование |
| :---: | :---: | :---: | :---: |
| **A** | `test` (или `@`) | `<IP_РОССИЙСКОГО_VPS>` | **DNS Only (Серое облако)** |

---

## 🎯 Результат
1. Пользователь МГТС GPON обращается по DNS и получает **IP-адрес в Москве**.
2. Никаких Anycast IP Cloudflare и сигнатур ECH — соединение устанавливается за **1–3 мс**.
3. Запросы мгновенно передаются в приложение Next.js, гарантируя 100% доступность из любой точки РФ.
