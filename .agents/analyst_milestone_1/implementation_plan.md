# Implementation Plan: Payment Return Flow Session Fix & UX Redesign

## 1. Context & Objective
When users pay via external gateways (e.g., YooKassa, CryptoBot) and are redirected back to the `/success` page, their browsers (especially in-app browsers like Telegram/VK or Safari with strict ITP) often drop the `session_token` cookie. This results in false-positive "Unauthorized" (401) errors when the client polls `/api/order-status`.
**Goal:** Fix the session cookie issue by using a secure capability token (JWT) in the return URL and redesign the `/success` page with progressive fallback (Phase 1: 30s auto-polling, Phase 2: Manual retry).

## 2. Double-Pass Planning: 5 Vectors of Reliability
1. **Server/Client Boundary**: Perfect separation. Token generation (`SignJWT`) happens securely in Server Actions (`checkout.ts`, `mass.ts`). Verification (`jwtVerify`) happens securely in the Route Handler (`/api/order-status`). The Client Component (`SuccessContent`) simply passes the token.
2. **Chaos and Void (Cold Start, Broken Data)**:
   - *Token missing/expired*: Graceful fallback to the existing 15-minute `isRecentlyUpdated` IP/time-based guard.
   - *Webhook delayed*: Auto-polling handles 30s. Manual refresh triggers the synchronous API fallback check.
3. **Visual & UX Density**: Progressive disclosure. First, an automated spinner (Phase 1), then prominent buttons (Phase 2). Uses Tailwind 4 semantic variables (`bg-primary`, `bg-warning/10`).
4. **WCAG 2.2 AA Accessibility**: Buttons will have standard `py-3` padding ensuring >44px touch targets. Icon + text used for cognitive accessibility.
5. **Security & Trust (Trust Boundary)**:
   - Token is scoped **only** for `purpose: 'payment_return'`.
   - It grants NO global session access. If a user shares the link, the receiver can only view the order status, preventing IDOR/Account Takeover.
   - Token expires in 24h.

## 3. Pre-Mortem Analysis (Failure Simulation)
| Scenario | Risk (P x I) | Mitigation in Code |
|---|---|---|
| Link sharing (user sends `/success?orderId=123&token=abc` to friend) | Medium x High | Token is strictly a capability URL for viewing order status, NOT for global session authentication. |
| Webhook delayed by >1 minute | High x Medium | Phase 1 auto-polling (30s) ends. Phase 2 manual "Обновить статус" button allows the user to re-trigger the synchronous YooKassa/CryptoBot API check. |
| Browser strips all URL query params on redirect | Low x High | `SuccessContent` handles `no-context` by showing "Нет данных о платеже" and a button to the Dashboard. |
| Token generation (JWT) throws an error during Server Action (e.g. jose/crypto error, missing SECRET) | Low x Critical | Token generation will be wrapped in a `try/catch`. If it fails, checkout proceeds normally without appending `&token=`. This prevents a luxury UX feature from breaking core payment flow. |

## 4. UI-SPEC / API-SPEC (Technical Blueprint)

### Step 1: Token Generation in Server Actions
**Files to Modify:**
- `src/actions/order/checkout.ts` (Both `checkoutAction` and `retryCheckoutAction`)
- `src/actions/order/mass.ts` (`massOrderCheckoutAction`)

**Implementation Details:**
- Import `SignJWT` from `jose` and `getEncodedKey` from `@/lib/session`.
- Generate a JWT:
  ```typescript
  let token = '';
  try {
    token = await new SignJWT({ 
      orderId: result.orderId, // or paymentId for mass orders
      purpose: 'payment_return' 
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(getEncodedKey());
  } catch (e) {
    console.error('[Checkout] Failed to generate return capability token:', e);
  }
  ```
- Append `&token=${token}` to the `successUrl` **only if** `token` is not empty.
- **Note for `mass.ts`**: Currently it sets `successUrl = ${origin}/success`. Change it to pass `paymentId=${result.paymentId}` and conditionally append `&token=${token}`.

### Step 2: Capability Token Validation
**File to Modify:** `src/app/api/order-status/route.ts`

**Implementation Details:**
- Add support for resolving `paymentId` if `orderId` is missing (for mass orders). If `paymentId` is provided, find the `Payment` and return its status mapped to the expected object shape (e.g., `{ status: payment.status, charge: payment.amount, serviceName: 'Массовый заказ' }`).
- Read `token` from `req.nextUrl.searchParams`.
- If `!session`, verify the token:
  ```typescript
  let isTokenValid = false;
  if (token) {
    try {
      const { jwtVerify } = await import('jose');
      const { getEncodedKey } = await import('@/lib/session');
      const { payload } = await jwtVerify(token, getEncodedKey());
      if (payload.purpose === 'payment_return' && (payload.orderId === orderId || payload.paymentId === paymentId)) {
        isTokenValid = true;
      }
    } catch (e) {}
  }
  ```
- Bypass the `if (!isAwaiting && !isRecentlyUpdated) return 401` block if `isTokenValid === true`.

### Step 3: Success Page UX Redesign
**File to Modify:** `src/app/success/SuccessContent.tsx`

**Implementation Details:**
- Add `paymentId` reading from `useSearchParams()`. Pass both `orderId` (or `paymentId`) and `token` to the `/api/order-status` fetch call.
- Change constants to:
  `const MAX_POLLS = 6;`
  `const POLL_INTERVAL = 5000;` (5s interval for 30s).
- Add state: `const [isManualFetching, setIsManualFetching] = useState(false);`
- **Phase 1 UI:** Automatically polls up to 6 times. Shows progress bar `(pollCount + 1) / MAX_POLLS`.
- **Phase 2 UI:** When `pollCount >= MAX_POLLS`, replace the progress bar and hint with:
  ```tsx
  <div className="space-y-4 animate-in fade-in duration-300">
    <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 text-left">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
        <div className="text-sm text-warning-text">
          <p className="font-semibold mb-1">Подтверждение задерживается</p>
          <p>Банк ещё не прислал ответ. Нажмите «Обновить статус», чтобы запросить статус вручную, или проверьте позже.</p>
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={handleManualRefresh}
        disabled={isManualFetching}
        className="flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all duration-200 disabled:opacity-50"
      >
        <RefreshCw className={cn("w-4 h-4", isManualFetching && "animate-spin")} />
        Обновить статус
      </button>
      <Link
        href="/dashboard/orders"
        className="flex items-center justify-center gap-2 py-3 bg-card border border-border text-foreground rounded-xl font-semibold text-sm hover:bg-muted transition-all duration-200"
      >
        <LayoutDashboard className="w-4 h-4" /> В Мои заказы
      </Link>
    </div>
  </div>
  ```
- `handleManualRefresh` will call `checkStatus()` and set `isManualFetching`.

## 5. Summary
This plan fully addresses the false-positive errors on the success page caused by lost session cookies in in-app browsers, securely opening a capability window via JWT. It also provides a robust 2-phase UI with 30s polling and manual fallback, respecting Smmplan's Zero-Defect and Semantic standards.
