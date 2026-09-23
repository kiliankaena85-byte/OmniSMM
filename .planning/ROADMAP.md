NS # Roadmap: SMMplan_lite

## Overview

SMMplan_lite is an automated, smart SMM panel optimized for high margins with no automatic failover, smart link analysis, and embedded financial control. 
**Current Development Focus:** v2.0 Extensions & Integration (B2B API & i18n).

## Phases

- [x] **v1.0 Milestone History:**
  - Archived: [v1.0 ROADMAP](./milestones/v1.0-ROADMAP.md) | [v1.0 REQUIREMENTS](./milestones/v1.0-REQUIREMENTS.md)

- [x] **Phase 1: B2B Reseller API Gateway**

## Phase Details

### Phase 1: B2B Reseller API Gateway
**Goal**: Build public API endpoints allowing third-party panels to buy directly from Smmplan_lite using user balances.
**Depends on**: v1.0 Core
**Requirements**: [B2B-01, B2B-02, B2B-03, B2B-04]
**Success Criteria**:
  1. User can generate an API key from frontend.
  2. External system can post to `/api/v1/order` and successfully deduct balance in cents.
  3. API Service mapping returns a properly formatted JSON compatible with PerfectPanel specs.
**Plans**: PLAN.md (Completed)

## Progress

**Execution Order:**
Phases execute in numeric order: 1, 999.1

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. B2B Reseller API Gateway | 1/1 | Completed | x |
| 2. Production Hardening | 1/1 | Completed | x |
| 999.1. B2B Promo Banner | 1/1 | Completed | x |
| 999.2. Guest Mass Order Demo | 1/1 | Completed | x |
| 999.3. Mass Order API Gateway | 1/1 | Completed | x |
| 999.4. Auth-Zone Routes E2E Testing | 1/1 | Completed | x |
| 999.5. User-Agent Hijack Review | 1/1 | Completed | x |
| 999.6. Worker Backoff Policy | 1/1 | Completed | x |
| 999.7. Shadow Catalog | 1/1 | Completed | x |
| 999.8. Active Service Price Drift Detection | 1/1 | Completed | x |
| 999.9. Dark Mode Refactoring | 1/1 | Completed | x |
| 999.11. Provider Ticket URL | 1/1 | Completed | x |
| 999.12. Knowledge Base & Blog | 1/1 | Completed | x |
| 999.13. Email Security Setup | 1/1 | Completed | x |
| 999.14. Mobile Link Input Restoration | 1/1 | Completed | x |

### Phase 2: Production Hardening (Docker, CI/CD, Deployment Architecture) (COMPLETED)

**Goal:** Ensure safe, rapid, and resilient deployment of the new architecture.
**Requirements:**
- CI/CD Pipeline (GitHub Actions linting, typecheck, vitest, security audits).
- Docker optimization (multi-stage Dockerfile, standalone Next.js build).
- Production compose configuration (PostgreSQL, Redis, App, Nginx, Certbot, Loki/Promtail/Grafana, Backups).
- Nginx security settings (rate limits per route type) and secure CSP headers.
**Plans:** 1/1

Plans:
- [x] Dockerized Linux Environment & Production setup (Completed)

## Backlog

### Phase 999.1: B2B Promo Banner on Landing (Frictionless Acquisition) (COMPLETED)

**Goal:** Promote B2B reseller cabinet and mass ordering capabilities to professional agencies on the main guest landing page without cluttering the minimalist core single-order UX.
**Requirements:**
- Add a premium, high-converting CTA card/banner inside [WhyUs.tsx](file:///d:/SMM_plan_2/src/components/landing/WhyUs.tsx) or [SmartLinkLanding.tsx](file:///d:/SMM_plan_2/src/components/landing/SmartLinkLanding.tsx) pointing to the registration page.
- Showcase B2B benefits: Excel batch parsing, pre-funded balance payments, discount tiers, and API access.
**Plans:** 1/1 (PLAN.md)

Plans:
- [x] 1. Bento Card Integration in WhyUs.tsx (Completed)

### Phase 999.2: Guest Mass Order Demo & Pre-Registration Gateway (COMPLETED)

**Goal:** Enable guest users to experience mass link parsing and pricing calculations directly on the landing page, prompting a frictionless registration step only at the moment of payment execution.
**Requirements:**
- Add a "Mass Order" tab option to the main [SmartLinkLanding.tsx](file:///d:/SMM_plan_2/src/components/landing/SmartLinkLanding.tsx) header.
- Provide a bulk text input, parse lines in memory, display structural feedback, and intercept checkout with a premium onboarding modal.
**Plans:** 1/1

Plans:
- [x] Guest mass ordering tab, calculation logic, and email checkouts (Completed)

### Phase 999.3: Mass Order API Gateway Extensions (COMPLETED)

**Goal:** Provide programmatic bulk order submission for pro resellers and external panels using our PerfectPanel-compliant API v2 routing.
**Requirements:**
- Extend the API handler in `src/app/api/v2/route.ts` to support multi-order action request payloads (`add_multi`).
- Verify balance availability atomically and return structured arrays of success order IDs and individual validation errors.
**Plans:** 1/1

Plans:
- [x] PerfectPanel-compliant add_multi implementation in API v2 (Completed)

### Phase 999.4: Auth-Zone Routes E2E Testing (COMPLETED)

**Goal:** Provide full automated routing coverage for authenticated zones (dashboard, admin) to ensure no runtime 404/500 errors exist for logged-in users.
**Requirements:**
- Implement Playwright E2E fixtures that simulate test-user and test-admin sessions.
- Crawl all routes protected by verifySession to guarantee zero broken links in protected panels.
**Plans:** 1/1

Plans:
- [x] Crawling all authenticated/admin routes via E2E Playwright setup (Completed)

### Phase 999.5: User-Agent Hijack Protection Review (COMPLETED)

**Goal:** Review and strengthen session hijacking defenses beyond the current User-Agent verification to prevent false-positive logouts and increase security.
**Requirements:**
- Perform an independent auth security review.
- Evaluate alternative or supplementary hijacking protections (e.g. rotating refresh tokens, IP anomaly detection, device fingerprinting).
**Plans:** 1/1

Plans:
- [x] User-Agent self-healing session migration with security event logging (Completed)

### Phase 999.6: Worker Backoff Policy Review (COMPLETED)

**Goal:** Review and implement backoff strategies and retry limits for BullMQ workers to prevent Storm of Retries (DoS) if external providers or APIs fail.
**Requirements:**
- Audit all background queues for exponential backoff config.
- Add max retry limits to avoid infinite looping.
**Plans:** 1/1

Plans:
- [x] Exponential/fixed backoff settings and retry limits configured globally in queue-manager (Completed)

### Phase 999.7: Shadow Catalog Memory Optimization (COMPLETED)

**Goal:** Optimize memory usage for the Shadow Catalog by preventing full JSON parsing on every page load or filter action.
**Requirements:**
- Implement a more efficient storage and querying strategy (e.g., Redis Hash, sorted sets, chunked storage, or a PostgreSQL staging table).
- Risk mitigation: Prevent N simultaneous admin sessions from consuming N * 3-6MB of heap space.
**Plans:** 1/1

Plans:
- [x] Implemented ShadowService PostgreSQL table and cherry-pick import logic (Completed)

### Phase 999.8: Active Service Price Drift Detection (COMPLETED)

**Goal:** Prevent silent margin erosion by monitoring active services for gradual price increases below the 20% quarantine threshold.
**Requirements:**
- Implement a drift-check mechanism within `syncProviderCatalog`.
- Create alerts for accumulated price increases over time that could silently reduce profitability.
**Plans:** 1/1

Plans:
- [x] Cumulative Price Drift & 30-day Price History verification (Completed)

### Phase 999.9: Dark Mode UX/UI Refactoring (COMPLETED)

**Goal:** [Captured for future planning] Разобраться с темной темой, устранить визуальный бардак, оптимизировать FOUC-эффекты и привести к единому премиальному стандарту в соответствии с gsd-dark-mode-manifest.md.
**Requirements:** TBD
**Plans:** 1/1

Plans:
- [x] Replaced opaque borders with translucent luminance borders in globals.css (Completed)

### Phase 999.10: Dark Mode Manifest Skill Audit (BACKLOG)

**Goal:** [Captured for future planning] Провести аудит и проверку самого скилла gsd-dark-mode-manifest.md, обновить рекомендации под актуальные особенности Tailwind CSS v4 и HeroUI v3.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.11: Provider Ticket URL Integration in Orders Table (COMPLETED)

**Goal:** [Captured for future planning] Внедрить в таблицу "Заказы" рядом с ID провайдера прямую ссылку на его сайт/страницу создания тикетов, добавив ручное управление URL для каждого провайдера в его карточке настроек.
**Requirements:**
- Добавить поле `ticketUrl` в модель `Provider` в Prisma.
- Добавить поле ввода для `ticketUrl` в форму создания/редактирования провайдера в админке.
- В админ-таблице заказов выводить кликабельную ссылку-иконку рядом с внешним ID заказа/провайдера, ведущую прямо на URL тикетов этого провайдера для быстрого разрешения споров оператором.
**Plans:** 1/1

Plans:
- [x] Fully integrated, tested, and committed (Completed)

### Phase 999.12: Guest & Client Knowledge Base & SEO Blog Gateway (COMPLETED)

**Goal:** Создать встроенную базу знаний и блог для клиентов, ориентированный на SEO/AEO-продвижение Smmplan, информирование об алгоритмах соцсетей, лимитах накрутки, и нативную конверсию читателей в покупателей.
**Requirements:**
- Спроектировать Prisma-модель `Article` (slug, title, description, content, status, category, viewCount).
- Разработать динамический SEO-генератор с поддержкой разметки JSON-LD (Schema.org `BlogPosting`) в Next.js 16.
- Внедрить текстовый редактор Markdown в панель администратора для удобного написания статей контент-менеджерами.
- Создать воронку конверсий: контекстные виджеты с ценами на подходящие услуги Smmplan прямо внутри обучающих статей.
**Plans:** 1/1

Plans:
- [x] Secure Markdown engine, JSON-LD meta generator, admin ArticleForm and widgets (Completed)

### Phase 999.13: Email Security and Corporate Mailbox Setup (COMPLETED)

**Goal:** Настройка безопасной почты на корпоративном домене support@smmplan.pro через Яндекс 360 для бизнеса и прописывание записей MX, SPF, DKIM, DMARC, CAA на REG.RU для исключения email-спуфинга и попадания писем в спам.
**Requirements:**
- Зарегистрировать организацию в Яндекс 360 для бизнеса.
- Подтвердить владение доменом `smmplan.pro`.
- Настроить DNS-записи (MX, SPF, DKIM, DMARC, CAA) в панели REG.RU.
- Создать почтовый ящик `support@smmplan.pro` и включить SMTP/IMAP.
- Сгенерировать пароль приложения и обновить SMTP-переменные в `.env` файле на продакшене.
**Plans:** 1/1

Plans:
- [x] SMTP settings configuration panel and Nodemailer dynamic dispatch integration (Completed)

### Phase 999.14: Mobile Link Input Restoration (Single-Input Architecture) (BACKLOG)

**Goal:** Восстановить доступность единой строки ввода ссылки в мобильной версии SMMplan без дублирования элементов интерфейса (строго 1 строка ввода на экране), устранив баг исчезновения Шага 1 в пошаговом мастере MobileWizard при переходе по категориям и тарифам.
**Requirements:**
- **Single-Input Architecture (Строго один инпут):** Исключить дублирование полей ввода ссылки между Hero-блоком и мобильным мастером. На мобильных устройствах работает единая, сфокусированная точка ввода.
- **Устранение бага исчезновения в `MobileStep1Link.tsx`:** Устранить ветку `return null`, из-за которой при `currentStep > 1` и пустом URL строка ввода ссылки бесследно пропадала из DOM. Если ссылка не заполнена, Шаг 1 всегда остается видимым и доступным для ввода/редактирования в 1 тап.
- **Инвариант стейт-машины `useMobileWizard.ts`:** При открытии страниц категорий (`/services/[network]/...`) или смене тарифа сохранять видимость и фокус единого поля ссылки, не ломая шаг оформления.
- **UX & Accessibility:** Высота поля $\ge 44$px (touch target), размер шрифта `text-base` (16px) для предотвращения авто-масштабирования в iOS Safari, плавный переход к выбору тарифов после ввода ссылки.
**Plans:** 1/1

Plans:
- [x] Single-Input restoration, null-check prevention in MobileStep1Link and auto-focus (Completed)
