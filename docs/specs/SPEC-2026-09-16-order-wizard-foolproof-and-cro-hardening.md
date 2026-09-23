# SPEC-2026-09-16: Order Wizard & Checkout Fail-Closed Hardening & CRO Excellence

## 1. Context & Business Objectives

> **Status:** PROPOSED (Human Approval Gate Pending)  
> **Tier:** Tier 1 (Critical: Orders, Financial Integrity, Checkout Wizard, CRO)  
> **Target Systems:** `src/components/orders/`, `src/hooks/useOrderEngine.ts`, `src/hooks/useBaseOrderValidation.ts`, `src/components/landing/order-engine/useCheckoutOrchestrator.ts`, `src/actions/order/checkout.ts`  
> **Architectural Contract:** [AGENTS.md](file:///e:/SMM/AGENTS.md) (v4.1)

### Objectives:
1. **Absolute Fail-Closed Security & Concurrency Integrity**:
   - Zero double-submission race conditions: client-stable `idempotencyKey` lifecycle across retries.
   - Deep protection against URL tampering, SSRF, and protocol injection (`javascript:`, `file:`, cloud metadata).
   - Strict adherence to OmniSMM financial invariants: all balance debits strictly via `WalletOps.charge()` with `LedgerEntry` (Ledger-First Principle).
   - Strict enforcement of the Drip-Feed Floor Invariant ($\lfloor Q/N \rfloor \ge \text{minQty}$) and exact price calculations via `ExactMath` & `marketingService.calculatePrice()`.
2. **CRO & Frictionless User Experience (2026 Standards)**:
   - Instant Auto-Sanitization of pasted URLs (stripping UTM, `igsh`, tracking tags while strictly preserving functional parameters `?start=`, `?v=`, `?reply=`, `?single`).
   - Dynamic Quantity Guard: live stepper, instant min/max badges, auto-clamping on blur, and clear feedback.
   - Smart Payment Recommendation: automatic selection of balance when sufficient, clear deficit callouts ("Не хватает X ₽") with 1-click fallback to card/SBP.
   - Actionable Error Feedback: eliminate generic error banners across all wizards by connecting `parseActionableError()`.
   - SessionStorage Draft Retention: seamless recovery of order parameters upon accidental refresh or swipe.

---

## 2. Comparative Audit: Proposed Draft vs OmniSMM Reality

| Feature Area | User's Naive Draft Proposal | OmniSMM 1.0 Enterprise Reality & Invariants | Verdict & Risk |
|---|---|---|---|
| **Balance Mutation** | Direct SQL decrement: `tx.user.update({ balanceKopecks: { decrement } })` | **STRICTLY BANNED**. All operations strictly via `WalletOps.charge()` with pre-created immutable `LedgerEntry`. | 🚨 **Severe Violation**: Breaks ledger, causes unaccounted balance changes, violates 54-FZ & PCI DSS. |
| **Pricing Calculation** | Naive formula: `(quantity * pricePer1000) / 1000` | Strictly `marketingService.calculatePrice()` + `ExactMath.calculateOrderCostKopecks()` with Banker's rounding, loyalty tiers, margin floors. UI strictly displays `₽ / шт` (Rule 4). | 🚨 **Pricing Exploit**: Naive formula bypasses volume tiers and margin protection floors. |
| **URL Sanitizer** | Rigid regex block for 4 networks; strips all query params | `unifiedLinkEngine` + `link-canonicalizer.ts` covering 15+ networks; preserves functional parameters (`?start=`, `?v=`, `?reply=`). | ⚠️ **Breaking Bug**: Naive regex breaks TG bots, YouTube videos, and VK comments. |
| **Idempotency** | Server-only 15s Redis lock; client generates new random key in useEffect | Database unique constraint `Order.idempotencyKey` + client-retained key throughout the checkout attempt. | ⚠️ **Double Charge Risk**: If client re-generates UUID on click, duplicates bypass idempotency. |
| **Multi-Tenancy** | Hardcoded single-tenant logic | OmniSMM 1.0 multi-tenant engine (`smmplan.pro` vs `smmflux.ru`) isolated by `tenantId`. | ⚠️ **Tenant Leak**: Violates platform isolation contract. |

---

## 3. Detailed Component Contracts & Remediation Specifications

### Phase 1: Shared Validation & Sanitization Engine (`src/hooks/useBaseOrderValidation.ts`)
1. **Extend `useBaseOrderValidation.ts`**:
   - `sanitizeAndNormalizeUrl(rawUrl: string, platformSlug?: string, targetType?: string)`:
     - Trims leading/trailing whitespace.
     - Rejects dangerous protocols (`javascript:`, `data:`, `file:`, `vbscript:`).
     - Strips tracking query parameters using `stripQueryParams` while preserving functional parameters.
     - Auto-prepends `https://` if missing.
     - Validates format via `getLinkValidator(platformSlug, targetType)`.
   - `clampQuantity(value: number, min: number, max: number, runs?: number)`:
     - Clamps input between `min * (runs || 1)` and `max`.
   - `getStableIdempotencyKey(existingKey?: string)`:
     - Returns existing key or initializes `ord_${Date.now()}_${randomUUID()}`.

### Phase 2: Client Idempotency & Concurrency Hardening
1. **`src/components/landing/order-engine/useCheckoutOrchestrator.ts`**:
   - Ensure `checkoutParams` explicitly includes `idempotencyKey`.
   - Generate and persist `idempotencyKey` in the hook state when the user configures the order, retaining it across retries.
   - Lock submit button instantly upon click (`setIsSubmitting(true)`).
2. **`src/components/orders/SmmplanOrderWizard.tsx`**:
   - Maintain a stable `idempotencyKey` in `useSmmplanOrderWizard.ts` instead of generating a fresh UUID on every submit button click.
   - Reset `idempotencyKey` only after successful order placement or when changing service.

### Phase 3: Smart Payment Selection & CRO Recommendation
1. **`src/components/orders/wizard/sub/CheckoutPaymentMethod.tsx` & `PaymentGatewaySelectionModal.tsx`**:
   - Calculate `hasEnoughBalance = userBalanceCents >= totalOrderCostCents`.
   - If `hasEnoughBalance`:
     - Default selection to `balance`.
     - Highlight with green badge: `"Оплата в 1 клик • 0% комиссии"`.
   - If `!hasEnoughBalance`:
     - Default selection to `yookassa` (Cards/SBP).
     - On the balance button, show: `"Доступно: X ₽ (не хватает Y ₽)"`.
     - Display quick switch / top-up helper CTA.

### Phase 4: Actionable Error Shield Across All Wizards
1. **`src/components/orders/SmmplanOrderWizard.tsx`**:
   - Connect `parseActionableError(res.error)` in the error handler.
   - Render structured error cards with action buttons (e.g. `Оплатить картой / СБП`, `Скорректировать количество`, `Выбрать тариф для приватных ссылок`).

---

## 5. Test Strategy & Verification Plan (TDD Red-Green Phase)

1. **Unit Tests (`src/__tests__/unit/order-foolproof-and-cro.test.ts`)**:
   - Test 1: `sanitizeAndNormalizeUrl` rejects `javascript:...` and non-http protocols.
   - Test 2: `sanitizeAndNormalizeUrl` strips UTM params but preserves YouTube `?v=` and TG `?start=`.
   - Test 3: `clampQuantity` clamps below min, above max, and obeys Drip-Feed Floor multiplier.
   - Test 4: Idempotency key stability: retrying a failed submit re-uses the same key; success generates a fresh key.
   - Test 5: Actionable error classification returns actionable CTAs for balance insufficiency and link network mismatch.
2. **Regression CI Gate**:
   - `npx dotenv -e .env.test -- vitest run -c vitest.unit.config.ts src/__tests__/unit/order-base-validation.test.ts`
   - `npx dotenv -e .env.test -- vitest run -c vitest.unit.config.ts src/__tests__/unit/user-journey-order-payment-lifecycle.test.ts`
   - `npm run typecheck` (`tsc --noEmit`).
   - `node scripts/check-bundle-secrets.mjs`.
