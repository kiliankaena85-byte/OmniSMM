# Handoff Report: Iteration 4 Auth Fixes

## Observation
1. **Defect 1 (TS build broken):** Running `npx tsc --noEmit` fails on `scripts/check-db.ts:42:39` and `scripts/sanitize-db-prod.ts:50:40` with `error TS2349: This expression is not callable`. The error occurs because TypeScript infers the `tablesToCheck` and `tablesToEmpty` arrays' `model` property as a massive union of 26 disjoint Prisma model delegates. As a result, TS cannot reconcile the `.count()` and `.deleteMany()` method signatures.
2. **Defect 2 (Email enumeration):** In `src/actions/auth/request-magic-link.ts` (lines 77-80), if a user is blocked or deleted, the script returns `{ error: "Неверный email или пароль", success: false }`. Since normal or unregistered users return `{ success: true, error: null }`, this disparate response allows attackers to enumerate which email addresses belong to blocked accounts.
3. **Defect 3 (Un-invalidated old AuthTokens):** In `src/actions/auth/request-magic-link.ts` (lines 66-72), the script creates a new `AuthToken` inside `db.$transaction`, but it does not delete or invalidate any previously existing tokens for that `userId`. 
4. **Defect 4 (Partial state updates & orphaned connections):** In `scripts/set-admin-password.ts`, the database operations (`user.update`, `session.deleteMany`, `authToken.deleteMany` on lines 45-51) are executed sequentially rather than within a single atomic transaction. Additionally, the script uses `process.exit(1)` (lines 26, 36, 56) which immediately halts the Node.js process, preventing the `finally` block (`await prisma.$disconnect()`) from running, leading to orphaned database connections.

## Logic Chain
1. **Fixing TS build breaks:** We must explicitly type the model arrays in both scripts to avoid TypeScript union inference issues. Changing the declarations to `const tablesToCheck: { name: string, model: any }[] = [...]` and `const tablesToEmpty: { name: string, model: any }[] = [...]` will resolve the type incompatibility for the dynamic `.count()` and `.deleteMany()` calls.
2. **Fixing Email Enumeration:** To prevent attackers from differentiating blocked users from normal users, the early return for blocked accounts in `request-magic-link.ts` must return `{ success: true, error: null }`. This masks the blocked status from the frontend while retaining the internal `log.warn`.
3. **Fixing Old AuthTokens:** To properly invalidate old tokens, we must insert `await tx.authToken.deleteMany({ where: { userId: user.id } });` just before `tx.authToken.create` within the existing transaction block in `request-magic-link.ts`.
4. **Fixing set-admin-password.ts:** To ensure atomicity, the three Prisma queries must be wrapped inside `await prisma.$transaction(async (tx) => { ... })`. To prevent orphaned connections, all instances of `process.exit(1)` must be replaced with `process.exitCode = 1; return;` to allow the script to exit gracefully and execute the `finally` block.

## Caveats
- Bypassing strict typing with `any` for the Prisma models in the scripting arrays is considered an acceptable and standard practice since defining a strictly typed union that satisfies all 26 distinct generic Prisma delegate signatures is practically impossible and provides no runtime benefit for these specific sanitization scripts.
- No other files require modification to address these 4 specific defects.

## Conclusion
The root causes of the 4 Iteration 3 defects have been isolated. A direct implementation plan has been established to safely cast the TypeScript arrays in the utility scripts, standardize the magic-link response for blocked users, invalidate old tokens inside the magic link transaction, and refactor the admin password script to use transactions and graceful exits.

## Verification Method
After the implementer makes the changes:
1. Run `npx tsc --noEmit` and verify it succeeds without `TS2349` errors in `scripts/check-db.ts` and `scripts/sanitize-db-prod.ts`.
2. Inspect `src/actions/auth/request-magic-link.ts` to verify `{ success: true, error: null }` is returned when a blocked account attempts to request a link.
3. Inspect `src/actions/auth/request-magic-link.ts` to confirm `tx.authToken.deleteMany` is called prior to `tx.authToken.create`.
4. Inspect `scripts/set-admin-password.ts` to ensure `prisma.$transaction` is used and `process.exitCode = 1; return;` is used instead of `process.exit(1)`.
