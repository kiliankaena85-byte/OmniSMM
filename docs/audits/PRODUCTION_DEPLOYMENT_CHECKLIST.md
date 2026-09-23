# Production Deployment Checklist
## SMMplan / SMMflux — Подготовка к продакшн деплою

> **Внимание:** Сервер ещё не готов, но этот чеклист фиксирует все требования.  
> Выполнять последовательно. Каждый пункт должен быть проверен и отмечен **перед** запуском.

---

## 1. Pre-Deploy (локально)

### Сборка и тесты
- [ ] `npx tsc --noEmit` → PASS (0 ошибок типов)
- [ ] `npm run build` → PASS (Next.js production build без ошибок)
- [ ] `npx vitest run` → PASS (все тесты зелёные)
- [ ] `npx prisma migrate deploy` → применены все миграции (**НЕ** `db push`)
- [ ] `npx eslint src --max-warnings 0` → 0 предупреждений

### Конфигурация окружения
- [ ] `NODE_ENV=production` задан в `.env.production`
- [ ] `next.config.ts` → `ignoreBuildErrors: false` (не замалчивать ошибки TS)
- [ ] `next.config.ts` → `ignoreDuringBuilds: false` (не замалчивать ошибки ESLint)
- [ ] `ENABLE_DEV_BYPASS` **НЕ** установлен или `=false`
- [ ] `ENABLE_DEV_ROUTES` **НЕ** установлен или `=false`
- [ ] `INTERNAL_API_SECRET` установлен и достаточно длинный (≥ 32 символа)
- [ ] `APP_ENCRYPTION_KEY` — 64-символьный hex, хранится в секрете
- [ ] `DATABASE_URL` → PostgreSQL продакшн (не dev/test)
- [ ] `REDIS_URL` → Redis с паролем, не открытый
- [ ] `NEXTAUTH_SECRET` → сложный случайный ключ
- [ ] `NEXTAUTH_URL` → `https://smmplan.pro` (и `https://smmflux.ru` для второго тенанта)
- [ ] Webhook-секреты ЮKassa / Robokassa заданы

### Secrets Audit
- [ ] Запустить `git log --all --full-history -- '*.env*'` → нет чувствительных данных
- [ ] `rg "smm_" src --include="*.ts" -l` → нет захардкоженных API-ключей
- [ ] `rg "sk_live" src` → нет production keys в коде

---

## 2. Server Infrastructure

### Docker Compose (Production)
- [ ] Используется `docker-compose.prod.yml`, **НЕ** dev-compose
- [ ] `NODE_ENV=production` в Docker environment
- [ ] Веб-сервер и воркеры (`npm run worker`) запускаются **параллельно** (см. `docker-compose.yml`)
- [ ] Health check настроен для web-контейнера
- [ ] Restart policy: `unless-stopped` или `on-failure`

### PostgreSQL
- [ ] PostgreSQL **НЕ** опубликован на внешний интерфейс (`127.0.0.1:5432` только)
- [ ] Создан отдельный пользователь БД (не `postgres`)
- [ ] Пароль БД: минимум 32 символа случайной строки
- [ ] Регулярные бэкапы настроены (cron `pg_dump` → S3 или offsite)
- [ ] `pg_hba.conf` → только md5/scram-sha-256, не trust
- [ ] `max_connections` настроен под нагрузку

### Redis
- [ ] Redis **НЕ** опубликован на внешний интерфейс
- [ ] Redis требует пароль (`requirepass`)
- [ ] `maxmemory-policy noeviction` (чтобы не терять очереди BullMQ)
- [ ] `appendonly yes` (AOF persistence для очередей)
- [ ] `maxmemory` установлен (напр. `512mb`)
- [ ] Redis bind только `127.0.0.1`

### Nginx / Reverse Proxy
- [ ] SSL сертификат (Let's Encrypt) для `smmplan.pro` и `smmflux.ru`
- [ ] HTTPS redirect (301 с http → https)
- [ ] `www.smmplan.pro` → redirect → `smmplan.pro`
- [ ] `www.smmflux.ru` → redirect → `smmflux.ru`
- [ ] Rate limiting: `limit_req_zone` настроен (например 10r/s per IP)
- [ ] `client_max_body_size 10m` (или под нужды проекта)
- [ ] Timeouts: `proxy_read_timeout 60s`, `proxy_connect_timeout 10s`
- [ ] Security headers:
  ```nginx
  add_header X-Content-Type-Options nosniff;
  add_header X-Frame-Options DENY;
  add_header X-XSS-Protection "1; mode=block";
  add_header Referrer-Policy strict-origin-when-cross-origin;
  add_header Permissions-Policy "geolocation=(), microphone=()";
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
  ```
- [ ] Скрыть `nginx` в заголовке (`server_tokens off`)
- [ ] Закрыть `.env`, `prisma/schema.prisma` от веба

---

## 3. DNS

### smmplan.pro
- [ ] `smmplan.pro` A-запись → IP сервера
- [ ] `www.smmplan.pro` CNAME → `smmplan.pro` (или A → IP)
- [ ] TTL снижен за 48 часов до деплоя (300 сек) и возвращён после

### smmflux.ru
- [ ] `smmflux.ru` A-запись → IP сервера
- [ ] `www.smmflux.ru` CNAME → `smmflux.ru`

### Email (для чеков / поддержки)
- [ ] SPF-запись настроена для отправляющего домена
- [ ] DKIM-подпись настроена
- [ ] DMARC-политика: `p=reject` или `p=quarantine`
- [ ] MX-записи (если принимаем входящие тикеты по email)

---

## 4. SEO & Indexing

### Поисковые системы
- [ ] **Yandex Webmaster**: добавить оба домена `smmplan.pro` и `smmflux.ru`
- [ ] **Google Search Console**: добавить оба домена
- [ ] Sitemap подтверждён: `https://smmplan.pro/sitemap.xml` → доступен, валиден
- [ ] Sitemap отправлен через GSC и Яндекс Вебмастер

### Техническое SEO
- [ ] `robots.txt` проверен: `/admin`, `/api`, `/dev` закрыты для ботов
- [ ] Canonical проверен через curl:
  ```bash
  curl -s https://smmplan.pro/ | grep canonical
  # должно содержать <link rel="canonical" href="https://smmplan.pro/"/>
  ```
- [ ] Canonical не ссылается на `lovable.pro`
- [ ] Meta OG-теги заполнены (og:title, og:description, og:image)
- [ ] JSON-LD Schema разметка на главных страницах
- [ ] Core Web Vitals — LCP < 2.5s, CLS < 0.1 (проверить через PageSpeed Insights)
- [ ] `noindex` на `/admin`, `/api`, `/dev/*`

---

## 5. Security

### Dev Routes
- [ ] `GET /api/dev/mock-payment` → `404` в production (проверить `curl`)
- [ ] `GET /api/dev/test-*` → `404` в production
- [ ] `ENABLE_DEV_BYPASS=false` или переменная не задана

### Admin Access
- [ ] `/admin` требует аутентификацию (401/302 без сессии)
- [ ] Рассмотреть IP allowlist для `/admin` через Nginx
- [ ] Рассмотреть MFA для admin-аккаунтов

### Webhooks
- [ ] Webhook-подписи ЮKassa проверяются в `src/app/api/payment/yookassa/webhook/route.ts`
- [ ] Webhook-подписи Robokassa проверяются
- [ ] CryptoBot webhook проверяется (если включён)
- [ ] Проверить: повторная отправка webhook не приводит к двойному зачислению (idempotencyKey)

### Cookies & Sessions
- [ ] Session cookie: `Secure`, `HttpOnly`, `SameSite=Lax`
- [ ] `NEXTAUTH_SECRET` уникален для production (не тестовый)

### Данные
- [ ] GDPR / 152-ФЗ: политика конфиденциальности опубликована
- [ ] Consent форма работает
- [ ] PII не логируется в открытый лог

---

## 6. Monitoring & Alerting

### Frontend Analytics
- [ ] **Yandex Metrica** — счётчик установлен на `smmplan.pro` и `smmflux.ru`
- [ ] Цели настроены: регистрация, первый заказ, пополнение баланса

### Error Tracking
- [ ] Sentry / аналог настроен (если используется)
- [ ] Алерты на 5xx ошибки

### Uptime Monitoring
- [ ] UptimeRobot / Better Uptime / аналог следит за `smmplan.pro`
- [ ] Уведомление в Telegram при downtime

### Logs
- [ ] Логи ротируются (`logrotate` или Docker logging driver с max-size)
- [ ] Логи не содержат PII (email, IP) без необходимости

### Backup
- [ ] Cron: ежедневный `pg_dump` → сохраняется ≥ 7 дней
- [ ] Тест восстановления из бэкапа выполнен хотя бы раз
- [ ] Redis snapshot/AOF бэкап (если очереди критичны)

---

## 7. Financial System

### WalletOps & Ledger
- [ ] `WalletOps` протестирован (unit tests PASS)
- [ ] Ledger reconciliation запускается по расписанию
- [ ] `block_ledger_mutation` trigger активен в БД (проверить `\df` в psql)

### Payment Gateways
- [ ] ЮKassa: тестовый магазин → production магазин переключён
- [ ] Robokassa: тестовый режим → боевой режим
- [ ] Webhook URL зарегистрирован в панели провайдера
- [ ] Тестовый платёж выполнен в production

### Support Balance Policy
- [ ] `BalanceAdjustmentPolicy` GLOBAL создана в БД
- [ ] Лимиты установлены: `maxCreditPerRequest`, `maxTotalPerDay`
- [ ] `requireConsent: true` (сотрудники подписали ответственность)

### Employee Consent
- [ ] `EmployeeResponsibilityConsent` заполнены для всех staff-пользователей
- [ ] Документы с версиями юридических текстов добавлены (`LegalDocumentVersion`)

---

## 8. Final Check

- [ ] **`curl https://smmplan.pro/api/dev/mock-payment`** → `404`
- [ ] **`curl https://smmplan.pro/admin`** → redirect к login (302), не 200
- [ ] **`curl https://smmplan.pro/sitemap.xml`** → корректный XML
- [ ] **`curl https://smmplan.pro/robots.txt`** → `Disallow: /admin`
- [ ] **`curl https://smmplan.pro/api/v2 -d "key=invalid&action=balance"`** → `{"error":"Incorrect request or API key"}`
- [ ] SSL-сертификат: `curl -vI https://smmplan.pro 2>&1 | grep "SSL certificate"` → valid
- [ ] Проверить заголовки безопасности: `curl -I https://smmplan.pro | grep -i "x-frame\|x-content\|strict"`

---

## 9. Git & Rollback

- [ ] Продакшн деплой зафиксирован тегом: `git tag v1.0.0-prod && git push origin v1.0.0-prod`
- [ ] Rollback план задокументирован (какую команду запустить при откате)
- [ ] Staging/canary развёртывание протестировано перед полным деплоем (если применимо)

---

*Дата создания: 2026-07-28*  
*Владелец: DevOps / Lead Developer*
