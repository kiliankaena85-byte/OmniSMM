# Handoff Report: Authentication Fix & Password Fallback

## 1. Observation
- **File:** `src/actions/auth/request-magic-link.ts` (lines 124-127). The exact error `"Что-то пошло не так. Попробуйте еще раз."` is returned from a catch-all `try/catch` block that intercepts any unhandled exception.
- **File:** `src/lib/smtp.ts` (lines 124-135). The `sendMagicLink` function conditionally throws an error if `process.env.NODE_ENV === 'production'` and SMTP fails (e.g., misconfigured keys, network errors).
- **File:** `package.json`. The `next-auth` package is not present. Instead, authentication uses `jose` for custom JWT session management.
- **File:** `prisma/schema.prisma`. The `passwordHash` field already exists on the `User` model.
- **Files:** `src/actions/auth/password-login.ts` and `src/app/(auth)/login/login-form.tsx`. Password-based authentication logic and UI tabs are **already implemented**.
- **Directory:** `src/actions/__tests__/`. There are no Vitest tests for the auth modules yet.

## 2. Logic Chain
1. **Magic Link Error Root Cause:** The prompt asks why magic link login throws "something went wrong".
   - *Confirmation 1:* The codebase has `return { error: "Что-то пошло не так. Попробуйте еще раз.", success: false };` in the global `catch` of `requestMagicLink`.
   - *Confirmation 2:* `sendMagicLink` explicitly executes `throw err;` when SMTP fails in production.
   - *Confirmation 3:* Missing environment variables (like `JWT_SECRET` in `createSession` via `DEV_BYPASS`) also throw fatal errors that would be swallowed by this block.
   - *Conclusion:* The generic error masks critical backend failures (usually SMTP outages). We need to catch specific errors (like SMTP failures) and provide actionable feedback, while keeping the generic error for unknown faults.
2. **Password Auth Fallback:** The prompt requests adding password auth, mentioning NextAuth.
   - *Confirmation 1:* NextAuth is not used; the architecture relies on `jose` JWT tokens in `src/lib/session.ts`.
   - *Confirmation 2:* `schema.prisma` already includes `passwordHash`.
   - *Confirmation 3:* `password-login.ts` provides the server action, and `login-form.tsx` has the necessary UI tabs.
   - *Conclusion:* Password fallback is structurally complete. The task shifts from "building it" to "writing tests and verifying it works."
3. **Automated Testing:** Tests are required for both mechanisms.
   - *Conclusion:* Vitest tests should be created in `src/actions/__tests__/auth.test.ts`, mocking Prisma (`db`) and `sendMagicLink`.

## 3. Caveats & 5 Reliability Vectors
- **Архитектурный стык (Server/Client Boundaries):** `login-form.tsx` safely uses React 19 `useActionState` without leaking secrets. `redirect()` is properly placed outside the `try/catch` in Server Actions to avoid catching `NEXT_REDIRECT`.
- **Хаос и пустота (Cold Start):** If the DB is empty, the first user is auto-assigned the `OWNER` role. If SMTP is unconfigured, the magic link silently fails or throws in production.
- **Visual & UX Density:** The UI utilizes `globals.css` semantic tokens (`bg-background`, `text-primary`) meeting design system rules.
- **Доступность WCAG 2.2 AA:** Touch targets for the login buttons (`py-3 px-4`) are ≥ 44px.
- **Security & Trust:** Anti-enumeration is active ("Неверный email или пароль" is returned instead of "User not found"). `RateLimitService` correctly enforces IP and email-level limits.

### Pre-Mortem (Failure Simulation)
| Scenario | Cause | Mitigation/Protection |
|----------|-------|-----------------------|
| **SMTP Outage** | Resend API key is revoked or SMTP host goes down. | Instead of masking with a generic error, the `catch` block should parse SMTP errors and alert the user: "Сервис отправки временно недоступен". |
| **Brute Force Attack** | Malicious bot attempts 1000 passwords per minute. | `RateLimitService` blocks the IP after 20 attempts/hr, and blocks the email after 5 attempts/15m. Falls back to Postgres if Redis crashes. |
| **Session Hijacking** | Attacker steals JWT cookie. | `verifySession` performs User-Agent validation tracking (OSAD-V2 fix) and strictly checks `expiresAt` against the DB. |

## 4. Conclusion
The "something went wrong" error is a generic catch-all masking backend exceptions (typically SMTP failures) in `request-magic-link.ts`. The password-based fallback (schema, backend, UI) is already fully implemented using custom JWTs (`jose`), bypassing the need for NextAuth. The remaining work is to add Vitest coverage in `src/actions/__tests__/auth.test.ts` and optionally refine the magic link error handling to display specific SMTP error messages.

## 5. Verification Method
- **Commands:** Run `npm run test` once `auth.test.ts` is implemented.
- **Files to Inspect:** `src/actions/__tests__/auth.test.ts`.
- **Manual QA:** Disconnect the network or set an invalid `Resend` API key in `.env`. Attempt a magic link login. Ensure the application logs the error or displays a clear "Service unavailable" message rather than the generic fallback.
