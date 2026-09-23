# Handoff Report: Authentication and DB Scripts Fix Strategy

## Observation

1. **Defect 1**: Running `npx tsc --noEmit` produces errors in `scripts/check-db.ts` (line 42) and `scripts/sanitize-db-prod.ts` (line 50): `This expression is not callable. Each member of the union type ... has signatures, but none of those signatures are compatible with each other.` This happens because the array `tablesToCheck` infers a union of all Prisma model delegates, making generic methods like `count` and `deleteMany` incompatible across the union.
2. **Defect 2**: In `src/actions/auth/request-magic-link.ts` (lines 77-80), if `txResult.type === 'blocked'`, the code returns `{ error: "Неверный email или пароль", success: false }`. This differs from the `{ success: true }` returned for valid or newly created accounts, which allows an attacker to enumerate blocked accounts.
3. **Defect 3**: In `src/actions/auth/request-magic-link.ts` (lines 66-72), `tx.authToken.create` is called to create a new token, but old unused tokens for the same user are not invalidated or deleted.
4. **Defect 4**: In `scripts/set-admin-password.ts`, `prisma.user.update`, `prisma.session.deleteMany`, and `prisma.authToken.deleteMany` are called sequentially (lines 45-51) instead of within a transaction. Furthermore, the script uses `process.exit(1)` (lines 26, 36, 56), which instantly terminates the Node.js process and prevents the `finally { await prisma.$disconnect(); }` block from executing, leaving orphaned database connections.

## Logic Chain

1. **Defect 1**: TypeScript cannot safely invoke a method on a union of types whose signatures vary by generic parameters. Explicitly typing `tablesToCheck` as `Array<{ name: string; model: any }>` bypasses this strict typing and allows `count()` and `deleteMany()` to compile, which is acceptable and safe for these specific sanitization scripts.
2. **Defect 2**: To prevent enumeration, the server must provide an identical response to the client regardless of whether the account is active, blocked, or non-existent. Changing the blocked response to `{ success: true, error: null }` achieves this parity.
3. **Defect 3**: Magic links should ideally override previous unexpired links to prevent clutter and reduce attack surface. Deleting existing tokens for the user before creating a new one enforces this constraint and cleans up the database efficiently within the existing transaction.
4. **Defect 4**: Grouping the password update and token/session invalidation inside a `$transaction` ensures atomic state changes. Replacing `process.exit(1)` with `process.exitCode = 1; return;` allows the function to exit gracefully, triggering the `finally` block to safely disconnect Prisma.

## Caveats

*   Using `any` for Prisma model delegates in the scripts bypasses type safety, but given these are simple iteration loops over known DB methods (`count` and `deleteMany`), this is a pragmatic fix.
*   We are mimicking success for blocked accounts, meaning users will see a success message but will not actually receive an email. This is intentional for security but could be confusing for legitimately blocked users.

## Conclusion

**Implementation Plan:**
1. **Fix Defect 1**: Update `const tablesToCheck = [` to `const tablesToCheck: Array<{ name: string; model: any }> = [` in both `scripts/check-db.ts` and `scripts/sanitize-db-prod.ts`.
2. **Fix Defect 2**: Modify `src/actions/auth/request-magic-link.ts` to return `{ success: true, error: null }` when `txResult.type === 'blocked'`.
3. **Fix Defect 3**: In `src/actions/auth/request-magic-link.ts`, add `await tx.authToken.deleteMany({ where: { userId: user.id } });` directly before `await tx.authToken.create(...)`.
4. **Fix Defect 4**: In `scripts/set-admin-password.ts`, wrap the state updates in `await prisma.$transaction(async (tx) => { ... })` and replace all instances of `process.exit(1)` with `process.exitCode = 1; return;`.

## Verification Method

1. Run the project test command `npx tsc --noEmit` and verify that `scripts/check-db.ts` and `scripts/sanitize-db-prod.ts` no longer produce errors.
2. Inspect `src/actions/auth/request-magic-link.ts` to ensure the blocked response matches the success response and that old tokens are deleted inside the transaction.
3. Inspect `scripts/set-admin-password.ts` to verify `process.exit` calls have been replaced and `prisma.$transaction` is used for the database updates.
