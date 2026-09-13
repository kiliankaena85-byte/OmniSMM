# SPEC-2026-09-13: Production Hardening Triad (PROD-SEC-2026)

## 1. Metadata
- **Status:** APPROVED & ACTIVE
- **Date:** 2026-09-13
- **Author:** OmniSMM Core Security & Architecture Team
- **Standard Gate:** Rule 0.8 & 3.6 (`PROD-SEC-2026`), OWASP ASVS 4.0.3 Level 2, PCI DSS 4.0
- **Scope:** Redis Hardening, Content-Security-Policy Strict-Dynamic Migration, Direct SMTPS Verification

---

## 2. Executive Summary & Context
В соответствии с контрактом платформы `AGENTS.md` (п. 0.8), выкатка платформы в рабочий продакшн блокируется до полного закрытия и верификации трёх задач безопасности:
1. **[SEC-001] Redis Authentication & Transit Encryption Hardening:** Устранение ворнинга *"Redis is running in production without explicit authentication"* и предотвращение несанкционированного доступа к кэшу и сессиям.
2. **[SEC-002] Content-Security-Policy (Strict-Dynamic Nonce Migration):** Зачистка устаревших директив `'unsafe-inline'` и `'unsafe-eval'` из директивы `script-src` в `src/proxy.ts`, обеспечение совместимости клиентских компонентов React 19 с криптографическим Nonce.
3. **[SEC-003] Production Direct SMTP Verification:** Проверка прямой доставки почты по порту 465 без локальных прокси/TUN-адаптеров к SMTP Яндекса/Mail.ru, подтверждение успешной отправки Magic Link.

---

## 3. Technical Requirements & Hard Invariants

### 3.1. [SEC-001] Redis Authentication Invariant
- **Rule:** В окружении `NODE_ENV === 'production'` любая попытка инициализации клиента `ioredis` без явных учетных данных аутентификации обязана вызывать `FATAL [SECURITY]: SEC-001 Violation!` и аварийно завершать процесс.
- **Поддерживаемые форматы аутентификации:**
  - `redis://:<password>@<host>:<port>`
  - `redis://<user>:<password>@<host>:<port>`
  - `rediss://...` (TLS)
  - Передача пароля через `explicitPassword` или `process.env.REDIS_PASSWORD`.
- **Единый контур:** Валидация обязана применяться как к основному инстансу `redis` (`src/lib/redis.ts`), так и к очередям `BullMQ` (`src/lib/queue-manager.ts`).

### 3.2. [SEC-002] Content-Security-Policy (Strict-Dynamic Nonce) Invariant
- **Rule:** Директива `script-src` в продакшене обязана строго следовать стандарту:
  `'self' 'nonce-${nonce}' 'strict-dynamic' ...`
- **Запрет:** В продакшене категорически запрещено наличие `'unsafe-inline'` и `'unsafe-eval'` в `script-src`.
- **Single Source of Truth:** Генерация заголовка `Content-Security-Policy` осуществляется исключительно в `src/proxy.ts`. Вспомогательные реверс-прокси (Nginx) не должны внедрять конфликтующие дублирующие заголовки.
- **Разрешенные платежные и доверенные домены:**
  - `frame-src`: ЮKassa (`https://yookassa.ru`), Robokassa (`https://auth.robokassa.ru`), CryptoBot (`https://pay.crypt.bot`), Cloudflare Turnstile (`https://challenges.cloudflare.com`), Yandex SmartCaptcha (`https://smartcaptcha.yandexcloud.net`), банковские шлюзы СБП (`sberbank.ru`, `nspk.ru`, `tinkoff.ru`, `vtb.ru`).
  - `frame-ancestors`: `'self'`.

### 3.3. [SEC-003] Direct SMTPS Socket Verification Invariant
- **Rule:** На целевом сервере сокетное соединение к доверенным почтовым провайдерам (порт 465) обязано устанавливаться напрямую по протоколу TLS без перенаправления через промежуточные HTTP/SOCKS5 прокси.
- **Метод проверки:** `verifyDirectSmtpConnection(host, port, timeoutMs)` выполняет прямое сокетное TLS-рукопожатие и возвращает время отклика (`durationMs`).
- **Graceful Fallback:** Если SMTP не настроен в конфигурации, функция `sendMagicLink` логирует безопасный авторизационный токен в консоль сервера, предотвращая сбой чекаута или авторизации.

---

## 4. Verification Suite & Criteria
1. **Vitest Unit Suite:** `src/__tests__/security/production-hardening-triad.test.ts` (11/11 PASS).
2. **CLI Verifier:** `scripts/verify-production-hardening.ts` (100% PASS для SEC-001, SEC-002, SEC-003).
3. **Type Check & Secret Audit:** `npx tsc --noEmit` (0 ошибок) и `node scripts/check-bundle-secrets.mjs` (0 утечек).
