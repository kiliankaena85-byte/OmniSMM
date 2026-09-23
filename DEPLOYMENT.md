# Руководство по развертыванию (Production Deployment Guide)

Это официальное руководство по быстрому развертыванию инфраструктуры платформы **SMMplan** на целевых серверах (VPS/Dedicated). При следовании данной инструкции развертывание занимает не более 1 часа.

---

## 1. Минимальные системные требования
- **ОС**: Ubuntu 22.04 / 24.04 LTS (или Debian 12)
- **CPU**: 2+ vCPU
- **RAM**: 4 ГБ (Минимум 2 ГБ + Swap 2 ГБ)
- **Disk**: 20+ ГБ SSD/NVMe
- **ПО**: Docker v24+ и Docker Compose v2+

---

## 2. Настройка DNS заметок
Убедитесь, что для ваших доменов прописаны A-записи, указывающие на IP-адрес вашего боевого VPS:
- `smmplan.pro` -> `YOUR_SERVER_IP`
- `www.smmplan.pro` -> `YOUR_SERVER_IP`
- `smmflux.ru` -> `YOUR_SERVER_IP`
- `www.smmflux.ru` -> `YOUR_SERVER_IP`

---

## 3. Подготовка окружения на сервере

1. Клонируйте репозиторий проекта на боевой сервер:
   ```bash
   git clone git@github.com:kiliankaena85-byte/SMMplan.git /opt/smmplan
   cd /opt/smmplan
   ```

2. Скопируйте файл конфигурации окружения из шаблона:
   ```bash
   cp .env.production.example .env.production
   ```

3. Отредактируйте `.env.production`, заполнив безопасные пароли СУБД, секреты сессий и ключи платежных шлюзов:
   ```bash
   nano .env.production
   ```
   > ⚠️ **ВАЖНО**: Проверьте, чтобы `ENABLE_DEV_ROUTES` и `ENABLE_DEV_BYPASS` были установлены в `false`.

---

## 4. Выпуск SSL-сертификатов Let's Encrypt (Certbot)

Первоначальный выпуск SSL-сертификатов:
```bash
mkdir -p certbot/conf certbot/www

# Первоначальный старт Nginx для прохождения ACME HTTP-challenge
docker compose -f docker-compose.prod.yml up -d nginx

# Выпуск сертификатов certbot
docker run -it --rm --name certbot \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d smmplan.pro -d www.smmplan.pro -d smmflux.ru -d www.smmflux.ru \
  --email admin@smmplan.pro --agree-tos --no-eff-email
```

---

## 5. Сборка и запуск контейнеров

1. Соберите production-образ приложения (Multi-stage build):
   ```bash
   docker compose -f docker-compose.prod.yml build
   ```

2. Запустите полный стек приложений в фоновом режиме:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

3. Инициализируйте необходимые базные данные и шаблоны оферты / legal-документов:
   ```bash
   docker compose -f docker-compose.prod.yml exec app npx tsx scripts/seed-legal-cms.ts
   ```

---

## 6. Проверка и верификация деплоя

Проверьте корректность ответа всех сервисов:

```bash
# 1. Проверка заголовков HTTPS и сертификата
curl -I https://smmplan.pro

# 2. Проверка эндпоинта проверки здоровья (Health check)
curl http://localhost:3000/api/health

# 3. Проверка публичного доступа к robots.txt
curl https://smmplan.pro/robots.txt
```

---

## 7. Индексация в поисковых системах
После успешного старта загрузите карты сайта `https://smmplan.pro/sitemap.xml` в:
- Яндекс.Вебмастер (`https://webmaster.yandex.ru`)
- Google Search Console (`https://search.google.com/search-console`)

---

## 8. Резервное копирование (Backups)

Настройте Cron-задачу на сервере для ежедневных дампов PostgreSQL:
```bash
0 3 * * * docker compose -f /opt/smmplan/docker-compose.prod.yml exec -T db pg_dump -U smmplan smmplan | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz
```

---

## 9. Логирование и Мониторинг

- Просмотр логов веб-приложения:
  ```bash
  docker compose -f docker-compose.prod.yml logs -f app
  ```
- Просмотр логов фоновых воркеров (BullMQ):
  ```bash
  docker compose -f docker-compose.prod.yml logs -f worker
  ```
- Просмотр логов Nginx:
  ```bash
  docker compose -f docker-compose.prod.yml logs -f nginx
  ```

---

## 10. План отката (Rollback Plan)

Если новый деплой содержит критический баг:
```bash
# Возврат на предыдущий стабильный коммит git
git checkout HEAD~1

# Пересборка и перезапуск
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d --force-recreate
```
