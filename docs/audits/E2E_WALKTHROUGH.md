# SMMplan E2E Verification Walkthrough Report

This report summarizes the E2E verification of SMMplan's critical business flows performed on the local production environment (http://localhost:3000) using Playwright.

---

## 1. Executive Summary

| Flow | Spec File | Status | Key Features Tested | Generated Screenshots |
| --- | --- | --- | --- | --- |
| **Registration & Ordering** | `e2e-registration-ordering.spec.ts` | **PASSED** | User creation, cabinet login, link auto-detection, order configuration, balance payment | [registration_page.png](artifacts/registration_page.png), [cabinet_dashboard.png](artifacts/cabinet_dashboard.png), [order_form_filled.png](artifacts/order_form_filled.png), [order_placed_success.png](artifacts/order_placed_success.png) |
| **Support SSE Chat** | `e2e-support-sse.spec.ts` | **PASSED** | Live-chat creation, support operator workspace, SSE real-time message stream, ticket closure | [ticket_created.png](artifacts/ticket_created.png), [operator_tickets_workspace.png](artifacts/operator_tickets_workspace.png), [sse_message_received.png](artifacts/sse_message_received.png), [ticket_closed.png](artifacts/ticket_closed.png) |
| **Loss Prevention & Limits** | `e2e-loss-prevention-limits.spec.ts` | **PASSED** | Provider-side cancellation guards, staff daily compensation limit enforcement | [cancellation_blocked.png](artifacts/cancellation_blocked.png), [compensation_limit_exceeded.png](artifacts/compensation_limit_exceeded.png) |

---

## 2. Detailed Flow Diagnostics & Verification

### Flow A: Registration and Ordering Flow
- **Goal**: Verify that a new user can sign up, log in, paste a link to auto-detect the Telegram platform, select the Category and Service tariff, input quantity, and pay for the order using their seeded balance.
- **Diagnostics**:
  - Initially, the Playwright selector `div:has(label:has-text("Категория")) button` matched the **"Обновить баланс"** (Refresh Balance) button in the sidebar because the entire page wrapper `div` contains the label "Категория", and the refresh button is the first button inside the page wrapper. This caused the dropdown click to be misrouted.
  - Sibling select fields for **"Услуга"** (Service) and **"Способ оплаты"** (Payment Gateway) suffered from the same issue.
- **Implemented Fix**:
  - Refactored the selectors to use strict label matching on parent wrappers:
    - **Category**: `page.locator('div').filter({ has: page.locator('label:text-is("Категория")') }).locator('button').first()`
    - **Service**: `page.locator('div').filter({ has: page.locator('label:text-is("Услуга")') }).locator('button').first()`
    - **Gateway**: `page.locator('div').filter({ has: page.locator('label:text-is("Способ оплаты")') }).locator('button').first()`
  - Added multi-stage fallback click handlers (using dispatch events) to ensure compatibility with custom `@base-ui/react` select popups in headless Chromium.

### Flow B: Support Ticket Live Chat & SSE updates
- **Goal**: Verify client-operator real-time live chat communication via Server-Sent Events (SSE).
- **Diagnostics**:
  - The test initially failed because the ticket subject had a mismatch (`👁 Чат с поддержкой` vs `Чат с поддержкой`). We corrected this in the spec.
  - Additionally, during local testing in Next.js, Server Actions and API Routes are built into separate code bundles. Because the `sseBroadcaster` singleton was in-memory, the Operator Server Action published events to a different broadcaster instance than the one the API stream was listening to.
- **Implemented Fix**:
  - Refactored the SSE broadcaster singleton in `src/lib/sse-broadcaster.ts` to attach to `globalThis`, ensuring it survives hot-module reloading and module context separation:
    ```typescript
    const globalForSSE = globalThis as unknown as { sseBroadcaster?: SSEBroadcaster };
    export const sseBroadcaster = globalForSSE.sseBroadcaster ?? new SSEBroadcaster();
    if (process.env.NODE_ENV !== 'production') {
      globalForSSE.sseBroadcaster = sseBroadcaster;
    }
    ```

### Flow C: Loss Prevention & Limits Flow
- **Goal**: Prevent operator errors and financial leakage by verifying block rules for order cancellation and daily refund limits.
- **Verification status**: **PASSED**
  - **Cancellation Block**: Checked that support operators cannot cancel orders where the provider does not support cancellation. A warning toast is correctly displayed:
    > *"Отмена невозможна: услуга ... не поддерживает отмену на стороне провайдера. Только Администратор или Владелец могут принудительно отменить этот заказ."*
    - Captured in: [cancellation_blocked.png](artifacts/cancellation_blocked.png)
  - **Support Limit Enforcement**: Verified that if an operator attempts to cancel/refund an order that would exceed their daily limit (e.g. 500 RUB), the action is blocked:
    - Captured in: [compensation_limit_exceeded.png](artifacts/compensation_limit_exceeded.png)

---

## 3. How to Execute
To verify the complete suite now that code and select locators are optimized:
```powershell
$env:PLAYWRIGHT_TEST_BASE_URL="http://localhost:3000"; npx playwright test e2e/e2e-registration-ordering.spec.ts e2e/e2e-support-sse.spec.ts e2e/e2e-loss-prevention-limits.spec.ts --project=chromium
```
