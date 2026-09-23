# SPEC-2026-09-23: Multi-Tenant Telegram Bot Dispatcher & Webhook Router (Phase 4)

## 1. Overview & Business Intent
- **Goal**: Enable independent, branded Telegram bots for arbitrary storefronts and tenants (White-Label OmniSMM 1.0) without shared context pollution, with dynamic token decryption, secure webhook routing, and isolated customer journeys.
- **Problem**: Previously, `src/app/api/webhooks/telegram/route.ts` only handled the default singleton bot using hardcoded `db.systemSettings.findFirst()` without tenant scoping. Outbound payment notifications and customer support were hardcoded to `smmplan`, causing brand bleeding for `flux` or custom white-label storefronts.
- **Solution**:
  1. Dynamic Webhook Endpoint: `/api/webhooks/telegram/[tenantId]` with timing-safe HMAC validation (`x-telegram-bot-api-secret-token`) per tenant.
  2. Multi-Tenant Bot Dispatcher in `MultiBotManager`: on-demand resolution and caching of `Telegraf` instances by `tenantId` with proxy failover and role handler attachment.
  3. Hybrid Token Resolution in `token-resolver.ts`: seamlessly resolves tokens from `TelegramBotInstance` and `SystemSettings.telegramBotToken` with AES-256 decryption.
  4. Tenant-Aware Outbound Messaging: `sendTenantMessage()` routes notifications (order confirmations, payment success, ticket replies) via the specific tenant's bot.

## 2. Security & Compliance
- **OWASP A08 / Telegram Webhook Security**:
  - `x-telegram-bot-api-secret-token` validated using `crypto.timingSafeEqual` against the tenant's decrypted webhook secret.
  - Fail-Closed: requests lacking secret or with mismatching secret are rejected with `401 Unauthorized`.
- **IP Allowlist Enforcement**:
  - Validates client IP against `tenant.telegramAllowedIps` when configured.
- **Tenant Isolation**:
  - Each bot instance runs with its dedicated `tenantId`, isolating catalog queries, balance operations, tickets, and user bindings.
- **Maintenance Guard**:
  - Rejects webhook updates with `503 Service Unavailable` if `telegramMaintenanceMode` is enabled for that tenant.

## 3. Contract & Route Specifications
- **Dynamic Webhook Route**: `POST /api/webhooks/telegram/[tenantId]`
  - URL Param: `tenantId` (e.g. `smmplan`, `flux`, `alpha-brand`).
  - Headers: `x-telegram-bot-api-secret-token: <secret>`.
  - Body: Telegram Update JSON payload.
  - Response: `{ ok: true }` (200) or error (401/403/500/503).
- **Legacy Fallback Route**: `POST /api/webhooks/telegram?tenant=<tenantId>`
  - Maintains 100% backward compatibility for existing bots.

## 4. Verification Plan
- Unit tests:
  - Token resolution priority (`TelegramBotInstance` vs `SystemSettings` vs Env).
  - Timing-safe HMAC webhook secret verification.
  - Webhook dispatching with valid and invalid tenant IDs.
  - Maintenance mode and IP filtering.
  - Outbound messaging routing to the correct tenant bot.
- Regression tests: AST tenant isolation, linting, build & typecheck.
