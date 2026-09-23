# Adversarial Audit by minimax/minimax-m3:free

Date: 2026-08-30T19:19:38.666Z

# ADVERSARIAL AUDIT REPORT — OmniSMM 4-Wave Testing & Verification Plan

**Subject:** Pre-Mortem Stress Test Plan
**Architect Role:** Principal Software Quality / Distributed Systems / Cyber-Security
**Verdict Discipline:** Uncompromising, evidence-based, ruthlessly constructive

---

## 1. EXECUTIVE VERDICT: **REVISE (Conditional)**

The plan demonstrates strong architectural awareness — BigInt kopecks math, idempotency keys, RFC 9331, escrow semantics, and WCAG 2.2 touch targets are all present. However, the plan is **test-thin at the seams where production actually breaks**: serialization boundaries, partial failures, idempotency violations, webhook spoofing, queue poisoning, and clock/timing hazards. Several Wave 4 assertions are also too coarse for a multi-tenant fintech platform that runs marketing campaigns during traffic spikes.

**Approval is withheld until at minimum the 14 critical findings below are remediated and the 8 defensive countermeasures are integrated into the gate criteria.**

---

## 2. CRITICAL BLIND SPOTS & MISSING EDGE CASES

### A. Fintech & Ledger Domain (Wave 1)

| # | Blind Spot | Why It Will Bite in Production |
|---|---|---|
| **F-1** | **Idempotency key generation & replay is unverified.** Idempotency is mentioned in Wave 2c ("re-queued with idempotencyKey") but the **mechanism** (Redis SETNX, DB unique constraint, or in-memory?) and **replay safety** (same key arriving 10× in 1ms) are untested. | A retried webhook or BullMQ redelivery (BullMQ has at-least-once semantics) can double-charge a wallet if the idempotency key is not enforced at the **ledger insert** boundary, not just at the queue boundary. |
| **F-2** | **No test for serialization-layer fractional kopecks.** `BigInt` is immune, but JSON.stringify on the API boundary will silently coerce `1234567890123456789n` to `1234567890123456800` (Number precision loss). | Customer adds 1.5 RUB → API serializes as 150 (Number) → ledger stores 150 kopecks → silent 0.5 RUB theft/loss per request. |
| **F-3** | **No currency unit mismatch test.** Plan assumes RUB throughout. What happens if `provider.currency === 'USD'` but customer wallet is RUB? Is there a tested FX path? Is it **synchronous** at quote time and **frozen** at debit time (TTL of quote)? | A 60-second stale FX quote during RUB/USD volatility can silently undercharge or overcharge. |
| **F-4** | **No dead-letter / stuck-transaction test.** What happens when the 1 of 20 successful debit threads crashes **after acquiring the lock but before committing**? | Wallet shows 0 RUB but no `LedgerEntry` exists → money disappears. Need a lock-lease expiry test + orphaned-transaction reaper. |
| **F-5** | **No negative-balance race at DB constraint layer.** Plan tests the application logic, but not whether the Postgres schema has a CHECK constraint or trigger preventing negative balances as a last line of defense. | If a code path bypasses the service layer (e.g., admin SQL, migration backfill, future microservice), the database itself must refuse. |
| **F-6** | **No test for concurrent credit + debit race.** 19 debits failing while 1 credit (refund) succeeds simultaneously — does the credit see the "insufficient funds" state and itself fail? | A refund issued for a cancelled order during high contention can be **lost**, permanently. |
| **F-7** | **ExactMath coverage is asserted but not adversarially fuzzed.** Only "negative" and "fractional" tested. Missing: `NaN`, `undefined`, `null`, string `"1000"`, scientific `"1e3"`, exponential, max-safe-integer overflow into BigInt, mixed BigInt+Number arithmetic (which throws at runtime). | One bad client payload → 500 error → leaked stack trace in dev mode → potential info disclosure. |
| **F-8** | **Decimal.js vs BigInt inconsistency not addressed.** Plan mixes terminology. If `ExactMath` wraps Decimal.js, fractional kopecks are *representable* (sub-kopeck accounting is real in FX arbitrage). Need an explicit policy test: *"rejects amounts where kopeck fraction ≠ 0"* OR *"rounds half-even and logs discrepancy"*. | Silent rounding policy divergence between client SDK and server. |

### B. Provider Failover & Queue Lifecycle (Wave 2)

| # | Blind Spot | Why It Will Bite |
|---|---|---|
| **Q-1** | **BullMQ stall + visibility timeout not tested.** What happens if a worker crashes mid-`order.processor`? Job is requeued after stalled interval — but if the **provider API was already called** and the provider actually fulfilled the order, the customer gets charged twice. | This is the single most expensive class of bug in SMM panels. Requires **provider-side idempotency check** (order ID in provider's system) tested explicitly. |
| **Q-2** | **No exponential backoff / max-retry exhaustion test.** Plan verifies auto-flush works; doesn't verify what happens after 5 retries fail. Does the job land in BullMQ's `failed` set? Does the customer's wallet auto-refund? Is there a manual operations queue? | Stuck failed jobs accumulate, customer funds are held forever in escrow, support tickets flood. |
| **Q-3** | **Auto-flush is single-threaded but not tested for thundering herd.** If 10,000 orders accumulate in PENDING_CHECK and balance refills by 1 RUB, what is the dispatch policy? FIFO? Priority by margin? Rate-limited to provider's documented RPS? | Provider IP ban, single bottleneck on flush, or OOM if queue is materialized. |
| **Q-4** | **No webhook spoofing / replay test.** Real providers (and attackers) can POST to webhook endpoints. Plan doesn't test webhook signature verification, timestamp tolerance, or replay-window enforcement. | Attacker forges "order completed" webhook → customer charged, no service delivered, funds gone. |
| **Q-5** | **No test for partial provider response.** Provider returns 200 OK but with malformed JSON, missing `orderId`, or inconsistent internal state. | Order marked complete in DB, never delivered, no retry path. |
| **Q-6** | **No clock-skew / TTL test.** Escrow hold duration, idempotency key expiry, provider quote TTL, JWT expiry — none tested under `+/- 30s` clock skew between app, DB, and Redis. | Refund released at T+24h, but provider's clock is T+24h+1m → duplicate fulfillment window. |

### C. Multi-Tenant & Security (Wave 3)

| # | Blind Spot | Why It Will Bite |
|---|---|---|
| **T-1** | **Tenant isolation is tested via application layer only.** No test for Prisma middleware enforcement, no test for Postgres Row-Level Security (RLS), no test for raw-SQL bypass (analytics queries, migrations, BI tools). | One developer writes `prisma.$queryRaw\`SELECT * FROM orders\`` for a report → cross-tenant data leak. |
| **T-2** | **No JWT / session-tenant binding test.** What if a user from tenant "flux" presents a valid session token to a "smmplan" subdomain? Does the tenant claim come from the **token**, the **subdomain**, the **cookie**, or all three (defense in depth)? | Subdomain confusion attack (`flux.attacker.com` with `smmplan` JWT) → cross-tenant access. |
| **T-3** | **No tenant-scoped rate-limit test.** Wave 3 tests `/api/v2` globally. What if one tenant is the source of 100 req/2s? Does it starve other tenants' legitimate traffic? | Tenant-level DoS becomes platform-level DoS. |
| **T-4** | **No admin-impersonation test.** The `x_admin_tenant` cookie is tested for catalog partitioning but not for **audit-logging**: when an admin switches tenant, every mutation must be logged with `(actor_admin_id, source_tenant, target_tenant, action, ts)`. | Insider data exfiltration with no audit trail. |
| **T-5** | **No test for the unauthenticated path.** Rate limiting is tested only against authenticated endpoints. What about the public storefront during a flash sale? Cart endpoints? Email-collection forms? | Low-cost volumetric DDoS through the public surface, bypassing auth-tier limits. |

### D. Visual QA & Mobile Ergonomics (Wave 4)

| # | Blind Spot | Why It Will Bite |
|---|---|---|
| **V-1** | **Pixel diff is asserted as binary but no tolerance specified.** A 1-pixel anti-aliasing diff in Tailwind's font rendering between Chromium versions will produce flaky CI. | False-positive build failures, or worse — false-negatives that ship regressions. |
| **V-2** | **No dark-mode / forced-colors test.** WCAG 2.2 SC 1.4.6 (contrast enhanced) and SC 1.4.10 (reflow) are partially covered by touch target tests but not by visual diff. | Accessibility lawsuit risk, especially in EU markets. |
| **V-3** | **No tablet viewport (768x1024) or landscape mobile (844x390) test.** Tailwind 4 breakpoints are assumed but not asserted. | Real customers on iPads see broken layouts while CI shows green. |
| **V-4** | **No dynamic-content test.** Screenshots are taken on empty cart, no notifications, English locale. What about RTL languages (Arabic, Hebrew), 10,000-item cart, 47-character product titles? | Visual CI is theater; production breaks. |
| **V-5** | **Touch-target test measures rendered pixels but not hit-area overlays.** A 44px-tall button with `pointer-events: none` on its parent, or with a nested absolutely-positioned element overlapping it, will fail hit-testing despite passing the rendered-size assertion. | Customers tap, nothing happens, "site is broken" complaints. |

---

## 3. THREE-STEP PRE-MORTEM FAILURE SCENARIOS

> *Imagining the system has been live for 6 months. Three production incidents have occurred. Working backwards.*

### **INCIDENT 1 — "The Vanishing Refund"**
**Timeline:** Black Friday. 12,000 concurrent orders.
**Trigger:** Provider API returns 200 OK with valid-looking JSON but never delivers. Auto-flush runs, refunds queue up.
**Failure cascade:**
1. Refund job calls `wallet.credit(userId, amount)` **without** checking if the original debit succeeded (no compensating-transaction test).
2. 47 customers had their **original debits fail** at the DB constraint layer (F-5 missing), but their **refunds succeed** → system has now **minted money from nothing**.
3. End-of-day reconciliation (`SUM(credit) - SUM(debit) === balance`) passes because both sides of the failing 47 are zero, but `total_system_money` has drifted **upward**.
4. Detected 3 days later during external audit.

**Required Defensive Countermeasures:**
- **DCM-1:** Add **compensating-transaction pairing test** — every credit must reference a prior successful debit `orderId` in the same tenant; otherwise hard-fail the refund.
- **DCM-2:** Add **DB-level CHECK constraint**: `CHECK (balance >= 0)` on wallet row, with **negative-balance alert** to ops Slack channel in <5s.
- **DCM-3:** Add **end-of-day reconciliation job** that asserts `SUM(wallets.balance) + SUM(escrow_holds) = SUM(ledger.total_minted - ledger.total_burned)` to absolute zero tolerance, with auto-page on drift.

### **INCIDENT 2 — "The BullMQ Time Bomb"**
**Timeline:** Random Tuesday, 03:00 UTC.
**Trigger:** Redis cluster has a 90-second failover (network partition).
**Failure cascade:**
1. BullMQ workers reconnect and find 4,800 jobs in `delayed` state.
2. Worker requeues a job that **already executed 4 minutes ago** but whose `completed` callback was lost during the partition.
3. Provider receives duplicate `order.create` requests with the same `idempotencyKey` — but the provider's idempotency window is only 60 seconds.
4. 312 orders get fulfilled twice. Customer wallets debited twice. **Money is created from nothing** (provider was paid, customer was charged, no service was delivered twice but money was extracted twice).
5. Customer support tickets flood. Chargebacks begin.

**Required Defensive Countermeasures:**
- **DCM-4:** Add **provider-acknowledged-idempotency test** — call `order.create` 10× with the same key in 1ms, assert provider returns the same `providerOrderId` and only **one** wallet debit exists.
- **DCM-5:** Add **ledger-side idempotency constraint** — `UNIQUE INDEX ON ledger_entries(order_id, operation_type)` to prevent duplicate entries at DB level, not just application level.
- **DCM-6:** Add **stuck-job reaper test** — any order in `PROCESSING` state for >N minutes without a corresponding `LedgerEntry` of type `SETTLED` must trigger an alert and auto-refund path.

### **INCIDENT 3 — "The Tenant Bleed"**
**Timeline:** Marketing campaign launch, traffic spike.
**Trigger:** A/B testing tool sets `x_admin_tenant` cookie to test different landing pages.
**Failure cascade:**
1. A misconfigured A/B test sends 100