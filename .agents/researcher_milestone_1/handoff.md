# Handoff Report: Phase 2 Researcher & Pre-Mortem Audit

## 1. Observation
- Inspected `src/lib/session.ts` (line 53). Confirmed that Next.js sets `session_token` with `sameSite: 'lax'`.
- Inspected `src/app/api/order-status/route.ts` (lines 41-47). Confirmed that without a session, it falls back to a 15-minute `isRecentlyUpdated` guard and `isAwaiting`.
- Inspected `src/actions/order/checkout.ts` (line 461) and `src/actions/order/mass.ts` (line 331). Confirmed that `successUrl` currently relies entirely on browser cookies to display order status correctly.
- Reviewed `d:\SMM_plan_2\.agents\analyst_milestone_1\implementation_plan.md`. The plan included 3 Pre-Mortem risks and passed the 5 Vectors of Reliability. However, it lacked a fallback for the token generation step (`new SignJWT().sign(getEncodedKey())`), which throws a fatal error if `JWT_SECRET` is missing.

## 2. Logic Chain
- **Confirmation 1**: `sameSite: 'lax'` (set in `src/lib/session.ts`) instructs the browser not to send the cookie in cross-site `POST` requests.
- **Confirmation 2**: Payment gateways often use `POST` to return to `successUrl`, or are triggered from external apps (e.g. Bank app redirecting back to Safari).
- **Confirmation 3**: In-app browsers (Telegram, VK) aggressively isolate cookie storage across domains, further stripping `lax` cookies during OAuth/Payment redirects. This matches the exact "401 Unauthorized" bug observed when polling `/api/order-status` post-payment.
- **Pre-Mortem addition**: If `getEncodedKey()` fails (e.g. edge environment issue or missing secret), the token generation will throw an error. If unhandled, this stops the entire `checkoutAction`, breaking the core business function (taking payments) for the sake of a UX fix on the success page. 
- **Action taken**: I added a 4th risk to the Risk Matrix and modified the `implementation_plan.md` to wrap `SignJWT` in a `try-catch` block, ensuring it degrades gracefully.

## 3. Caveats
- I assumed the codebase will remain on `sameSite: 'lax'`. Changing it to `sameSite: 'none'` + `secure: true` globally could also solve some cross-site issues but would open the app to CSRF risks. The capability token (JWT) is the correct and secure approach.
- The `mass.ts` checkout action generates a `paymentId` rather than an `orderId` for the `successUrl`, which I verified the API Route properly handles.

## 4. Conclusion
The `implementation_plan.md` has been successfully audited against the 5 Vectors of Reliability. I confirmed the hypotheses behind the bug and expanded the Pre-Mortem Risk Matrix to include 4 specific failure scenarios. The plan is now resilient against both client-side tracking prevention and server-side secret configuration errors. It is ready for the Phase 3 Surgeon.

## 5. Verification Method
- Review `d:\SMM_plan_2\.agents\analyst_milestone_1\implementation_plan.md` to confirm the presence of the `try/catch` block and the 4th scenario in the Risk Matrix.
- Run `npm run lint` and `npm run typecheck` (after the Surgeon implements it) to ensure the modified `successUrl` concatenation works correctly.
