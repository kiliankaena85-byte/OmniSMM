# Original User Request

## 2026-06-09T14:58:34+03:00

You are the teamwork_preview_orchestrator for the mobile layout visual audit and bug fixing task on the Smmplan project.
Your workspace directory is `d:\SMM_plan_2\.agents\orchestrator_mobile_audit/` (please use this path for your plans, progress, and coordination files).
Your mission is to execute the user request recorded in `d:\SMM_plan_2\ORIGINAL_REQUEST.md` (read it for requirements and acceptance criteria).
You must analyze the codebase, coordinate specialist agents (e.g. explorers, workers, reviewers), and ensure all acceptance criteria are met, including:
- Mobile viewport layout visual audit on screens (320px to 480px width) using Playwright/browser tools.
- Fixing all visual bugs following Tailwind CSS 4.0.0 rules (no inline/hardcoded colors like text-white, use semantic tokens).
- Playwright screenshot tests for mobile viewport width.
- Code passes lint and typecheck.
Verify all completed tasks, compile progress into `d:\SMM_plan_2\.agents\orchestrator_mobile_audit/progress.md`, and report completion when done.

## Follow-up — 2026-06-09T12:03:37Z

Hello Orchestrator,

The user has updated the request with an expanded specification for the mobile layout visual audit (v2). Please make sure your implementation plan and subagents are updated to address these details:

## Расширенная спецификация аудита (v2)

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
