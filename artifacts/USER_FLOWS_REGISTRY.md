# SMMplan Lite — User Flows Registry

This registry provides a comprehensive mapping of all positive and negative user flows within the SMMplan platform (as of February 2026). It documents the backend Server Actions, core services, validation schemas, and defensive security controls.

---

## 📂 Codebase Area Reference Map

The business logic of these flows is primarily located within:
* **Authentication**: `src/actions/auth/`, `src/lib/session.ts`, `src/app/api/auth/`
* **Ordering & Billing**: `src/actions/order/`, `src/services/admin/order.service.ts`, `src/services/core/order.service.ts`
* **Payment Gateways & Webhooks**: `src/services/financial/`, `src/app/api/webhooks/`
* **Support & Live Chat**: `src/actions/support/`, `src/services/support/`, `src/app/api/support/chat/`
* **Telegram & Workers**: `src/bot/`, `src/workers/`

---

## 📈 1. Positive User Flows (Happy Paths)

### Flow A: Authentication & Access Control

#### 1. Standard Password Registration
* **Trigger Component**: `LoginForm` (tab: `'register'`) in `src/app/(auth)/login/login-form.tsx`
* **Entry Point**: `registerWithPasswordAction` in `src/actions/auth/password-register.ts`
* **Validations & Rules**:
  * Enforces minimum 8-character password.
  * Limits sign-up to **3 registrations per 24 hours per IP** via Redis.
  * Performs atomic transaction with `Serializable` isolation level to block duplicate emails.
  * Automatically grants the **first registered user the `OWNER` role**; subsequent registrations default to `USER`.
  * Hashes passwords using scrypt and generates a 15-minute verification token sent via SMTP.

#### 2. Magic Link Auth (Auto-Sign Up)
* **Trigger Component**: `LoginForm` (tab: `'magic'`) in `src/app/(auth)/login/login-form.tsx`
* **Entry Point**: `requestMagicLink` in `src/actions/auth/request-magic-link.ts`
* **Validations & Rules**:
  * Limits requests to **15 per hour per IP**.
  * Autocreates users on the fly if they do not exist.
  * Immediately deletes newly created user records if SMTP email sending fails to prevent system clutter.

#### 3. Verification & Callback Session Initiation
* **Callback Route**: `GET /api/auth/verify` in `src/app/api/auth/verify/route.ts`
* **Validations & Rules**:
  * Atomically flags the verification token as `used = true` inside `db.authToken.updateMany` to protect against token-reuse race conditions.
  * Establishes a signed JWT (`session_token`) containing session metadata and registers the session in the database.
  * Directs administrators to `/admin/dashboard` and regular clients to `/dashboard`.

#### 4. B2B Client API Key Authentication
* **Entry Point**: `verifyApiKey` in `src/lib/b2b-auth.ts`
* **Validations & Rules**:
  * Evaluates B2B request headers (`X-API-Key`).
  * Hashes incoming key via SHA-256 and compares it with `User.apiKeyHash` in a timing-safe format.

---

### Flow B: Ordering & Financial Transactions

#### 5. Single Order Placement (Wallet Balance)
* **Entry Point**: `checkoutAction` in `src/actions/order/checkout.ts`
* **Validations & Rules**:
  * Enforces `user.balance >= finalTotalCents` (wallet check).
  * Executes billing inside a `Serializable` transaction: calls `WalletOps.charge` to deduct cents, creates a `LedgerEntry` record, updates order status to `PENDING`, and schedules dispatch.

#### 6. Payment Gateway Redirect Checkout
* **Entry Point**: `PaymentGatewayFactory.getGateway` in `src/services/financial/payment-gateway.service.ts`
* **Validations & Rules**:
  * Employs gateway drivers for **Yookassa**, **Robokassa**, and **CryptoBot**.
  * **FZ-54 Receipt Regulation**: YooKassa driver evaluates the system's annual turnover: applies VAT code 7 (5% VAT) if annual revenue exceeds 20,000,000 RUB, otherwise defaults to VAT code 1 (Tax-free).
  * Generates unique payment redirect URLs and registers them in `db.payment`.

#### 7. Mass Order Placement
* **Entry Point**: `massOrderCheckoutAction` in `src/actions/order/mass.ts`
* **Validations & Rules**:
  * Parses multi-line orders using `parseMassOrderText` (`ID | Link | Quantity`).
  * **TOCTOU Price Lock**: Compares calculated price against the UI's `expectedTotalRub`. Blocks execution if cost has shifted by >1%.

#### 8. Smart Drip-Feed Campaign Setup
* **Entry Point**: `SmartDripService.createCampaign` in `src/services/dripfeed/smart-drip.service.ts`
* **Validations & Rules**:
  * Applies configured markup surcharge.
  * Randomly splits order quantity into randomized sub-tasks (`SmartTask`) distributed randomly across selected days.
  * Downscales chunk sizes to a safe organic ceiling (e.g. 10 units) if `useInviteBuffer` is active.

---

### Flow C: Support Chat & Smart Binding

#### 9. Real-Time Chat Stream (SSE)
* **Entry Point**: `GET /api/support/chat/stream` in `src/app/api/support/chat/stream/route.ts`
* **Validations & Rules**:
  * Subscribes browser `EventSource` hook ([useChatSSE.ts](file:///d:/SMM_plan_2/src/components/support/chat/useChatSSE.ts)) to `sseBroadcaster` singleton.
  * Bypasses proxy buffering using custom headers (`X-Accel-Buffering: no`, `Cache-Control: no-transform`, `Content-Encoding: none`).
  * Sends heartbeat pings every 25 seconds.

#### 10. Smart Telegram Account Binding
* **Entry Point**: Telegram bot `/start tg_bind_{token}` handler in `src/bot/index.ts`
* **Validations & Rules**:
  * Resolves token and links client `telegramId` to user profile.
  * **Transactional Data Merge**: Performs a `Serializable` transaction: merges support tickets, payments, ledger entries, and orders from the temporary guest bot profile (`tg_{telegramId}@smmplan.bot`) into the primary web user account, then deletes the guest profile.
  * Upgrades user status to `isKycVerified = true` (removing card limit restrictions).

#### 11. Omnichannel Email Responses
* **Entry Point**: `POST /api/webhooks/inbound-email` in `src/app/api/webhooks/inbound-email/route.ts`
* **Validations & Rules**:
  * Parses inbound SMTP emails containing `support+{ticketId}@smmplan.local`.
  * Strips email reply headers and history chains using regex matching.
  * Saves incoming email attachments to local encrypted storage.

---

## 📉 2. Negative User Flows (Abuses & Exceptions)

### Flow D: Authentication & Session Revocation

#### 12. Rate-Limited Password Lockout
* **Failure Condition**: Bruteforce attempts on login.
* **Control**: IP limit checked via `RateLimitService` (`auth:password:ip`, max 20 attempts/hour) and Email lockout: `password-attempts:${email}` in Redis (lockout for 15 minutes after 5 failures).
* **Information Leak Prevention**: Returns generic error message `"Неверный email или пароль"` even if user does not exist.

#### 13. Active Session Invalidation
* **Failure Condition**: Security compromise or password change.
* **Control**: Setting a new password triggers `db.session.deleteMany({ where: { userId } })`, invalidating and terminating active session cookies on all devices.

#### 14. Staging Elevated Access Prevention
* **Failure Condition**: Bypassing logins on staging/production environments.
* **Control**: `verifySession()` limits staging auto-login (`DEV_AUTO_LOGIN`) strictly to local developer requests (`127.0.0.1` / `localhost`).

---

### Flow E: Ordering & Payment Exceptions

#### 15. Insufficient Wallet Balance
* **Failure Condition**: Account balance is lower than order charge.
* **Control**: UI component `DrawerPaymentSelector` hides the balance checkout button. Server-side `checkoutAction` double-checks DB balance and throws a soft error if spoofed.

#### 16. Target Link Type Refusal
* **Failure Condition**: Mismatch between user link and service network category.
* **Control**: [mutateLink](file:///d:/SMM_plan_2/src/validators/link-mutators.ts) normalizes and strips URL trackers. `getLinkValidator` parses links according to service `targetType` requirements (e.g. `CHANNEL` vs `POST` vs `STORY`), rejecting post links when subscribing, and private channels (`t.me/c/`).

#### 17. Webhook Signature Mismatch / Spoofing
* **Failure Condition**: Fraudulent webhook requests simulating payments.
* **Control**: Whitelists official gateway IP subnets. Rejects payloads missing secret query keys. Employs `crypto.timingSafeEqual` signature checks. **Double-Check API**: Directly query gateway APIs (`api.yookassa.ru`) to confirm payment status before crediting users.

#### 18. Quarantine Cooldown Triggers
* **Failure Condition**: Defective service routes or extreme provider price hikes.
* **Control**: `QuarantineService` quarantines services:
  * *Trigger A*: High API timeout rates (5+ errors/hour -> 2 hour cooldown).
  * *Trigger B*: High cancellation rate (cancellations > 30% -> up to 12 hour cooldown).
  * *Trigger D (Rate Hike)*: Provider cost spikes by >20%.
  * *Loss Prevention*: Retail prices drop below cost due to currency fluctuations.

---

### Flow F: Support, Workers & Integrations

#### 19. Daily Compensation Limit Enforcement
* **Failure Condition**: Operator refunds/compensations exceeding budget.
* **Control**: Sums operator's daily actions via `getMSKMidnightUTC()`. Blocks actions exceeding `supportLimitCents` (e.g. 500 RUB limit) unless triggered by `OWNER` or B2B accounts.

#### 20. Provider-Side Cancellation Lock (Critical Financial Risk)
* **Failure Condition**: Operator cancels active orders with providers lacking cancel APIs.
* **Control**: Orders dispatched to providers with `isCancelEnabled = false` block operator cancellation, throwing a detailed warning. Only `ADMIN` or `OWNER` can force refund locally.

#### 21. BullMQ Worker Failures & Dead Letter Queue (DLQ)
* **Failure Condition**: Upstream API crash or fatal queue task errors.
* **Control**: Re-attempts jobs 3 times with exponential backoff. Failing jobs are pushed to `dlqQueue`. Trigger `orderService.failOrderTerminalFast` to automatically rollback and refund customer balance, then send critical alerts to admins in Telegram.

#### 22. SSE Client Disconnection & Heartbeat Drops
* **Failure Condition**: Transient network drop or multiple opened tabs.
* **Control**: Limit of 10 concurrent EventSource channels per chat (returns 429). Client-side fallback to polling `/api/support/messages?after={timestamp}` every 5 seconds if connection fails 3 times, resuming live-feed seamlessly.

#### 23. DoS via Upload Spams
* **Failure Condition**: Flooding server storage with large images/attachments.
* **Control**: Content-Length stream limits (10 MB) on email inbound webhook; 10 MB limit on Telegram attachments; anti-spam threshold (max 15 files/day per user).

---

## 🛡️ Validation & Threat Mitigation Matrix

| Flow Area | Vulnerability / Threat | Mitigation Logic | Code Reference |
| :--- | :--- | :--- | :--- |
| **Authentication** | Brute-force & Stuffing | IP Rate limit + Email lockout key in Redis. | [password-login.ts](file:///d:/SMM_plan_2/src/actions/auth/password-login.ts#L31-L40) |
| **Sign-Up Callbacks** | Token replay attack | Atomic update check `used = false` inside update. | [verify/route.ts](file:///d:/SMM_plan_2/src/app/api/auth/verify/route.ts#L42-L47) |
| **B2B Integration** | API Key leakage | SHA-256 key hashing + timingSafeEqual verification. | [b2b-auth.ts](file:///d:/SMM_plan_2/src/lib/b2b-auth.ts) |
| **Fulfillment** | Underpayment & TOCTOU | Server-side pricing recalculation in transactions. | [checkout.ts](file:///d:/SMM_plan_2/src/actions/order/checkout.ts#L93-L120) |
| **Fulfillment** | Upstream net timeout | `PENDING_CHECK` state lock, manual validation. | [cleanup.processor.ts](file:///d:/SMM_plan_2/src/workers/processors/cleanup.processor.ts) |
| **Billing Webhooks** | Signature Spoofing | Direct API gateway query (Yookassa/CryptoBot). | [yookassa/route.ts](file:///d:/SMM_plan_2/src/app/api/webhooks/yookassa/route.ts#L145-L154) |
| **Support Limits** | Budget leakage | Twice-evaluated Support budget check in transaction. | [compensation.ts](file:///d:/SMM_plan_2/src/actions/support/compensation.ts#L37-L45) |
| **Support Operations**| Double-charge locks | Disallows local cancels if provider cancel is off. | [order.service.ts](file:///d:/SMM_plan_2/src/services/admin/order.service.ts) |
| **Support SSE** | Proxy buffering | Headers `X-Accel-Buffering` + `Content-Encoding`. | [stream/route.ts](file:///d:/SMM_plan_2/src/app/api/support/chat/stream/route.ts#L115-L123) |
| **Support Chat** | Client connection drops | Client-side poll fallback with `after={timestamp}`. | [useChatSSE.ts](file:///d:/SMM_plan_2/src/components/support/chat/useChatSSE.ts#L25-L39) |
| **Worker Queue** | Stuck pending orders | Chrono sweeper `runOrphanSweep` executes every 15m. | [cleanup.processor.ts](file:///d:/SMM_plan_2/src/workers/processors/cleanup.processor.ts) |
