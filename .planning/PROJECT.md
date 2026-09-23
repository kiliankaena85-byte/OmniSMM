## Current Milestone: v3.2 (Future Expansion)

**Goal:** Continue adding high-value B2B/B2C features and client engagement tools.

**Target features:**
- Implement Phase 999.10: Dark Mode Manifest Skill Audit.
- Implement link SMM orders in support chats.

## Current State: v3.1 (SHIPPED)
- **v1.0 Foundation:** Next.js 16 App Router, Prisma, JWT auth, Smart URL Matching, Integer Math, CMS, Volume Tiers, CRON queues.
- **v2.0 B2B API:** Fully working API v2 (services, add, status, balance, refill, cancel). 317 lines, production-ready.
- **v3.0 Admin Panel MVP & Infrastructure:** 8-tab comprehensive dashboard (Orders, Clients, Catalog, Tickets, Finance, Settings, Dashboards, Refills). Strict RBAC (OWNER/ADMIN/MANAGER/SUPPORT).
- **v3.1 Post-MVP & Production Hardening:**
  - Automated CI/CD (GitHub Actions) & multi-stage Docker builds.
  - Full E2E Playwright testing coverage for admin & client dashboards.
  - Active Service Price Drift Detection (30-day cumulative drift).
  - Guest Mass Order calculation and onboarding.
  - B2B API mass ordering extensions (`add_multi`).

## Archived Concepts
<details>
<summary>Archived / Future Concept Boundaries</summary>

- [Visual Telegram Bot Builder with Live Emulator] — Отложен до Волны 3. Слишком сложный UI.
- [Programmatic SEO (pSEO)] — Отложен: без реальных данных страницы будут пустыми.
- [Failover Provider Routing] — Отложен: сложная маршрутизация с разными API-форматами.
- [Email Inbound Parsing] — Telegram + Web покрывают 95% обращений.
- [CMS Blog Engine] — Отложен до Волны 2 (Tab 09).
- [Mass Mailing Engine] — Отложен до Волны 3.
- [Enterprise Webhook Subscriptions] — отложено до реальной B2B нагрузки.
- [Oauth Social Login] — юридические риски блокировок в РФ 2026.
- [Сложная геймификация (NPS, Achievements)] — утяжеляет Lite.
</details>
