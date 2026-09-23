# Handoff Report: Password Auth Fallback Investigation

## 1. Observation
- **UI Component**: Investigated `src/app/(auth)/login/login-form.tsx`. It already contains a tabbed interface separating Magic Link and Password login. The password submission is handled via `useTransition` and calls the `loginWithPasswordAction`.
- **Backend Action**: Investigated `src/actions/auth/password-login.ts`. It exports `loginWithPasswordAction`, which validates input using `zod`, checks rate limits via `RateLimitService`, queries the user, and validates the password using `verifyPassword` from `src/lib/auth/password.ts`.
- **Session Architecture**: Investigated `src/lib/session.ts`. The existing custom JWT session logic provides a `createSession(userId: string)` function. It creates a `Session` record in Prisma (tracking `userAgent` and `ipAddress`) and sets an encrypted HTTP-only `session_token` JWT cookie.

## 2. Logic Chain
- **UI Updates (Question 1)**: The `login-form.tsx` is the primary file for the UI. The form toggles between `password` and `magic` modes. The password form collects `email` and `password`, appending them to a `FormData` payload, and invokes the backend action.
- **Backend Action Implementation (Question 2)**: The implementation pattern in `src/actions/auth/password-login.ts` is exactly what's required. It must:
  1. Parse input with `zod`.
  2. Implement anti-brute-force rate limiting (IP & Email based).
  3. Look up the user by email (`cleanEmail`).
  4. Compare the provided password against `user.passwordHash` using the `verifyPassword` utility.
  5. If valid, trigger session creation.
- **JWT Session Creation (Question 3)**: Creating the session consistently requires calling the existing `createSession(user.id)` from `src/lib/session.ts`. This encapsulates all requirements: it creates the Prisma `Session` row for invalidation, signs a `jose` JWT with the `sessionId`, and correctly sets the secure `session_token` cookie using Next.js `await cookies()`.

## 3. Caveats
- The codebase already contains a nearly complete implementation of the requested feature. The requested "implementation plan" effectively describes the current state of these files.
- The Rate Limiting mechanism (`RateLimitService`) depends on Redis. If Redis is unavailable, login attempts might fail unless the rate-limiter has a fallback.
- No modifications were made during this investigation as per the read-only constraint.

## 4. Conclusion
The implementation strategy for Milestone 2 (Password Auth fallback) is to utilize the exact architecture currently found in the files:
1. `src/app/(auth)/login/login-form.tsx` handles the UI and posts `FormData`.
2. `src/actions/auth/password-login.ts` validates the credentials and calls `verifyPassword`.
3. `src/lib/session.ts`'s `createSession()` creates the DB session and sets the JWT cookie.
No structural changes are needed to the existing layout; if further work is required, it should be limited to fixing bugs, writing tests, or polishing the UI in these specific files.

## 5. Verification Method
- **Type Checking**: Run `npx tsc --noEmit` to ensure no type errors in the auth flow.
- **Manual QA**: 
  1. Generate an admin password via `npx tsx scripts/set-admin-password.ts <email> <password>`.
  2. Start the local server `npm run dev`.
  3. Navigate to `http://localhost:3000/login`, select the password tab, and log in.
  4. Verify the `session_token` cookie is created and redirection to `/dashboard` or `/admin/dashboard` is successful.
- **Testing**: Run the project's test command (e.g., `npm run test` or `npx vitest`) to verify auth-related unit tests pass.
