# ADR-005: Quarantine & Referral Accounting Model, Ledger Invariants, and Idempotency Guarantees

**Status:** APPROVED  
**Date:** 2026-07-25  
**Domain:** Financial Core, Wallet & Escrow Safety  
**Context:** SMMplan Lite Architecture (ALSH v1.0 Remediation Batch 2)

---

## 1. Context & Problem Statement

Prior to this ADR, financial operations involving quarantine holds (`escrow.service.ts`) and referral transfers (`referral.action.ts`, `marketing.service.ts`) mutated `quarantineBalance` and `referralBalance` via raw database updates without canonical financial accounting rules.

An internal architectural review identified three critical vulnerabilities in naive balance management:

1. **Financial Invariant Violation (`amount: 0` in hold):** If a quarantine hold decrements `User.balance` by `X` but creates a `LedgerEntry` with `amount = 0`, the fundamental financial invariant `User.balance == SUM(LedgerEntry.amount)` fails immediately.
2. **Idempotency Leaks without Unique Constraint:** Checking idempotency via `findFirst` without a database `@unique` constraint allows concurrent race conditions to double-decrement user balances before inserting duplicate ledger records.
3. **Misplaced Idempotency Guards in Compound Operations:** Checking idempotency *after* decrementing a sub-balance (`referralBalance`) causes retries to double-decrement the source balance while returning a cached response for the target credit.

---

## 2. Decision & Architectural Principles

### 2.1 The Two Fundamental Financial Invariants

The system MUST enforce two independent financial equations at all times:

#### Invariant A: Main Balance Reconciliation
$$\text{User.balance} = \sum_{\text{LedgerEntry}} \text{amount}$$
Every change to `User.balance` MUST be accompanied by a `LedgerEntry` where `LedgerEntry.amount` equals the exact net change in `User.balance` (negative for debits/holds, positive for credits/releases).

#### Invariant B: Quarantine Reserve Reconciliation
$$\text{User.quarantineBalance} = \sum \text{amount}(\text{QUARANTINE\_HOLD}) - \sum \text{amount}(\text{QUARANTINE\_RELEASE}) - \sum \text{chargeAmount}(\text{QUARANTINE\_CHARGE})$$
The quarantine balance represents an isolated reserve bubble. It MUST equal the sum of active holds minus releases and settled charges.

---

### 2.2 Canonical Accounting Rules for Quarantine Operations

| Operation | `User.balance` | `User.quarantineBalance` | `LedgerEntry.amount` | `LedgerEntry.transactionType` | Rationale |
|---|---|---|---|---|---|
| **`QUARANTINE_HOLD`** | Decrement $-X$ | Increment $+X$ | $-X$ | `QUARANTINE_HOLD` | Funds move from main balance into quarantine reserve. `balance` drops by $X$, ledger records $-X$. |
| **`QUARANTINE_RELEASE`** | Increment $+X$ | Decrement $-X$ | $+X$ | `QUARANTINE_RELEASE` | Quarantine reserve returned to client main balance. `balance` increases by $X$, ledger records $+X$. |
| **`QUARANTINE_CHARGE`** | No change ($0$) | Decrement $-X$ | $0$ | `QUARANTINE_CHARGE` | Quarantined funds settled/spent. `balance` unchanged (already debited during hold); `totalSpent` incremented by $X$. |

---

### 2.3 Strict Idempotency & Database Constraint Mandate

1. **Prisma Schema Requirement:** `LedgerEntry` MUST maintain `@unique([idempotencyKey, transactionType])` or `@unique([idempotencyKey])`.
2. **First-Pass Guard:** All compound operations (`ReferralOps.transferToMain`, `QuarantineOps.hold`, `WalletOps.charge`) MUST execute `findFirst({ where: { idempotencyKey } })` **at the very beginning of the function, BEFORE any balance decrement**.
3. **Database Concurrency Backstop:** If two concurrent requests pass `findFirst` simultaneously, the database unique index WILL reject the second `LedgerEntry.create` with code `P2002`. The enclosing `$transaction` will immediately `ROLLBACK`, restoring all balance updates atomically.

---

### 2.4 Sub-Balance Transfer Ordering (`ReferralOps`)

For all sub-balance operations (such as transferring referral earnings to main cash balance):

```text
Step 1: Check idempotency key on LedgerEntry (BEFORE any balance mutation).
Step 2: Atomically decrement referralBalance with optimistic guard:
        where: { id: userId, referralBalance: { gte: transferAmount } }
Step 3: Credit main balance & write LedgerEntry (+transferAmount) via WalletOps.credit.
```

If `step 2` returns `count === 0`, throw `REFERRAL_INSUFFICIENT_FUNDS`.

---

## 3. Verification & Acceptance Criteria

1. **Invariant Gate:** `reconciliation.ts` passes `USER_BALANCE_LEDGER_MATCH` across all quarantine hold, release, and charge lifecycles.
2. **Replay Safety:** Duplicate invocations of `transferToMain` or `quarantineHold` with identical `idempotencyKey` result in exactly ONE balance decrement and ONE ledger entry.
3. **Type Safety:** All monetary inputs use `BigInt` conversion cleanly without JS floating-point precision loss for amounts $> 2^{53}$ cents.

---

**Approved by:** Antigravity Architect & Security Audit Lead
