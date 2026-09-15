# Original User Request

## 2026-07-26T14:10:40Z

Project Orchestrator Mission: Client Dashboard Advanced Backend Features Integration

Original request is recorded at `d:\SMM_plan_2\.agents\ORIGINAL_REQUEST.md` under timestamp `2026-07-26T11:09:08Z`.

Requirements:
- R1. Integration of advanced order parameters (Drip-Feed, Custom Data, ETA, JIT Warnings) in client `new-order` forms for SMMplan & SMMflux.
  - Drip-Feed: toggle "Запускать частями", fields `Интервал (мин)` and `Количество запусков` (when `isDripFeedEnabled === true`).
  - Custom Data / Comments (`customDataType`): dynamic textarea with placeholder or numeric variant select (when `customDataType === 'TEXTAREA' | 'NUMBER'`).
  - Estimated Execution Time (ETA P50/P90): speed badge e.g. `⚡ Высокая (ETA P50: 12 мин, P90: 45 мин)`.
  - Legal Confirmation Checkbox (JIT Warning): mandatory `clientConfirmation` checkbox (e.g. "Канал открыт для всех").
- R2. Order Management Integration (Refill request button, Drip-Feed progress display, CBR rate/discount details) in `orders`.
  - Button "Запросить бесплатную докрутку" (Refill) with backend request creation.
  - Display Drip-Feed progress: `Запуск 2 из 5 (следующий через 15 мин)`.
  - Detailed breakdown of charge using CBR exchange rate and discount.
- R3. Advanced Profile & Security Settings (152-ФЗ consent card with timestamp/IP, API Webhooks & Settings, Tax/Company requisites ИНН/КПП, API KeyHash gen/reset) in `settings`.
  - 152-ФЗ & Consents: card with date & IP of TOS acceptance (`tosAcceptedAt`, `tosAcceptedIp`).
  - API Webhooks & Settings: `Webhook URL`, `Webhook Secret` and API connection status.
  - Tax/Company Requisites (for legal entities): `Название компании`, `ИНН`, `КПП`, `Юридический адрес`.
  - Generation and reset of API Key (`apiKeyHash`).
- R4. Promo Codes & Vouchers in Balance Deposit (`deposit` form).
  - Promo code / voucher activation input (`PromoCode` / `Voucher`), instant discount or fix bonus calculation in cents.

Acceptance Criteria:
- Drip-feed params calculate total budget (`qty * runs * price`).
- `customData` validated and displayed for services with comments/polls.
- `clientConfirmation` checkbox blocks order submission with highlight animation.
- Refill click sends Refill creation request and shows `PENDING` status.
- INN, KPP, Company Name saved and displayed in profile.
- Webhook URL saved for API integrations.

## 2026-07-27T14:49:51Z

Комплексный полный аудит и проверка работоспособности проекта SMMplan от и до: E2E регрессия, билд Next.js 16, статический анализ TypeScript, проверка платежных API/провайдеров в тестовом режиме, аудит безопасности (Trust Boundaries) и оптимизация производительности/гидратации.

Working directory: d:\SMM_plan_2
Integrity mode: development

Requirements:
- R1. Полный E2E аудит и статический анализ (`npm run test:tenant`, `npx tsc --noEmit`, `npm run build`).
- R2. Проверка интеграций платежных шлюзов (ЮKassa, Robokassa, CryptoBot) и провайдеров SMM в тестовом/песочном режиме (вебхуки, подписи, статусы заказов).
- R3. Аудит безопасности и границ Server/Client (Security & Trust Boundaries: `requireAdmin`, `verifySession`, подмена цен/количества, IDOR, `x-tenant-id`).
- R4. Аудит производительности и UX (Hydration & Rendering: отсутствие ошибок гидратации React 19, циклических ререндеров, контрастность компонентов, токены Tailwind v4 / HeroUI v3).

