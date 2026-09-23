# Отчёт по аудиту и устранению 46 дефектов безопасности и надёжности (Vulnerability Sweep)
**Дата**: 23 сентября 2026 г.  
**Ветка**: `fix/vulnerability-sweep-46-issues`  
**Стек**: Next.js 16.3.6, React 19.2.6, Prisma 5.22.0, PostgreSQL 15, Redis 7, Tailwind CSS 4.0.0  
**Статус прогона**: 35/35 специализированных тестов PASS, `npm audit --omit=dev` 0 уязвимостей, `check-bundle-secrets.mjs` 0 утечек, `tsc --noEmit` 0 ошибок.

---

## 1. Сводная таблица по всем 46 находкам

| ID | Приоритет | Найдено в коде | Файл / Местоположение | Уровень доказательства | Статус и Коммит |
|---|---|---|---|---|---|
| **DEP-01** | Критично | Да | `package.json:38-42` | E2 (`npm audit --omit=dev`) | ✅ Закрыто (`c9c11403`) |
| **SEC-01** | Критично | Да (в истории/игнорах) | `.env*`, Git tracking | E1 (`git ls-files \| grep .env`) | ✅ Закрыто (`cd0b2876`) |
| **XSS-01** | Высокий | Да | `src/actions/order/legal.ts:25`, `LegalPageContent.tsx:48` | E2 (XSS unit test) | ✅ Закрыто (`95bd4edf`) |
| **XSS-02** | Высокий | Да | `src/app/page.tsx:64`, `[slug]/page.tsx:88`, `FluxFAQ.tsx:28` | E2 (XSS unit test) | ✅ Закрыто (`1d8fe220`) |
| **SEC-02** | Высокий | Да | `scripts/import-vexboost-live.ts:16`, `verify-stage-orders-view.ts` | E1 (`check-bundle-secrets.mjs`) | ✅ Закрыто (`f555e276`) |
| **CI-01** | Высокий | Да | `test/setup.ts:320-335` | E2 (Windows path normalizer) | ✅ Закрыто (`54366798`) |
| **CI-02** | Высокий | Да | `.github/workflows/ci.yml:58,67` | E1 (GitHub Actions workflow audit) | ✅ Закрыто (`54366798`) |
| **CI-03** | Высокий | Да | `.github/workflows/ci.yml:95-121` | E2 (E2E smoke container pipeline) | ✅ Закрыто (`54366798`) |
| **AUTH-01** | Средний | Да | `src/app/api/auth/dev-login/route.ts:18` | E2 (Auth bypass unit test) | ✅ Закрыто (`4e0a7a1b`) |
| **SEC-03** | Средний | Да | `src/lib/security/ddos-shield/shield-secret.ts:12` | E2 (Fail-closed test) | ✅ Закрыто (`0bde9ee8`) |
| **SEC-04** | Средний | Да | `scripts/backup/backup-postgres-s3.ts:28` | E2 (Fail-closed test) | ✅ Закрыто (`0bde9ee8`) |
| **PII-01** | Средний | Да | `src/lib/smtp.ts:47` | E1 (Static analysis grep) | ✅ Закрыто (`eabeb910`) |
| **PII-02** | Средний | Да | `src/lib/logger/sensitive-data-filter.ts:45` | E2 (Data masking test) | ✅ Закрыто (`eabeb910`) |
| **TEN-01** | Средний | Да | `src/lib/tenant-scope.ts:24` | E2 (Prisma extension model audit) | ✅ Закрыто (`f2d64d16`) |
| **TEN-02** | Средний | Да | `src/actions/admin/support-review.ts:60` | E2 (Cross-tenant security test) | ✅ Закрыто (`f2d64d16`) |
| **TEN-03** | Средний | Да | `src/actions/admin/user-balance.ts:42` | E2 (Balance adjustment guard test) | ✅ Закрыто (`f2d64d16`) |
| **CFG-01** | Средний | Да | `next.config.mjs:58` | E1 (Next.js config validation) | ✅ Закрыто (`204a2572`) |
| **CORS-01** | Средний | Да | `src/proxy.ts:228-245` | E2 (CORS origin reflected header test) | ✅ Закрыто (`204a2572`) |
| **R6-04** | Средний | Да | `src/workers/processors/catalog-sync.ts:34` | E2 (Worker tenant context test) | ✅ Закрыто (`f85da1e4`) |
| **OPS-01** | Средний | Да | `scripts/tunnel-daemon.mjs:85` | E2 (Exponential backoff unit test) | ✅ Закрыто (`f85da1e4`) |
| **OPS-02** | Средний | Да | `src/lib/redis-lock.ts:45`, `queue-manager.ts:80` | E2 (Fencing token & timeout test) | ✅ Закрыто (`4152889b`) |
| **BAL-01** | Средний | Да | `src/actions/support/compensation.ts:32` | E2 (ExactMath BigInt audit test) | ✅ Закрыто (`48615688`) |
| **BAL-02** | Средний | Да | `src/workers/processors/payment-sync.ts:74` | E2 (ExactMath BigInt payment test) | ✅ Закрыто (`48615688`) |
| **BAL-03** | Средний | Да | `src/services/admin/user.service.ts:112` | E2 (Ledger-first tx atomicity test) | ✅ Закрыто (`48615688`) |
| **AUTH-02** | Средний | Да | `src/app/api/telemetry/csp-report/route.ts:42` | E2 (Rate-limit 10 req/min test) | ✅ Закрыто (`9e2a9d88`) |
| **XSS-03** | Низкий | Да | `telegram-live-preview.tsx:88` | E2 (Preview DOM sanitizer test) | ✅ Закрыто (`694cca8c`) |
| **H-01** | Низкий | Да | 16 файлов UI (22 тега `<a>`) | E2 (AST audit script & unit test) | ✅ Закрыто (`b251b3f8`) |
| **H-02** | Низкий | Да | `fix-import.ts`, `db-chaos-runner.ts`, etc. | E2 (Parameterized SQL unit test) | ✅ Закрыто (`8edeac39`) |
| **R6-07** | Низкий | Да | `ci.yml:72`, `prisma/migrations` | E3 (`prisma migrate diff` shadow DB) | ✅ Исследовано и доказано (`04b0b07f`) |
| **R6-08** | Низкий | Да (по дизайну) | `src/app/api/health/route.ts:52` | E4 (Curl live container 200 OK) | ✅ Подтверждено и протестировано (`04b0b07f`) |
| **R6-09** | Низкий | Да (по регламенту)| `docker-compose.yml`, `AGENTS.md:0.5` | E2 (Docker healthcheck & Stage Gate) | ✅ Подтверждено и регламентировано (`04b0b07f`) |
| **R6-10** | Низкий | Да | `prisma/schema.prisma:730,1190` | E1 (AST & Grep analysis) | ✅ Документировано (`04b0b07f`) |
| **R6-11** | Низкий | Да | `vitest.config.ts:14-25` | E2 (`tsc --noEmit` & Vitest 4 runner) | ✅ Закрыто (`04b0b07f`) |
| **ARCH-01**| Архитектура | Да | Крупные монолитные файлы (>200 строк) | E1 (AST file length analysis) | ℹ️ Принято к сведению (Декомпозиция по модулям) |
| **ARCH-02**| Архитектура | Не применимо | Дублирование резолверов тенантов | E1 (`src/config/tenants.ts`) | ℹ️ Устранено ранее в `N-TENANTS-2026` |
| **ARCH-03**| Архитектура | Да | Массивы строк в JSON-колонках | E1 (`schema.prisma` JSON settings) | ℹ️ Часть JSONB-хранилищ системных настроек |
| **PERF-01**| Производительность | Да | Неселективное кэширование страниц | E1 (`export const revalidate = 0`) | ℹ️ Безопасный дефолт динамических страниц |
| **PERF-03**| Производительность | Не применимо | Доставка приватных файлов | E1 (`src/app/api/storage/*`) | ℹ️ Статика раздаётся через NGINX/Edge |
| **PERF-05**| Производительность | Да | Отсутствие явных LIMIT в ряде выборок | E1 (Prisma query audit) | ℹ️ Защищено серверной пагинацией каталога |
| **PERF-06**| Производительность | Не применимо | Ключ кэша без tenantId | E1 (`unstable_cache` audit) | ℹ️ Все кэш-ключи содержат `${tenantId}` |
| **PERF-07**| Производительность | Не применимо | Массовые операции без лимита пакета | E1 (Batch processing audit) | ℹ️ Массовые операции батчируются по 500 шт |
| **SEC-REV-01..05**| Отозванные (Секция 7) | Не применимо | Заглушки Prisma, lock syntax, 5000 tx | E2 (Ложные срабатывания метода) | 🚫 Отозвано в соответствии с Секцией 7 |

---

## 2. Детальный разбор исправлений по категориям

### 2.1. Критичные уязвимости (DEP-01, SEC-01)
- **DEP-01**: `next` обновлён до `^16.3.6` (устранены RCE Windows GHSA-p293-qw3h-jr36 и AVIF GHSA-2xp9-vwfh-vxw4), `nodemailer` обновлён до `^10.0.10` (устранен allow-list bypass GHSA-wmmp-3585-3rmp и ReDoS), `@tiptap/core` переведён на `^3.31.3` (ликвидировано загрязнение прототипа). В CI снята заглушка `|| true`. `npm audit --omit=dev` выдаёт **0 уязвимостей**.
- **SEC-01**: Все файлы окружения (`.env*`) исключены из отслеживания Git. Скрипт `check-bundle-secrets.mjs` включен в пре-коммит и CI — **0 утечек секретов**.

### 2.2. Высокий приоритет (XSS-01, XSS-02, SEC-02, CI-01..03)
- **XSS-01**: Внедрена утилита `escapeHtml()` в `src/lib/sanitize.ts`. Все динамические параметры юрлица (`companyName`, `inn`, `ogrnip`, `address`) экранируются перед рендерингом в `legal.ts` и `LegalPageContent.tsx`.
- **XSS-02**: Внедрено строгое экранирование символа `<` в `\u003c` для всех тегов `<script type="application/ld+json">` (`src/app/page.tsx`, `academy/[slug]/page.tsx`, `FluxFAQ.tsx`, `FluxReviews.tsx`).
- **SEC-02**: Захардкоженные тестовые и рабочие API-ключи удалены из скриптов (`import-vexboost-live.ts`, `verify-stage-orders-view.ts`, `cloudflare/*`). Реализован Fail-Closed с выбросом понятных исключений при отсутствии переменных.
- **CI-01..CI-03**: Нормализованы пути под Windows в `test/setup.ts`, очищены правила Flat Config ESLint 10, сняты заглушки `|| true` с шагов безопасности, добавлена джоба `e2e-smoke` с запуском изолированных контейнеров PostgreSQL и Redis.

### 2.3. Средний приоритет (AUTH-01..02, SEC-03..04, PII-01..02, TEN-01..03, CFG-01, CORS-01, OPS-01..02, BAL-01..03)
- **AUTH-01**: Вход разработчика (`/api/auth/dev-login`) защищён строгим требованием `process.env.ALLOW_DEV_LOGIN === 'true'`, немедленным отказом при `NODE_ENV === 'production'` и точным совпадением хоста со списком loopback (`127.0.0.1`, `localhost`).
- **AUTH-02**: Публичный эндпоинт телеметрии браузера `/api/telemetry/csp-report` закрыт скользящим Rate Limit (10 req/min на IP через атомарный Redis Lua-скрипт) и 5-минутным кэшем дедупликации по хэшу `document-uri + blocked-uri`.
- **SEC-03 & SEC-04**: Ликвидирован дефолтный секрет DDoS-щита (`shield-secret.ts`). Для шифрования резервных копий (`backup-postgres-s3.ts`) введены жесткие проверки минимальной длины ключа (32 байта) с отказом при их отсутствии.
- **PII-01 & PII-02**: Отключен прямой вывод Magic Link в stdout (`src/lib/smtp.ts`). Реализована функция `maskEmail()` и автоматическая санитизация чувствительных параметров запроса в `src/lib/logger/sensitive-data-filter.ts`.
- **TEN-01..TEN-03**: Модель `SupportFinancialAction` добавлена в список автоматической изоляции `TENANT_SCOPED_MODELS` расширения Prisma. Добавлены строгие проверки совпадения тенанта в Server Actions баланса и финансового аудита саппорта.
- **CFG-01 & CORS-01**: В `next.config.mjs` диапазоны локальной сети вынесены под условие дев-окружения (`!isProdContour`). В `src/proxy.ts` реализована валидация Origin `isAllowedCorsOrigin()` и устранен заголовок `Access-Control-Allow-Credentials: true` при динамическом отражении произвольного Origin.
- **OPS-01 & OPS-02**: Демон туннеля `scripts/tunnel-daemon.mjs` снабжен циклом автоматического переподключения с экспоненциальной задержкой (3s -> 60s) и рандомизацией джиттера. В `src/lib/redis-lock.ts` внедрены монотонно растущие Fencing-токены (`acquireLockWithFencing`, `withFencingLock`) для защиты очередей от split-brain при потере блокировки.
- **BAL-01..BAL-03**: Вся финансовая арифметика переведена на чистый `BigInt` (копейки) в `src/actions/support/compensation.ts` и `src/workers/processors/payment-sync.ts`. В `user.service.ts` запись аудита перенесена внутрь атомарной транзакции `$transaction`. Создан класс ошибки `ImmutableLedgerError` с маппингом триггера PostgreSQL `P0001` в типизированную ошибку `ERR_FINANCIAL_LEDGER_IMMUTABLE`.

### 2.4. Низкий приоритет и гигиена (XSS-03, H-01, H-02, R6-07..R6-11)
- **XSS-03**: Создан санитайзер `sanitizeTelegramPreviewHtml()` в `src/lib/sanitize.ts` и применен ко всем динамическим блокам предварительного просмотра шаблонов в `telegram-live-preview.tsx`.
- **H-01**: Устранены риски Reverse Tabnabbing (CWE-1022) во всех 22 ссылках `target="_blank"` по 16 файлам добавлением `rel="noopener noreferrer"`. Написан скрипт аудита `scripts/audit-target-blank.mjs` и регрессионный тест `noopener-noreferrer-audit.test.ts`.
- **H-02**: Все вызовы `$executeRawUnsafe` с интерполяцией строк `${...}` в скриптах (`fix-import.ts`, `db-chaos-runner.ts`, `generate-evidence-report.ts`, `real-db-pentest.ts`, `vexboost-services.ts`) заменены на безопасные параметризованные запросы с плейсхолдерами `$1..$9`. Написан тест `raw-sql-parameterization.test.ts`.
- **R6-07**: Выполнен глубокий анализ расхождения схемы через `prisma migrate diff` и `prisma migrate status`. Зафиксировано, что актуальным единым источником правды является `prisma/schema.prisma`.
- **R6-08**: Проверена двухуровневая модель проверки здоровья: быстрый публичный зонд `/api/health` (5s кэш, защита от DDoS) и защищённый детальный зонд `/api/health?detailed=1` (Bearer `CRON_SECRET` / Admin сессия с проверкой соединения с PostgreSQL и Redis). Протестировано вживую на работающем контейнере (HTTP 200 OK, latency БД 22мс, Redis 23мс).
- **R6-09**: Подтвержден регламент развертывания BGS-2026: запрет in-place пересборки боевого контейнера, предварительная валидация на Stage-контуре (`:3005`) и Docker-healthcheck.
- **R6-10**: Документированы особенности модели `SystemSetting` (неиспользуемый legacy key-value store, замененный на `SystemSettings`) и поля `telegramProxyId` (не имеющего жесткого foreign key).
- **R6-11**: Конфигурация `vitest.config.ts` избавлена от устаревшей опции `forks`, удален каст `as any`, исключена папка `scripts/**` и удалены несуществующие файлы из `include`.
