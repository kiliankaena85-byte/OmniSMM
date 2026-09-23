## 2026-06-05T04:58:51Z

Проведение глубокого QA-аудита проекта Smmplan Lite с тотальной очисткой кодовой базы, а также миграция чистой локальной базы данных на продакшен-сервер (включая провайдеров). Команда агентов должна очистить сервер от мусора (старые логи, кэши, сборки), удалить старые скрипты в коде, исправить линтер и перенести локальную базу. 

Working directory: `d:\SMM_plan_2`
Integrity mode: development

## User Review Required
> [!IMPORTANT]
> Перенос локальной БД на сервер полностью сотрет текущую серверную БД. Будут перенесены локальные пользователи, провайдеры и настройки. Обязательно убедитесь, что локальный пароль админа надежен!

## 🛡️ Премортем-анализ (Failure Simulation)
| Риск (Сценарий отказа) | Механизм защиты (Mitigation) |
| :--- | :--- |
| **Системные настройки смотрят на `localhost`:** После миграции маджик-ссылки авторизации и вебхуки оплаты на сервере сломаются, так как в локальной БД был зашит локальный домен. | Агенты **обязаны** перед дампом (или сразу после него) обновить в базе `SystemSettings` и `Provider` все URL-адреса с `localhost:3000` на `https://smmplan.pro`. |
| **Гонка данных при восстановлении:** Фоновые процессы на сервере (BullMQ) пытаются писать в БД в момент её удаления и восстановления через `pg_restore`. | Обязательная остановка Docker-контейнеров приложения и воркера (`docker compose stop app worker`) перед дропом БД. |
| **Удаление нужных скриптов:** Вырезание `scripts/` ломает логику деплоя или сидирования базы. | Удалять скрипты можно только после тщательной сверки с `package.json` скриптами; необходимые утилиты нужно переписать в src/lib/. |

## Requirements (Proposed Changes)

### R1. Тотальная очистка кодовой базы
- Проверить eslint.config.mjs и удалить все "хаки" и игнорирования.
- Удалить мертвый код в src/ (на основе Knip `npm run lint:debt`).
- Полностью удалить старые `.js` утилиты, использующие `require`, и переписать их на строгий TypeScript.

### R2. Подготовка локальной БД (Sanitization)
- Очистить локальную базу от мусорных данных (тикеты, заказы, платежи). 
- **КРИТИЧНО:** Изменить домены в настройках и провайдерах на `https://smmplan.pro` во избежание сбоев webhook'ов на проде.
- Сохранить настроенных провайдеров (`Provider`), учетную запись владельца (`User`) и системные настройки (`SystemSettings`).

### R3. Очистка сервера и Миграция БД
- Подключиться к `smmplan.pro`. Очистить Docker от остановленных контейнеров и старых образов (`docker system prune -a -f`). Очистить Redis.
- Остановить рабочие контейнеры `app` and `worker` перед манипуляциями с БД!
- Развернуть дамп локальной БД, полностью заменив старую серверную базу (через Drop Schema или Prisma migrate --reset + seed из дампа). Затем запустить контейнеры.

### R4. Исправление утечек и багов в тестах
- Добавить mock-объекты для внешних сервисов (например, SMTP в test/setup.ts).
- Удалить устаревшие и нестабильные тесты, гарантировать что тесты не выходят во внешнюю сеть.

## Acceptance Criteria (Verification Plan)

### Серверная инфраструктура
- [ ] Контейнеры на сервере успешно стартуют, нет ошибок Prisma connection в логах (`docker logs smmplan_lite_prod_app`).
- [ ] Авторизация администратора работает на проде (значит `localhost` успешно заменен на `smmplan.pro`).
- [ ] В БД на сервере присутствуют локальные провайдеры, но нет старых заказов.

### Локальное качество кода
- [ ] `npm run lint` выдает 0 ошибок и 0 предупреждений (без обходных путей).
- [ ] `npm run lint:debt` выдает чистый результат.
- [ ] `npm run test` (или `vitest run`) завершается со 100% успехом, не пытаясь установить соединение с внешним SMTP-сервером.

## 2026-06-07T11:08:00Z

# Teamwork Project Prompt  Draft

> Status: Launched
> Goal: Craft prompt > get user approval > delegate to teamwork_preview

Investigate the "something went wrong" error in the current magic link login flow and fully implement a robust password-based fallback authentication architecture that works even when the SMTP server is down or misconfigured. You must write automated tests for your solution.

Working directory: d:\SMM_plan_2
Integrity mode: development

## Requirements

### R1. Root Cause Analysis & Fix
Analyze the codebase to determine why the magic link login currently throws a "something went wrong" error. Fix the root cause of this error so that magic links work correctly when SMTP is available.

### R2. Implement Fallback Password Authentication
Fully implement a password-based fallback login mechanism for both the Admin Panel and User Dashboard. Crucially, this fallback must allow administrators to log in **without relying on an SMTP server**. 
- Add necessary database fields (e.g., passwordHash) via Prisma.
- Update the UI forms to accept a password.
- Implement the backend logic to verify the password securely.

### R3. Automated Testing
Write automated tests (e.g., unit or integration tests) to verify that both the magic link (when SMTP works) and the password fallback (when SMTP fails) function correctly. 

## Acceptance Criteria

### Diagnostics & Fix
- [ ] The root cause of the "something went wrong" error is fixed.

### Architecture Proposal & Implementation
- [ ] Prisma schema is updated with a password hash field.
- [ ] Users and admins can successfully log in using a password instead of a magic link.
- [ ] The solution does not break existing Next.js / NextAuth or custom auth boundaries.

### Verification
- [ ] Automated tests are written.
- [ ] Tests successfully pass, programmatically proving that the password login mechanism works independently of the SMTP server.

## Follow-up вЂ” 2026-06-07T19:15:15Z

# Teamwork Project Prompt

Р˜РЅС‚РµРіСЂР°С†РёРѕРЅРЅР°СЏ СЃРёСЃС‚РµРјР° СЂРµР°Р»СЊРЅРѕРіРѕ СЃРєРІРѕР·РЅРѕРіРѕ (E2E) С‚РµСЃС‚РёСЂРѕРІР°РЅРёСЏ СЃС‚Р°Р±РёР»СЊРЅРѕСЃС‚Рё РїР»Р°С‚С„РѕСЂРјС‹ Smmplan СЃ РІС‹Р·РѕРІР°РјРё РІРЅРµС€РЅРёС… API (РїСЂРѕРІР°Р№РґРµСЂС‹, РїР»Р°С‚РµР¶РЅС‹Рµ С€Р»СЋР·С‹, РєСѓСЂСЃС‹ РІР°Р»СЋС‚) Рё РїСЂРѕРІРµСЂРєРѕР№ РєСЂРёС‚РёСЎРµСЃРєРёС… Р±РёР·РЅРµСЃ-СЃС†РµРЅР°СЂРёРµРІ.

Working directory: d:\SMM_plan_2
Integrity mode: development

## Requirements

### R1. Real Provider & Catalog Integration Verification
- РЎРѕР·РґР°С‚СЊ/РґРѕРїРѕР»РЅРёС‚СЊ РёРЅС‚РµРіСЂР°С†РёРѕРЅРЅС‹Рµ С‚РµСЃС‚С‹ РґР»СЏ РїСЂРѕРІРµСЂРєРё СЃРѕРµРґРёРЅРµРЅРёСЏ СЃ СЂРµР°Р»СЊРЅС‹РјРё API SMM РїСЂРѕРІР°Р№РґРµСЂРѕРІ.
- РџСЂРѕРІРµСЂРёС‚СЊ СЂР°Р±РѕС‚РѕСЃРїРѕСЃРѕР±РЅРѕСЃС‚СЊ РїРѕР»СѓС‡РµРЅРёСЏ Р±Р°Р»Р°РЅСЃР° Рё РїР°СЂСЃРёРЅРіР° РєР°С‚Р°Р»РѕРіРѕРІ СѓСЃР»СѓРі РѕС‚ РїСЂРѕРІР°Р№РґРµСЂРѕРІ (Cherry-Pick Import & Shadow Catalog).
- РќР°РїРёСЃР°С‚СЊ С‚РµСЃС‚ РґР»СЏ РїСЂРѕРІРµСЂРєРё СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё РєСѓСЂСЃРѕРІ РІР°Р»СЋС‚ СЃ Р¦РµРЅС‚СЂР°Р»СЊРЅС‹Рј Р‘Р°РЅРєРѕРј Р Р¤ (CBR) С‡РµСЂРµР· РёРЅС‚РµСЂРЅРµС‚, РіР°СЂР°РЅС‚РёСЂСѓСЏ, С‡С‚Рѕ XML/JSON СЌРЅРґРїРѕРёРЅС‚ РєРѕСЂСЂРµРєС‚РЅРѕ РїР°СЂСЃРёС‚СЃСЏ, Р° Р·РЅР°С‡РµРЅРёРµ `exchangeRateUSD` РѕР±РЅРѕРІР»СЏРµС‚СЃСЏ РІ СЃРёСЃС‚РµРјРЅС‹С… РЅР°СЃС‚СЂРѕР№РєР°С….

### R2. Payment Gateways API Verification (Anti-Mocking & Fallbacks)
- РџСЂРѕРІРµСЂРёС‚СЊ СЃС‚СЂРѕРіРѕРµ СЃРѕР±Р»СЋРґРµРЅРёРµ РїСЂР°РІРёР» РїР»Р°С‚РµР¶РЅС‹С… С€Р»СЋР·РѕРІ (Р®Kassa, Robokassa, CryptoBot) РёР· `AGENTS.md`.
- РќР°РїРёСЃР°С‚СЊ С‚РµСЃС‚С‹, РїСЂРѕРІРµСЂРёС‚СЊ, С‡С‚Рѕ РїСЂРё РЅР°Р»РёС‡РёРё РЅР°СЃС‚РѕСЂРѕРµРЅРЅС‹С… РєР»СЋСЎРµР№ С€Р»СЋР·РѕРІ (РґР°Р¶Рµ С‚РµСЃС‚РѕРІС‹С…, С‚Р°РєРёС… РєР°Рє `yookassaTestShopId`) РІС‹РїРѕР»РЅСЏСЋС‚СЃСЏ СЂРµР°Р»СЊРЅС‹Рµ API-Р·Р°РїСЂРѕСЃС‹ Рє СЃРµСЂРІРµСЂР°Рј РїР»Р°С‚РµР¶РЅС‹С… СЃРёСЃС‚РµРј, Р° РЅРµ РјРѕРєРѕРІС‹Рµ РїРµСЂРµРЅР°РїСЂР°РІР»РµРЅРёСЏ РЅР° `/api/dev/mock-payment`.
- РџСЂРѕРІРµСЂРёС‚СЊ Р°РІС‚Рѕ-РѕС‚РєР°С‚ РЅР° С‚РµСЃС‚РѕРІС‹Рµ РєР»СЋС‡Рё РІ СЃСЂРµРґРµ СЂР°Р·СЂР°Р±РѕС‚РєРё, РµСЃР»Рё Р±РѕРµРІС‹Рµ РєР»СЋС‡Рё СЃРѕРґРµСЂР¶Р°С‚ РґРµС„РѕР»С‚РЅС‹Рµ РїР»РµР№СЃС…РѕР»РplaceholderС‹.
- РЈР±РµРґРёС‚СЊСЃСЏ, С‡С‚Рѕ РїСЂРё РїРѕР»РЅРѕСЃС‚СЊС‹ РїСѓСЃС‚С‹С… РРµРєРІРёР·РёС‚Р°С… СЃРёСЃС‚РµРјР° РєРѕСЂСЂРµРєС‚РЅРѕ РїРµСЂРµРєР»СЋСЎР°РµС‚СЃСЏ РЅР° Р°РР°СЂРёР№РЅС‹Р№ СЃРёРјСѓР»СЏС‚РѕСЂ.

### R3. End-to-End User Flow Tests (Playwright)
- Р Р°Р·СЂР°Р±РѕС‚Р°С‚СЊ РёР»Рё РѕР±РЅРѕРІРёС‚СЊ СЃРєРРѕР·РЅС‹Рµ Playwright-С‚РµСЃС‚С‹ Р СЂРµР°Р»СЊРЅРѕРј/headless Р±СЂР°СѓР·РµСЂРµ РґР»СЏ РїСѓС‚Рё РїРѕР»СЊР·РѕРР°С‚РµР»СЏ:
  - РђРІС‚РѕСЂРёР·Р°С†РёСЏ (РІС…РѕРґ РїРѕ РїР°СЂРѕР»С‹ Рё РїРѕ РІРѕР»С€РµР±РЅРѕР№ СЃСЃС‹Р»РєРµ).
  - Р’С‹Р±РѕСЂ СѓСЃР»СѓР– Р РєР°С‚Р°Р»РѕРіРµ, СЂР°СЃС‡РµС‚ Рё РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ С†РµРЅС‹ Р·Р° 1 РµРґРёРЅРёС†Сѓ (`pricePerUnitRub` СЃ РїРѕРґРїРёСЃСЊСЋ `в‚Ѕ / С€С‚`, Р±РµР· `/ 1000 С€С‚` СЃРѕРіР»Р°СЃРЅРѕ РїСЂР°РІРёР»Р°Рј С†РµРЅРѕРѕР±СЂР°Р·РѕРР°РЅРёСЏ).
  - РџСЂРѕРРµСЂРєР° РІР°Р»РёРґР°С†РёРё СЃСЃС‹Р»РѕРє (`targetType` РЅР° РѕСЃРЅРѕРРµ РєР°С‚РµР–РѕСЂРёР№: `CHANNEL`, `POST`, `STORY`, `CUSTOM` СЃРѕРіР»Р°СЃРЅРѕ `src/utils/target-type.ts`).
  - РћС„РѕСЂРјРёС‚СЊ Р·Р°РєР°Р·, СЃРїРёСЃР°С‚СЊ Р±Р°Р»Р°РЅСЃ РёР»Рё РїРµСЂРµРЅР°РїСЂР°РРёС‚СЊ РЅР° РѕРїР»Р°С‚Сѓ РєР°СЂС‚РѕР№/РЎР‘Рџ.

### R4. Admin Panel & Operator Roles E2E Tests
- РџСЂРѕС‚РµСЃС‚РёСЂРѕРР°С‚СЊ E2E-СЃС†РµРЅР°СЂРёРё Р°РґРјРёРЅРёСЃС‚СЂРёСЂРѕРР°РЅРёСЏ:
  - Р’С…РѕРґ Р РїР°РЅРµР»СЊ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°, СЃРѕР·РґР°РЅРёРµ Рё РЅР°СЃС‚СЂРѕР№РєР° РЅРѕРІС‹С… РїСЂРѕРР°Р№РґРµСЂРѕР.
  - Р˜РјРїРѕСЂС‚ СѓСЃР»СѓР– РёР· С‚РµРЅРµРРѕРіРѕ РР°С‚Р°Р»РѕРіР° РїСЂРѕРР°Р№РґРµСЂРѕР.
  - РЈРїСЂР°РР»РµРЅРёРµ РЅР°С†РµРЅРєР°РјРё (`markup`), РїСЂРѕРРµСЂРєР° СЂР°Р±РѕС‚С‹ РєР°СЂР°РЅС‚РёРЅРЅС‹С… Р·РѕРЅ (`isQuarantined`, Price Spike Isolation, Elastic Cooldown).
  - Р›РѕРіРёСЂРѕРР°РЅРёРµ РґРµР№СЃС‚РРёР№ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР° (`AdminAuditLog` Рё Ledger-Р·Р°РїРёСЃРё).

### R5. Queue & SLA Verification (BullMQ Workers)
- РџРѕРєСЂС‹С‚СЊ С‚РµСЃС‚Р°Р˜С„РѕРЅРѕРС‹Рµ РРѕСЂРІРµСЂС‹ BullMQ (`OrderProcessor`, `SyncProcessor`):
  - РџСЂРѕРРµСЂРєР° РєРѕСЂСЂРµРєС‚РЅРѕР№ РѕР±СЂР°Р±РѕС‚РєРё РѕС‡РµСЂРµРґРµР№ Рё SLA РС‹РїРѕР»РЅРµРЅРёСЏ Р·Р°РІР°Р·РѕР.
  - РЎС‚СЂРµСЃСЃ-С‚РµСЃС‚РёСЂРѕРР°РЅРёРµ/С…Р°РѕСЃ-РёРЅР¶РёРЅРёСЂРёРЅР–: СЃРёРјСѓР»СЏС†РёСЏ С‚Р°Р№РјР°СѓС‚РѕР РїСЂРѕРР°Р№РґРµСЂРѕР РёР»Рё СЃР±РѕРµР С‚СЂР°РЅР·Р°РІС†РёР№ Р Prisma (`db.$transaction` rollback) СЃ РїСЂРѕРРµСЂРєРѕР№ С‚РѕРіРѕ, С‡С‚Рѕ Р·Р°РІР°Р·С‹ РЅРµ С‚РµСЂСЏСЋС‚СЃСЏ Рё СѓС…РѕРґСЏС‚ Р retry-РѕС‡РµСЂРµРґСЊ РёР»Рё DLQ.

## Acceptance Criteria

### API & DB Integrity
- [ ] Р˜РЅС‚РµР–СЂР°С†РёРѕРЅРЅС‹Рµ С‚РµСЃС‚С‹ CBR-СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё Рё SMM-РїСЂРѕРР°Р№РґРµСЂРѕР СѓСЃРїРµС€РЅРѕ РїСЂРѕС…РѕРґСЏС‚ СЃ СЂРµР°Р»СЊРЅС‹Рј РґРѕСЃС‚СѓС€РµРј РІ СЃРµС‚Рё РёРЅС‚РµСЂРЅРµС‚.
- [ ] Р›РѕР–РёРІР° РС‹Р±РѕСЂР° РїР»Р°С‚РµР¶РЅРѕРіРѕ С€Р»СЋР·Р° (СЂРµР°Р»СЊРЅС‹Р№ Р·Р°РїСЂРѕСЃ vs РјРѕРІ) РїРѕРІСЂС‹С‚Р° С‚РµСЃС‚Р°Р˜РЅР° 100% Рё СЃРѕРѕС‚РІРµС‚СЃС‚РСѓРµС‚ РїСЂР°РІРёР»Р°Рј `AGENTS.md`.

### UI/UX & E2E Validation
- [ ] Playwright-СЃС†РµРЅР°СЂРёРё РїСЂРѕС…РѕРґСЏС‚ Р±РµР· РѕС€РёР±РѕРІ Р°РС‚РѕСЂРёР·Р°С†РёРё Рё РІРѕСЂСЂРµРІС‚РЅРѕ РёРјРёС‚РёСЂСѓСЋС‚ РїРѕР»РЅС‹Р№ С†РёРІР» Р·Р°РІР°Р·Р° РІР»РёРµРЅС‚Р°.
- [ ] Р’Р°Р»РёРґР°С‚РѕСЂ СЃСЃС‹Р»РѕРІ (`targetType` РїРѕ РІР°С‚РµР–РѕСЂРёСЏРј) Рё РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ С†РµРЅ Р·Р° 1 С€С‚СѓРІСѓ Р UI РїСЂРѕРРµСЂРµРЅС‹ С‚РµСЃС‚Р°РјРё.
- [ ] Р’СЃРµ С‚РµСЃС‚С‹ Р·Р°РїСѓСЃРІР°С‹С‚СЃСЏ СЎРµСЂРµР· СЃС‚Р°РЅРґР°СЂС‚РЅС‹Рµ РІРѕРјР°РЅРґС‹ Р `package.json` (`npm run test`, `npm run test:e2e`).
- [ ] РЎРіРµРЅРµСЂРёСЂРѕРР°РЅ РїРѕРґСЂРѕР±РЅС‹Р№ РѕС‚СЎРµС‚ Рѕ РїСЂРѕС…РѕР¶РґРµРЅРёРё С‚РµСЃС‚РѕР Рё СѓСЂРѕРРЅРµ РїРѕРІСЂС‹С‚РёСЏ РІСЂРёС‚РёСЎРµСЃРІРёС… СЃСѓРЅРІС†РёР№.

## Follow-up — 2026-06-09T14:57:26+03:00

Визуальный аудит и устранение багов мобильной верстки (для экранов от 320px до 480px) на сайте Smmplan, включая проверку перекрытий элементов, отступов, адаптивности и соответствия премиальному дизайн-манифесту.

Working directory: d:\\SMM_plan_2
Integrity mode: development

## Requirements

### R1. Mobile Viewport Layout Audit
- Использовать Playwright или браузерные средства для визуального обхода основных экранов (лендинг, мастер заказа, личный кабинет пользователя, настройки профиля) в разрешении мобильных устройств (ширина 320px - 480px).
- Выявить все случаи наложения текста, вырезания элементов, отсутствия адаптивности, некорректного контраста и проблем с интерактивными элементами (touch targets < 44px).

### R2. Visual & Semantic Style Compliance
- Исправить найденные визуальные баги, строго соблюдая цветовую палитру и семантические токены Tailwind CSS 4.0.0 (избегать инлайновых `text-white`, `bg-black`, использовать семантические токены вроде `text-foreground`, `bg-background` из `globals.css`).
- Убедиться, что элементы соответствуют премиальному качестве (плавные анимации, сбалансированные отступы, корректная кириллическая типографика).

### R3. Automated Visual Verification
- Настроить/обновить скриншотные тесты Playwright для ключевых мобильных экранов с целью фиксации отсутствия регрессии.
- Все тесты должны проходить без ошибок линтинга (`npm run lint` и `npx tsc --noEmit`).

## Acceptance Criteria

### Visual Density & WCAG 2.2 AA Compliance
- [ ] Все кнопки и интерактивные элементы в мобильной версии имеют размер области клика (touch target) не менее 44x44px.
- [ ] Отсутствуют перекрытия текстовых контейнеров, обрезка текста или выход блоков за ширину экрана (нет горизонтального скролла страницы).
- [ ] Цветовой контраст текста относительно фона составляет не менее 4.5:1 для обычного текста.

### Technical & System Integrity
- [ ] Нет инлайновых стилей цветов (все цвета берутся из `@theme` в `globals.css`).
- [ ] Проект успешно проходит сборку (`npm run build`) и линтинг (`npm run lint`).
- [ ] Playwright-тесты для мобильных разрешений успешно проходят локально.

## Follow-up — 2026-06-09T12:01:25Z

## Расширенная спецификация аудита (v2)

Промпт был существенно расширен. Передай оркестратору следующие дополнения к текущему плану:

### 1. Полный перечень экранов (20 штук)
Кроме лендинга и мастера заказа, необходимо проверить:
- `/login` — авторизация
- `/dashboard` — дашборд пользователя (включая `sidebar-nav.tsx`)
- `/dashboard/settings` — настройки профиля и `PasswordCard.tsx`
- `/dashboard/orders` — история заказов
- `/dashboard/add-funds` — пополнение баланса
- `/knowledge`, `/academy` — база знаний
- Все модалы: `PaymentGatewaySelectionModal`, `MassConfirmEmailModal`, `VisualLinkGuideModal`
- Компоненты внутри лендинга: `FAQ.tsx`, `Reviews.tsx`, `WhyUs.tsx`, `MegaFooter.tsx`, `TrustBar.tsx`

### 2. Конкретные HOT SPOTS (зоны повышенного риска)
1. **`MobileWizard.tsx`** (950 строк / 46 КБ) — самый сложный компонент, высокий риск overflow и z-index конфликтов.
2. **`StickyCheckoutBar.tsx`** — проверить safe-area-inset для iPhone с вырезом, кнопка оплаты не должна перекрываться.
3. **`PlatformLinkGuideDrawer.tsx`** — недавно исправлен (скрыта mock-карта через `hidden md:flex`), подтвердить корректность.
4. **`DynamicPayloadWarnings.tsx`** (22 КБ) — длинные предупреждения могут overflow.
5. **`VisualLinkGuideModal.tsx`** (50 КБ) — модал визуального руководства, проверить viewport boundaries.
6. **Header.tsx** — три кнопки (Кабинет + Выйти + Бургер) должны помещаться в 320px.

### 3. Классификация дефектов
Каждый найденный баг — через severity:
- 🔴 P0 (Critical) — невозможно совершить действие
- 🟠 P1 (Major) — серьезная визуальная проблема
- 🟡 P2 (Minor) — косметика
- 🟢 P3 (Enhancement) — улучшение премиальности

### 4. Обязательные AI-скиллы для прочтения
Перед началом работы агенты должны прочитать SKILL.md следующих скиллов:
- `gsd-premium-audit` — аудит премиальности
- `ru-cyrillic-typography` — кириллическая типографика  
- `ru-visual-culture` — визуальная культура CIS
- `gsd-ui-review` — 6-pillar visual audit
- `gsd-tailwind-v4-manifest` — правила Tailwind 4

### 5. Три разрешения для тестирования
Все экраны проверить при: **320px** (iPhone SE), **390px** (iPhone 14), **430px** (iPhone 15 Pro Max).

### 6. Deliverables
- Markdown-отчёт со всеми дефектами (severity + скриншоты до/после + файл:строка)
- Код-фиксы всех P0 и P1 дефектов
- `npm run lint` = 0 errors, `npx tsc --noEmit` = clean

## 2026-06-10T04:38:36Z

Redesign the mobile order wizard in `MobileWizard.tsx` to implement a progressive collapsible accordion-wizard flow, reducing visual clutter and cognitive load, and update the associated Playwright tests to ensure build and test suite integrity.

Working directory: d:\SMM_plan_2
Integrity mode: development

## Requirements

### R1. Collapsible Accordion-Wizard Layout (`MobileWizard.tsx`)
Redesign the mobile order wizard layout so that only one active step is expanded at any time, while completed steps collapse into compact read-only summary badges with "Edit" options:
1. **Step 1 (Link Entry - Active by Default)**:
   - User immediately sees the link input field (our primary feature).
   - Below the link input, display the helper link "Выбрать из каталога вручную".
   - Once a valid link is entered (and the social platform/available categories are resolved), Step 1 collapses into a compact read-only summary card: e.g. `🔗 Ссылка: t.me/durov [Изменить]`.
2. **Step 2 (Category Selection)**:
   - Opens automatically when Step 1 collapses.
   - Hides the "Выбрать из каталога вручную" button and other details.
   - Shows only the category list.
   - Once a category is clicked, Step 2 collapses into a compact summary card: e.g. `📁 Категория: Подписчики [Изменить]`.
3. **Step 3 (Service Tariff Selection)**:
   - Opens automatically when Step 2 collapses.
   - Shows only the available service tariffs/cards.
   - Provides a "Назад к выбору категории" action at the top.
   - Once a service is selected, Step 3 collapses into a compact summary card: e.g. `⚡ Тариф: Эконом (45 ₽ / шт) [Изменить]`.
4. **Step 4 (Checkout Parameters)**:
   - Opens automatically when Step 3 collapses.
   - Shows only the quantity input, email, promo code, dynamic warning blocks, legal terms checkbox, price summary, and "Заказать" CTA button.
   - Provides a "Назад к выбору тарифа" action at the top (or "Назад к каталогу" if selected manually).

### R3. Editing Previous Steps
- Clicking any collapsed step summary card or its "Изменить" button expands that specific step for editing, while collapsing subsequent steps.

### R4. E2E Test Suite Alignment (`e2e/visual-regression.spec.ts`)
- Update the mobile visual regression test case `test('9. Mobile UX Warning Block and Validation Checkbox')` to interact with the new step-by-step accordion-wizard flow (collapsing/expanding) rather than expecting all fields to be visible simultaneously.

### R5. Visual Quality & Accessibility
- Maintain mobile viewport responsiveness (320px–480px) and WCAG 2.2 AA touch targets (>= 44px).
- Use semantic design tokens from `globals.css` (no inline background/text colors).

## Acceptance Criteria

### UX Flow & Density
- [ ] By default, only Step 1 (Link input) and "Выбрать из каталога вручную" are visible.
- [ ] Entering a valid link collapses Step 1 and displays only Step 2 (Categories).
- [ ] Selecting a category collapses Step 2 and displays only Step 3 (Services).
- [ ] Selecting a service collapses Step 3 and displays only Step 4 (Checkout Parameters).
- [ ] Clicking "Изменить" on any summary card expands it and collapses subsequent steps.

### Technical & Testing Integrity
- [ ] `npm run lint` finishes with 0 errors.
- [ ] `npx tsc --noEmit` compiles successfully with 0 errors.
- [ ] `npm run test:visual` runs and passes successfully.

## 2026-06-10T04:42:53Z

Команда, заказчик внес важное изменение в требования по ходу работы:
Для накрутки альбомов/медиагрупп в Telegram теперь требуется указывать ДВЕ ссылки: на первое фото (основное) и на последнее фото.
Мы уже внесли необходимые изменения в:
1. src/components/landing/order-engine/DynamicPayloadWarnings.tsx (добавлены два поля ввода и обновлен текст).
2. src/components/landing/order-engine/PlatformLinkGuideDrawer.tsx (обновлена инструкция по копированию двух ссылок).

Пожалуйста, учтите это при реализации мобильного визарда и при адаптации авто-тестов в e2e/visual-regression.spec.ts. Запустите тесты и проверьте, что сборка проходит без ошибок.

## 2026-06-11T14:44:40Z

Служба семантического анализа и сравнения описаний услуг в нашей базе данных с описаниями от провайдеров (из кэша Redis `provider:{id}:catalog`) для выявления критических расхождений в характеристиках (гарантия, скорость, тип ссылок, ограничения).

Working directory: d:/SMM_plan_2/project-docs/description_audit
Integrity mode: development

## Requirements

### R1. Сервис аудита описаний (`src/services/admin/description-audit.ts`)
Реализовать класс `DescriptionAuditEngine` со статическим методом для запуска семантической проверки описаний услуг:
1. **Сравнение через Gemini**: Использовать модель `gemini-3-flash` или `gemini-3-flash-preview` для анализа соответствия локального описания услуги описанию от провайдера.
2. **Анализ параметров**:
   - **Гарантии** (наличие Refill, кнопка компенсации, количество дней гарантии).
   - **Скорость старта и выполнения** (например, в локальном описании заявлено "10к в сутки", у провайдера изменилось на "500 в сутки").
   - **Тип целевых ссылок** (`targetType` - канал, пост, профиль).
   - **Критические требования** (наличие аватарки, возраст канала, запрет закрытых аккаунтов).
3. **Логирование и реакция**:
   - При обнаружении расхождения создавать запись в `AdminAuditLog` с `action: "DESCRIPTION_DISCREPANCY"`, `targetType: "SERVICE"`, с JSON-полями расхождения.
   - Записывать статус расхождения в JSON-поле `features` услуги (например, `descriptionAudit: { status: 'DISCREPANCY', issues: [...], checkedAt: '...' }`).
   - Саму услугу в жесткий карантин не отправлять, но помечать предупреждением в интерфейсе.

### R2. Панель управления расхождениями в Админке
1. Добавить вкладку **«Анализ описаний»** на страницу `/admin/catalog/quarantine` или в `/admin/catalog/enrichment`.
2. Отображать таблицу услуг с расхождениями с использованием HeroUI v3:
   - Название услуги, категория и провайдер.
   - Найденные расхождения (краткая выжимка от ИИ).
   - Кнопка **«Принять описание провайдера»** (заменяет локальное описание и имя на очищенный текст провайдера и сбрасывает статус предупреждения).
   - Кнопка **«Игнорировать»** (сбрасывает статус предупреждения).

### R3. Модульные тесты (`test/unit/description-audit.test.ts`)
Написать юнит-тесты на Vitest для проверки:
- Корректного парсинга ответа ИИ о расхождениях.
- Записи логов в `AdminAuditLog`.
- Обновления полей в базе данных при подтверждении или игнорировании.

## Acceptance Criteria

### Проверка типов и линтинг
- [ ] Команда `npx tsc --noEmit` выполняется без единой ошибки.
- [ ] Команда `npm run lint` завершается без ошибок.

### Корректность работы
- [ ] Модульные тесты проходят успешно (`npx vitest run test/unit/description-audit.test.ts`).
- [ ] Логи автосверки записываются в базу данных и корректно форматируются.

## 2026-06-11T11:46:48Z

Одноразовый консольный скрипт для семантического анализа, маркетинговой оптимизации и синхронизации описаний услуг в нашей базе данных с реальными спецификациями провайдера (из кэша Redis или живого API).

Working directory: d:/SMM_plan_2/project-docs/marketing_rewrite
Integrity mode: development

## Requirements

### R1. Одноразовый скрипт рерайтинга описаний (`scripts/marketing-description-rewriter.ts`)
Создать консольный TS-скрипт, который выполняет следующие шаги:
1. **Выборка услуг**: Находит в базе данных все активные услуги (`isActive: true`), у которых есть `externalId`.
2. **Получение спецификаций провайдера**: Извлекает описание услуги от провайдера (сначала проверяет Redis-кэш `provider:{id}:catalog`, при отсутствии делает запрос к API провайдера).
3. **ИИ Маркетолог (Gemini)**: Отправляет текущее имя/описание услуги и имя/описание от провайдера в модель `gemini-3-flash` или `gemini-3-flash-preview` со специализированным системным промптом:
   - **Честность (Без вранья)**: Описание должно строго соответствовать техническим лимитам провайдера (если у провайдера нет гарантий списаний, нельзя обещать "без списаний"; если старт долгий, указать "старт до 12-24 ч").
   - **Продающая API структура**: Переписать текст на чистом русском языке, структурировано (с помощью markdown-списков: Скорость, Гарантия, Лимиты, Особенности), делая его привлекательным для клиентов.
   - **Очистка от спама**: Текст должен быть очищен от любых ссылок, контактов, Telegram @юзернеймов провайдера и запрещенных слов («накрутка», «накрутить» и др.).
4. **Обновление БД и Лог аудита**:
   - Обновляет поля `name` и `description` услуги в базе данных.
   - Записывает лог в `AdminAuditLog` с `action: "SERVICE_AUTO_FIX"`, `adminEmail: "system@smmplan.pro"` с подробным diff изменений, чтобы они отображались во вкладке автоисправлений админки.

### R2. Модульные тесты (`test/unit/marketing-rewrite.test.ts`)
Написать Vitest-тесты для проверки:
- Ожидаемого поведения рерайтера при нестыковках (например, когда локальное описание обещает гарантию, а провайдер ее отменил).
- Успешной записи изменений в базу данных и лог аудита.

## Acceptance Criteria

### Проверка типов и линтинг
- [ ] Команда `npx tsc --noEmit` выполняется без единой ошибки.
- [ ] Команда `npm run lint` завершается без ошибок.

### Корректность работы
- [ ] Скрипт запускается через `npx tsx scripts/marketing-description-rewriter.ts --dry-run` (режим симуляции без изменения БД) и выводит diff в консоль.
- [ ] Тесты проходят успешно (`npx vitest run test/unit/marketing-rewrite.test.ts`).