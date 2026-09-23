# Progress Report

Last visited: 2026-06-07T14:48:50+03:00

## Completed
1. Rewrote `src/actions/auth/request-magic-link.ts`
   - Removed dev backdoor and `redirect` navigation.
   - Unified rate limit to `auth:magic-link:ip` (15/hr) at the top.
   - Used serializable transaction to safely handle `findUnique`, `user.create` and `authToken.create`, preventing concurrent creation anomalies.
   - For `auth:register:ip` limits, it silently returns success instead of throwing error.
2. Updated tests `tests/magic-link.test.ts` to mock the correct `RateLimitService` methods and `db.$transaction` shape.
3. Updated `scripts/set-admin-password.ts` to clear `authToken` tokens of the user when their password is changed.

## Next Steps
- Verify everything works (the terminal currently runs `npm run test` successfully).
- Handover via `handoff.md` and exit.
