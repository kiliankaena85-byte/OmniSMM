# Handoff Report: Authentication Fix & Password Fallback

## 1. Observation
- The `requestMagicLink` action in `src/actions/auth/request-magic-link.ts` catches any thrown errors and returns a generic `{ error: "Что-то пошло не так. Попробуйте еще раз." }` to the client.
- The `crypto` module is imported using `import crypto from "crypto";` in `request-magic-link.ts`, `route.ts`, and `password.ts`. In Next.js 15/16 with Turbopack, this often resolves incorrectly, causing `crypto.randomBytes` or `crypto.createHash` to be undefined, throwing `TypeError: crypto.randomBytes is not a function`.
- The password-based fallback authentication is **already partially or fully implemented** in the codebase:
  - `passwordHash` exists in `prisma/schema.prisma` (`User` model).
  - `loginWithPasswordAction` exists in `src/actions/auth/password-login.ts`.
  - The UI for password login exists in `src/app/(auth)/login/login-form.tsx` (using tabs).
- No automated tests for auth exist in `test/`.

## 2. Logic Chain
1. **Magic Link Error**: When a user requests a magic link, the server action hits `crypto.randomBytes(32)` or `await sendMagicLink(...)`. If `crypto` fails due to incorrect import semantics (`"crypto"` vs `"node:crypto"`), or if `sendMagicLink` throws an error due to SMTP timeout, the exception is caught and masked by the generic "Что-то пошло не так" message.
2. **Password Auth Existence**: Since the password logic and UI are already present, the task to "Investigate how to add password-based fallback authentication" transitions to "Verify existing password logic and ensure it works without SMTP".
3. **Automated Testing**: Since no tests exist, we must add Vitest suites mocking Prisma (`db`) and SMTP (`sendMail`) to guarantee magic link and password fallback functionality.

## 3. Caveats
- I could not reproduce the exact runtime error in the Next.js dev server due to execution timeouts, but `node:crypto` import issues and unhandled SMTP timeouts are the only logical failure points within the `try` block.
- The password fallback code is already present, which may mean the user provided an outdated prompt or I am investigating a branch where it was already pushed but needs testing.

## 4. Conclusion & Fix Strategy
1. **Fix Magic Link Error**: 
   - Change `import crypto from "crypto";` to `import crypto from "node:crypto";` in `src/actions/auth/request-magic-link.ts` and other auth files.
   - Modify the `catch` block in `requestMagicLink` to log the actual error stack trace for easier future debugging.
2. **Verify Password Fallback**: The code is already implemented. Verify `loginWithPasswordAction` correctly bypasses SMTP dependency (which it currently does, as it directly creates a session).
3. **Add Vitest Tests**: Create `test/unit/auth/magic-link.test.ts` and `test/unit/auth/password.test.ts`. Mock `db.user`, `db.authToken`, and `sendMagicLink` to ensure tests run isolated and pass.

### 🔴 5 Reliability Vectors Analysis
1. **Server/Client Boundary**: Auth actions are strictly `"use server"`. UI component uses `useActionState`. (Compliant).
2. **Chaos & Emptiness (Cold Start)**: `request-magic-link.ts` safely auto-bootstraps the first user as "OWNER" if the DB is empty. (Compliant).
3. **Visual & UX Density**: `login-form.tsx` uses 2-tab approach without visual clutter. (Compliant).
4. **Accessibility (WCAG)**: Inputs have `aria-label`, buttons have proper focus states. (Compliant).
5. **Security & Trust**: IP and Email rate limiting (Redis/Postgres) prevent brute-force. Passwords hashed using `scrypt` with salt. (Compliant).

### 🛡️ Pre-Mortem (Failure Simulation)
| Risk (Failure Scenario) | Mitigation Strategy |
| :--- | :--- |
| **SMTP Timeout blocking login:** If SMTP server hangs, `requestMagicLink` will block the UI and eventually timeout, throwing "Что-то пошло не так". | Implement a timeout inside `sendMagicLink` or offload email sending to a background worker queue (BullMQ) if synchronous confirmation isn't strictly required. |
| **Password brute-force:** Attackers bypass magic link and brute-force the password tab. | `RateLimitService` enforces a strict 5-attempt/15-min limit per email, and 20-attempt/hour per IP in `password-login.ts`. |
| **Legacy users lacking passwordHash:** Users attempt to use password login but never set one. | Code correctly handles `!user.passwordHash` by returning an explicit prompt: "Для вашего аккаунта не установлен пароль. Пожалуйста, войдите по ссылке на почту." |

## 5. Verification Method
1. Apply the `node:crypto` import changes.
2. Run `npm run lint` and `npx tsc --noEmit` to ensure TypeScript strictness.
3. Write the Vitest tests in `test/unit/auth/` and execute them via `npm run test` or `vitest run`.
4. Tests must programmatically prove that `loginWithPasswordAction` succeeds even if `sendMagicLink` is mocked to throw an error, confirming independence from SMTP.
