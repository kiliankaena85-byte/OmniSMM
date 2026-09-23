# Handoff Report: Authentication Fix & Password Fallback

## 1. Observation
- **Magic Link Error**: In `src/actions/auth/request-magic-link.ts` (lines 117-127), the `sendMagicLink` function throws an error when SMTP is misconfigured or down. The `catch` block suppresses the underlying error and returns a generic `"Что-то пошло не так. Попробуйте еще раз."`
- **Password Fallback Exists**: The `User` model in `prisma/schema.prisma` already includes `passwordHash String?` (line 13). The backend action `loginWithPasswordAction` (`src/actions/auth/password-login.ts`) and the UI form (`src/app/(auth)/login/login-form.tsx`) **already implement password login**. 
- **The Deadlock (Cold Start)**: In `request-magic-link.ts`, a new user is inserted into the DB *before* the magic link is sent. If SMTP fails, the `OWNER` account is created without a password. When trying to use the password fallback tab, `password-login.ts` (line 59) blocks the attempt: `"Для вашего аккаунта не установлен пароль. Пожалуйста, войдите по ссылке на почту."` Since SMTP is down, the admin is permanently locked out.
- **NextAuth**: The project **does not use NextAuth**. It uses a custom JWT session implementation (`src/lib/session.ts` and `src/app/api/auth/verify/route.ts`).
- **Tests**: There are no tests for auth actions. `src/actions/auth/` has no `__tests__` directory, but the Vitest configuration (`vitest.config.ts`) is set up to mock `nodemailer` and `resend`.

## 2. Logic Chain
1. The user reported a "something went wrong" error. This is traced directly to the catch block in `request-magic-link.ts` failing due to SMTP unavailability.
2. The user requested password fallback. Since `password-login.ts` and the UI are already built, the true missing piece is overcoming the **SMTP-Down Deadlock** where the `OWNER` cannot set their initial password.
3. Because NextAuth is not present, any attempt to configure NextAuth will conflict with the existing custom Session architecture.
4. To fully resolve the requirement, we must add a mechanism (like a CLI setup script or a fallback UI state) to set the initial password when SMTP is dead, and write Vitest tests for both actions.

## 3. Caveats
- I did not modify code as per strict instructions.
- The project's `ALLOW_DEV_BYPASS_IN_PROD` environment variable allows bypassing auth, but relying on it is insecure. A dedicated password setup mechanism is required.
- The implementation plan assumes a CLI script (`scripts/set-admin-password.ts`) is the safest way to resolve the Cold Start Deadlock without exposing an open registration form to the internet.

## 4. Conclusion & Implementation Plan
**Fix Strategy**:
1. **Magic Link Fix**: Update `request-magic-link.ts` to log the exact SMTP error via `log.error` instead of silently swallowing it, and optionally delete the newly created user if `sendMagicLink` fails so they aren't stuck in a password-less zombie state.
2. **Password Fallback (Deadlock Resolution)**: Create a secure CLI script `npx tsx scripts/set-admin-password.ts <email> <password>` that uses `hashPassword` from `src/lib/auth/password.ts` to directly set the `passwordHash` in the database.
3. **Automated Testing**: Create `src/actions/auth/__tests__/password-login.test.ts` and `src/actions/auth/__tests__/request-magic-link.test.ts`. Use Vitest to mock `RateLimitService` and verify both successful logins and the expected rejections.

**5 Reliability Vectors Analysis**:
- *Архитектурный стык*: Server Actions (`useActionState`) securely handle auth without exposing secrets to the client.
- *Хаос и пустота*: The SMTP-Down Deadlock is the exact "void" scenario, mitigated by the proposed CLI script.
- *Visual & UX Density*: `login-form.tsx` uses tabs to avoid visual clutter.
- *Доступность WCAG 2.2 AA*: Inputs have proper `aria-label` tags.
- *Security & Trust*: Password logic uses `scrypt`, timing-safe equality, and strict IP/Email rate limiting.

**Pre-Mortem (Failure Simulation)**:
1. *Risk*: Attacker brute-forces password. *Defense*: RateLimitService already limits to 5 attempts per 15 minutes.
2. *Risk*: Attacker enumerates emails. *Defense*: `password-login.ts` returns a generic "Неверный email или пароль".
3. *Risk*: Magic link replay attack. *Defense*: `verify/route.ts` uses an atomic `updateMany` to prevent race conditions.

## 5. Verification Method
- **Test Command**: `npm run test` (or `npx vitest run src/actions/auth/__tests__`)
- **Inspection**: 
  1. Run `npx tsx scripts/set-admin-password.ts admin@smmplan.pro 12345678` locally.
  2. Attempt to log in via the UI using the password tab.
  3. Verify successful redirect to `/admin/dashboard` without relying on SMTP.
