# BRIEFING — 2026-07-04T17:01:29+03:00

## Mission
Conduct a thorough security and business logic audit for Milestone M1 (R1) covering Promo codes, UTM campaigns, and referral system.

## 🔒 My Identity
- Archetype: explorer
- Roles: Security and Business Logic Auditor, Code Reviewer
- Working directory: d:\SMM_plan_2\.agents\teamwork_preview_explorer_r1_1
- Original parent: 82143d6c-1da8-40c1-92f0-f5e4c13f5b58
- Milestone: M1 (R1)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement.
- Specifically check the codebase for Race-to-Apply, financial calculation errors, and referral fraud in key files.
- Verify all findings with specific file names and line numbers. Do not run code directly.

## Current Parent
- Conversation ID: 82143d6c-1da8-40c1-92f0-f5e4c13f5b58
- Updated: 2026-07-04T17:05:00+03:00

## Investigation State
- **Explored paths**:
  - `src/services/marketing-utils.ts`
  - `src/services/marketing.service.ts`
  - `src/services/admin/marketing.service.ts`
  - `src/services/admin/analytics.service.ts`
  - `src/services/admin/order.service.ts`
  - `src/services/core/order.service.ts`
  - `src/services/users/loyalty.service.ts`
  - `src/actions/admin/marketing.ts`
  - `src/actions/user/promo.ts`
  - `src/actions/user/referral.action.ts`
  - `src/actions/order/checkout.ts`
  - `src/app/admin/marketing/promocode-columns.tsx`
  - `src/workers/processors/cleanup.processor.ts`
  - `prisma/schema.prisma`
- **Key findings**:
  - **Race-to-Apply**: Concurrency is locked using Serializable transactions and atomic updates (secure). However, unpaid checkout orders permanently consume promo code uses, and cleanup/cancellation paths do not decrement the uses.
  - **Financial calculation risks**: Promo code budget creation has a Zod schema input with no max value, triggering integer overflow on Postgres `Int` columns if budget is >= 21.5M rubles. Profitability calculations can return negative values when remains exceed quantity.
  - **Referral fraud vectors**: Commissions are instantly credited to the referrer's `referralBalance` during checkout and can be instantly cashed out. Subsequent cancellations result in negative referral balances, leaving the platform with a financial loss. Manual admin cancellations and webhook partial completion updates fail to reverse commissions. Self-referral protection only checks 2-cycles and is bypassable.
- **Unexplored areas**: None.

## Key Decisions Made
- Audit was fully scoped and completed. Detailed reports written to analysis.md and handoff.md.

## Artifact Index
- d:\SMM_plan_2\.agents\teamwork_preview_explorer_r1_1\analysis.md — Detailed audit findings
- d:\SMM_plan_2\.agents\teamwork_preview_explorer_r1_1\handoff.md — Handoff report summarizing the findings
