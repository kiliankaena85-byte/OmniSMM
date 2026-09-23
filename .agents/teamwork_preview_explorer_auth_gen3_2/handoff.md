# Handoff Report: Auth Fix Strategy

## 1. Observation
- `request-magic-link.ts` contained a `[SAFE BYPASS]` block (lines 29-47) checking `ALLOW_DEV_BYPASS_IN_PROD`. This block mutated the execution flow using `shouldRedirectToAdmin` and conditionally invoked Next.js `redirect()` at the end, which caused TypeScript to infer a union return type that included `void` (from implicit fallthroughs), breaking `tests/magic-link.test.ts`.
- Rate limiting in `request-magic-link.ts` branches on `user` existence: new users hit `auth:register:ip` (3/day) while existing users hit `auth:login:ip` (15/hour). If a user exhausts the registration limit, querying an unregistered email returns an error while querying a registered email proceeds, creating a perfect enumeration oracle.
- `scripts/set-admin-password.ts` successfully deletes `Session` entries but omits `AuthToken` cleanup, leaving unused magic links valid.
- `request-magic-link.ts` queries `db.user.findUnique` outside the `db.$transaction`, and `db.authToken.create` is completely separate. Concurrent requests for a new email pass the `findUnique` check simultaneously, leading to `P2002` constraint failures during `tx.user.create`.

## 2. Logic Chain
1. **Defects 1 & 2 (Build Failure + Backdoor)**: Removing the `ALLOW_DEV_BYPASS_IN_PROD` block and its associated `shouldRedirectToAdmin` flow control simplifies the return logic. The function will strictly return `{ error, success }`, inherently satisfying the TS signature expected by Vitest and sealing the backdoor.
2. **Defect 3 (Enumeration)**: To prevent enumeration, the API must return identical responses for both registered and unregistered emails under all conditions. Applying a unified IP rate limit (15/hour) across the entire endpoint, and silently returning `{ success: true, error: null }` when the strict registration limit (3/day) is hit by new users, guarantees an attacker cannot discern account existence.
3. **Defect 5 (TOCTOU / Atomicity)**: Moving the `user.findUnique`, `user.create` (if necessary), and `authToken.create` into a single `Serializable` transaction eliminates race conditions. A pre-check `findUnique` can be done before the transaction purely for rate-limit evaluation.
4. **Defect 4 (AuthToken Cleanup)**: Appending `db.authToken.deleteMany` inside the password reset script guarantees all magic link tokens are revoked when credentials are force-reset.

## 3. Caveats
- Moving `db.authToken.create` into the transaction changes the return structure of `db.$transaction`. This requires updating the Vitest mocks in `tests/magic-link.test.ts` (and `__tests__`) to return an object like `{ user, isNewUser, rawToken }` instead of just the `user` object.
- The pre-check `findUnique` occurs outside the transaction for rate limit evaluation, but the actual state mutation occurs safely inside the atomic block.

## 4. Conclusion
The five defects can be comprehensively resolved without introducing new dependencies or breaking existing business logic. The `[SAFE BYPASS]` code must be deleted, rate limits unified and obfuscated, the Prisma transaction expanded to cover token generation, and the password reset script augmented to clear `AuthToken`s.

## 5. Verification Method
- **TypeScript**: Run `npx tsc --noEmit` to ensure type signatures align.
- **Tests**: Run `npx vitest tests/magic-link.test.ts` and `npx vitest src/actions/auth/__tests__/request-magic-link.test.ts`.
- **Enumeration**: Exhaust the registration limit (3/day). Attempt a magic link request for a fake email; it should return `{ success: true }`. Attempt for a real email; it should also return `{ success: true }`.

## Implementation Plan

### File: `src/actions/auth/request-magic-link.ts`
1. Delete the `[SAFE BYPASS]` block, `shouldRedirectToAdmin`, and the trailing `redirect` block.
2. Replace existing rate limit checks with a unified check:
   ```typescript
   const isIpAllowed = await RateLimitService.check('auth:magic-link:ip', 15, 3600);
   if (!isIpAllowed) return { error: "Слишком много запросов. Пожалуйста, подождите 1 час.", success: false };
   ```
3. Perform a pre-check `findUnique` on the user. If not found, check the `auth:register:ip` limit (3/day). If exceeded, `return { success: true, error: null };` silently.
4. Wrap user lookup, user creation, and `authToken` creation inside a single `db.$transaction(..., { isolationLevel: 'Serializable' })`. Have the transaction return `{ user, isNewUser, rawToken }` and then dispatch SMTP.

### File: `tests/magic-link.test.ts` & `src/actions/auth/__tests__/request-magic-link.test.ts`
1. Update `vi.mocked(db.$transaction).mockImplementation(...)` to return `{ user: mockUser, isNewUser: true, rawToken: 'token' }` instead of just `mockUser`.

### File: `scripts/set-admin-password.ts`
1. Add `await prisma.authToken.deleteMany({ where: { userId: user.id } });` directly below the session deletion logic.
