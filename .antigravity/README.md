# Antigravity Evidence-First Audit & Remediation Harness (AEARH v1.1) & Left-Shift Harness (ALSH v1.0)

AEARH is an enterprise high-assurance framework designed to audit, remediate, verify, and enforce security and financial integrity across complex microservice & monolith architectures.

ALSH (Left-Shift Secure Coding Harness) prevents vulnerable code from being committed or merged by placing golden path primitives, static prohibitions (SC01-SC12), test-first gates, invariant gates, and an adversarial Breaker agent directly into the development cycle.

---

## 1. What is AEARH & ALSH
- **AEARH:** Audits evidence packs, verifies baseline hashes, and enforces level requirements (L0 to L8).
- **ALSH:** Left-shift code protection blocking insecure code *before* merge via static rules, test-first gates, invariant checks, and Breaker attack simulations.

## 2. Evidence Levels (AEARH)
- **L0_CLAIMED:** Declarative claim without code or test proof.
- **L1_DESIGN_PRESENT:** Architecture design document present.
- **L2_CODE_IMPLEMENTED:** Source code implemented with exact file/line references.
- **L3_POSITIVE_TEST_PASSED:** Unit/integration happy-path test passed.
- **L4_NEGATIVE_TEST_PASSED:** Security negative test (tampering/invalid payload rejection) passed.
- **L5_RACE_FUZZ_PASSED:** Multi-worker concurrent fuzz test passed.
- **L6_RECONCILIATION_PASSED:** Financial SQL reconciliation invariants verified on active database state.
- **L7_MONITORED:** Real-time production telemetry and alerts configured.
- **L8_PRODUCTION_PROVEN:** Incident-free execution verified in production over time.

## 3. Golden Path Primitives (ALSH)
- `IdempotencyKeys` (`src/services/financial/idempotency-keys.ts`): Factory functions producing stable, deterministic business idempotency keys.
- `TenantScope` (`src/lib/tenant-scope.ts`): Helpers `requireTenantId`, `tenantWhere`, `assertSameTenant` enforcing tenant isolation.
- `verifyWebhook` (`src/lib/webhook-verify.ts`): Fail-closed HMAC & IP verification function.
- `RefundPolicy` (`src/services/financial/refund-policy.ts`): Mathematical over-refund protection clamping refund amounts.

## 4. Static Prohibitions (ALSH SC01–SC12)
- **SC01_DIRECT_BALANCE_MUTATION:** Direct balance/totalSpent/referralBalance increments outside WalletOps.
- **SC02_UNSTABLE_IDEMPOTENCY_KEY:** Date.now() / Math.random() in idempotency keys.
- **SC03_TENANTLESS_LOOKUP:** Tenant-scoped model queries missing tenantId filter.
- **SC04_WEBHOOK_FAIL_OPEN:** Fail-open `if (secret && signature)` webhook checks.
- **SC05_REFUND_OVERCHARGE:** WalletOps.refund calls lacking idempotencyKey.
- **SC06_COMMISSION_NO_UNIQUE:** Commission creation without unique constraint or upsert.
- **SC07_OWNER_FROM_METADATA:** WalletOps user ownership loaded from untrusted metadata/body.
- **SC08_UNSAFE_MUTEX_RELEASE:** Redis lock release without ownership token.
- **SC09_FLOAT_MONEY:** Floating point operations on money values without integer cents parsing.
- **SC10_CAMPAIGN_OUTSIDE_TX:** Smart Drip campaign creation outside serializable checkout transaction.
- **SC11_MISSING_CURRENCY_CHECK:** Payment confirmation missing explicit currency check.
- **SC12_LOG_SECRET:** Logging passwords, tokens, API keys, or signatures.

## 5. Commands
```bash
# AEARH Commands
npm run harness:baseline       # Runs baseline gate
npm run harness:validate       # Runs evidence validator against report JSON
npm run harness:scan           # Runs static surface scanners
npm run harness:reconcile      # Runs 13 financial reconciliation SQL checks
npm run harness:test           # Runs Vitest integration suite
npm run harness:evals          # Runs golden eval test cases
npm run harness:selftest       # Runs harness Vitest self-test suite
npm run harness:all            # Runs complete AEARH pipeline

# ALSH Left-Shift Commands
npm run harness:leftshift            # Runs 8-step blocking Merge Gate
npm run harness:leftshift:rules      # Runs static prohibition rules SC01-SC12 on codebase
npm run harness:leftshift:testgate   # Runs Test-First Gate on git diff
npm run harness:leftshift:invariants # Runs Invariant Gate on seeded test DB
```

## 6. How to Add a New Static Rule
1. Add rule handler function in `.antigravity/scripts/leftshift/rules/index.ts`.
2. Add positive fixture `.antigravity/evals/leftshift/<CODE>.positive.ts` (anti-pattern).
3. Add negative fixture `.antigravity/evals/leftshift/<CODE>.negative.ts` (safe code).
4. Register rule test assertion in `.antigravity/tests/leftshift.test.ts`.
