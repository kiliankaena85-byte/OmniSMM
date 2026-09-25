# Security-by-Design & Production Post-Mortem Invariants (OmniSMM 1.0)
# Стандарты безопасности OWASP/PCI DSS и жесткие инварианты предотвращения производственных сбоев

## 1. Безопасность по Умолчанию (Security-by-Design & Pentest Immunity)
> 🛡️ **BLOCKING SECURITY MANDATE.** При разработке ЛЮБОГО проекта, компонента или новой функциональности агент ОБЯЗАН с самого начала закладывать архитектуру с защитой от пентестов и строго соблюдать мировые стандарты безопасности:

1. **Стандарты безопасности обязательного соблюдения:**
   - **OWASP Top 10:2025** (A01 Broken Access Control, A02 Security Misconfiguration, A04 Cryptographic Failures, A05 Injection, A07 Authentication Failures, etc.).
   - **OWASP ASVS 4.0.3** (Application Security Verification Standard) & **WSTG v4.2**.
   - **PCI DSS 4.0** (TLS 1.2/1.3, запрет устаревших CBC-шифров, безопасная обработка платежных реквизитов).
   - **RFC 9116** (Обязательное наличие `/.well-known/security.txt`).
   - **RFC 9331** (Стандартизированные заголовки `RateLimit-Limit`, `RateLimit-Reset`, `RateLimit-Policy` на публичных API).

2. **Обязательная сверка стандартов перед стартом (Live Standard Verification):**
   - Перед началом проектирования или реализации фич, связанных с аутентификацией, платежами, API или маршрутизацией, агент ОБЯЗАН проверить актуальные стандарты через поиск в интернете (`search_web`) или официальную документацию (`read_url_content`).
   - Запрещено использовать устаревшие практики (например, незащищенные GET-эндпоинты прямого входа, раскрытие отладочных путей в `robots.txt`, отсутствие флагов у cookies при сбросе).

3. **Ключевые инварианты кода (Pentest Immunity Rules):**
   - ❌ **Zero-Secrets in Client Bundles:** Никаких `NEXT_PUBLIC_*_SECRET`, паролей или ключей в клиентском коде (`use client`).
   - ❌ **No Backdoor/Debug Endpoints in Production:** Все тестовые/QA эндпоинты изолируются через Server Actions со строгой проверкой `QA_SECRET_KEY` на сервере через `crypto.timingSafeEqual`.
   - ❌ **No Information Disclosure:** Запрещено раскрывать внутренние пути (`/dev`, `/operator`, `/test`) в публичном `robots.txt` (использовать `X-Robots-Tag: noindex, nofollow` в middleware).
   - ✅ **Symmetric Cookie Sanitation:** Любая очистка сессионных кук обязана содержать полный набор атрибутов: `Secure; HttpOnly; SameSite=Lax; MaxAge=0; Expires=0; Path=/`.
   - ✅ **Granular RBAC Enforcement:** Разграничение прав ролей (Owner, Admin, Manager, Support, Cashier, User) проверяется на уровне каждого Server Action через `requireStaffPermission()`.

## 2. Жесткие Инварианты Надежности и Постмортема (Production Post-Mortem Invariants)
- ❌ **Multi-Tenant Purge Hazard:** Запрещено оценивать возможность удаления сущностей (категорий, услуг) только по счетчику активного тенанта (`tenantServicesCount === 0`). При наличии элементов в базе (`globalServicesCount > 0`) деструктивные действия обязаны блокироваться.
- ❌ **Unverified Gateway Refund Trap:** Запрещено переводить заявку на возврат на карту в статус `EXECUTED` для шлюзов без API автоматического возврата (Robokassa, CryptoBot). Обязательно требовать `manualConfirmed: true` от оператора с фиксацией в аудите.
- ❌ **Dev Runners in Production Containers:** Запрещено указывать `tsx` или пути к `src/` в `docker-compose.prod.yml` и `docker-compose.staging.yml`. Использовать строго скомпилированные точки входа (`node bot.js`, `node worker.js`).
- ✅ **Infinite Infrastructure Backoff:** Сетевые драйверы Redis и PostgreSQL обязаны использовать бесконечный цикл переподключения с прогрессивным backoff (до 3000 мс), исключая обрыв соединения после N попыток.
- ✅ **54-FZ Fiscal Schema Completeness:** Чеки 54-ФЗ во всех шлюзах (Робокасса, ЮKassa) обязаны содержать контактные данные покупателя (`client: { email }` / `phone`) согласно требованиям ФФД 1.2.
- ✅ **WHATWG URL Flag Invariant:** Для безымянных флагов URL (например, `?boost`) использовать прямое назначение `urlObj.search = '?boost'`, исключая появление артефактного знака `?boost=`.
- ✅ **Edge Proxy Trailing Slash Normalization:** Словари редиректов в `src/proxy.ts` обязаны нормализовать завершающие слэши (`pathname.replace(/\/+$/, '')`).
- ✅ **Exact Financial Telemetry:** Метрики дашборда обязаны разделять Net Profit (в рублях за вычетом COGS, комиссий и УСН 6%) и Margin (в %), а процент успешности заказов рассчитывать строго по терминальным заказам без учета неоплаченных корзин.
