# SPEC-2026-09-13: Генеральный волновой план сквозной верификации и боевого развертывания (4 Волны)
## (Master Multi-Wave Production Rollout & Verification Specification — OmniSMM 1.0)

> **Статус:** DRAFT / IN EXECUTION (Human Approval Gate FA-2026 / RAC-2026)  
> **Оркестратор:** Lead Systems Architect & Multi-Wave Orchestrator  
> **Платформа:** OmniSMM 1.0 (Витрины SMMplan.pro и SMMflux.ru)  
> **Инварианты:** Zero In-Place Rebuild (Stage :3005), Zero Horizontal Scroll (0px), Ledger-First BigInt, 54-ФЗ 2026.

---

## 1. Архитектурная матрица волн (4-Wave Master Matrix)

| Волна | Контур | Целевые модули и экраны | Метод проверки | Критерий готовности (Definition of Done) |
|---|---|---|---|---|
| **Волна 1** | **Client Dashboard (B2C/B2B ЛК)** | `/dashboard`, `/dashboard/orders`, `/dashboard/finance` (`/add-funds`), `/dashboard/referrals`, `/dashboard/settings` | Playwright Chromium (:3005) под ролью `USER` (1366px, 1920px, 375px, 390px) | 100% PASS, 0px overflow, Touch >= 44px, Zero Console Errors |
| **Волна 2** | **Catalog & Legal Multi-Tenant** | `/services` (каталог услуг), `/knowledge` (база знаний), `/legal/terms` (оферта), `/legal/privacy` (политика 152-ФЗ) | Playwright + cURL проверка канонических URL и реквизитов | Изоляция ИП/ООО (ст. 54.1 НК РФ), 0 фантомных брендов, tenant-aware кэш |
| **Волна 3** | **Financial Core & Webhooks** | `WalletOps` (credit, debit, refund, charge), вебхуки ЮKassa, Robokassa, CryptoBot, 54-ФЗ фискализация | Vitest сьют стресс-тестов на TOCTOU и идемпотентность | Row-level locking, Ledger-First, ExactMath копейки, vat_code: 1 / 10 |
| **Волна 4** | **Production Go-Live Preflight** | Все контейнеры Docker, preflight health, `check-bundle-secrets.mjs`, `tsc --noEmit` | Preflight runner + Smoke test live container | 0 ошибок сборки, 0 утечек секретов, статус healthy всех контейнеров |

---

## 2. Детальная спецификация волн

### 🌊 ВОЛНА 1: Клиентский личный кабинет (User Dashboard Audit & Polish)
1. **Сквозной Playwright-скрипт:** `scripts/dashboard/audit-client-dashboard.ts`.
2. **Сессия:** Генерация валидного JWT-токена роли `USER` (пользователь с балансом и историей заказов).
3. **Целевые экраны:**
   - `/dashboard`: Hero-приветствие, 4 Bento KPI-карточки, Launchpad 7 соцсетей (Telegram, VK, Inst, YT, TikTok, Rutube, Дзен), последние заказы.
   - `/dashboard/orders`: Таблица заказов (Viewport 100% Fit), бейджи статусов, быстрый Reorder.
   - `/dashboard/finance` (`/add-funds`): Витрина способов оплаты (СБП, Карты РФ, CryptoBot), расчет бонусов.
   - `/dashboard/referrals`: Уровни 5–15%, QR-код, генератор ссылок, копирование.
   - `/dashboard/settings`: Профиль, Smart Bind Telegram через QR, согласия 152-ФЗ.
4. **Вьюпорты:**
   - Desktop 1920x1080
   - Laptop 1366x768 (Zero-Scroll Target)
   - Mobile 375x667 (iPhone SE)
   - Mobile 390x844 (iPhone 16 Pro)

### 🌊 ВОЛНА 2: Публичный каталог и юридический контур (Catalog & Legal)
1. **Каталог услуг (`/services`):** Проверка фильтрации по соцсетям, поиска, цен за 1 шт (₽ / шт), мультитенантности (SMMplan vs SMMflux).
2. **База знаний (`/knowledge`):** Проверка статей, поиска, навигации.
3. **Юридический контур (`/legal/terms`, `/legal/privacy`):**
   - Проверка реквизитов ИП Соколов для SMMplan и ООО для SMMflux.
   - Защита от смешивания реквизитов (ст. 54.1 НК РФ).
   - 152-ФЗ чекбокс согласия.

### 🌊 ВОЛНА 3: Финансовое ядро и платежные вебхуки (WalletOps & Fiscal Integrity)
1. **WalletOps Invariants:**
   - Ledger-First: `tx.ledgerEntry.create()` строго ДО `user.update()`.
   - Идемпотентность: Уникальный `idempotencyKey` для каждой транзакции.
   - Копейки: Все денежные расчеты строго в `BigInt` (ExactMath).
2. **Вебхуки:**
   - ЮKassa: HMAC SHA-256 + IP white-list.
   - Robokassa: MD5/SHA-256 Signature.
   - CryptoBot: `crypto-pay-api-signature` timingSafeEqual.
3. **Фискализация 54-ФЗ:**
   - Проверка расчета порога выручки 20 млн ₽ (УСН vs НДС 22%).
   - Автоматический выбор `vat_code: 1` (без НДС) или `vat_code: 10` (НДС 22%).

### 🌊 ВОЛНА 4: Финальный Pre-Flight перед боевым запуском (Go-Live Gate)
1. Чек-лист `docs/PRODUCTION_GO_LIVE_CHECKLIST.md`.
2. Контроль сборки: `npx tsc --noEmit` (0 ошибок).
3. Сканирование секретов: `node scripts/check-bundle-secrets.mjs` (0 утечек).
4. Проверка контейнеров: Docker `healthy`.
5. Финальный отчет с доказательствами для утверждения пользователем.

---

## 3. Протокол безопасности выполнения (Orchestration Protocol)
- **Изоляция:** Замеры интерфейса выполняются строго на проверочном Stage-порту 3005 (`http://127.0.0.1:3005`). Боевой контейнер :3000 не затрагивается.
- **Fail-Closed:** Любое падение теста или переполнение (> 0px) останавливает волну для немедленного устранения.
