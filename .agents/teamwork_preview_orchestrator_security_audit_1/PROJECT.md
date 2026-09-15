# Project: SMMplan Security & Business Logic Audit

## Architecture
- API SMM panel that resells services from providers.
- Tech Stack: Next.js 16, React 19, Prisma 5 (PostgreSQL), BullMQ, Redis, TypeScript 5.7+
- All financial balances are stored as integers/BigInt in cents (kopeeks).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Audit R1 | Promo codes, UTM, referral logic & fraud | none | DONE |
| 2 | M2: Audit R2 | BullMQ workers, order lifecycle, race-to-cancel, DLQ | none | DONE |
| 3 | M3: Audit R3 | Financial Ledger, concurrency, rounding, orphan checks | none | DONE |
| 4 | M4: Final Report | Synthesize all findings into the final security audit report | M1, M2, M3 | DONE |

## Interface Contracts & Areas of Focus
- **R1 Audit targets**:
  - `src/services/marketing-utils.ts`
  - `src/actions/marketing/`
  - `src/actions/order/checkout.ts` (promo block)
  - Models: `PromoCode`, `PromoCodeUsage`, `User.referralCode`, `User.referredBy`
- **R2 Audit targets**:
  - `src/workers/`
  - `src/services/providers/universal.provider.ts`
  - `src/services/providers/quarantine.service.ts`
  - `src/actions/order/`
- **R3 Audit targets**:
  - `src/utils/balance-verifier.ts`
  - `src/services/financial/accounting.service.ts`
  - `src/services/financial/payment.service.ts`
  - `src/lib/transactions.ts`
  - Models: `LedgerEntry`, `Payment`, `User.balance`
