# Auth Iteration 3 Defects Analysis

## 1. Observation
- **Defect 1**: Running `npx tsc --noEmit` returns `error TS2349: This expression is not callable` in `scripts/check-db.ts` at line 42 (`await table.model.count()`) and `scripts/sanitize-db-prod.ts` at line 50 (`await table.model.deleteMany({})`).
- **Defect 2**: In `src/actions/auth/request-magic-link.ts`, lines 77-80 return `{ error: "Неверный email или пароль", success: false }` for blocked/deleted users. For a valid user, it returns `{ success: true, error: null }`.
- **Defect 3**: In `src/actions/auth/request-magic-link.ts`, lines 66-72 create a new `AuthToken` within the transaction, but there is no call to delete prior tokens for the user.
- **Defect 4**: In `scripts/set-admin-password.ts`, lines 45-51 execute an `update` and two `deleteMany` operations sequentially without a transaction. Additionally, errors and validation failures trigger `process.exit(1)` at lines 26, 36, and 56, which bypasses the `finally { await prisma.$disconnect(); }` block.

## 2. Logic Chain
- **Defect 1**: The arrays `tablesToCheck` and `tablesToEmpty` contain objects with `model` properties mapped to different Prisma delegates. TypeScript infers a union type for `model` across all tables, but the generic arguments of `count()` and `deleteMany()` do not strictly overlap across all delegates. Thus, TS prevents calling them. Casting the model to `any` at the point of invocation overrides this strict constraint.
- **Defect 2**: The distinct response `{ error: "...", success: false }` exposes whether a given email belongs to a blocked account versus a normal/non-existent account. To prevent enumeration, the endpoint should silently swallow the request and mimic a successful response (`{ success: true, error: null }`).
- **Defect 3**: Issuing a new magic link without invalidating old ones means that previous, unexpired tokens remain fully usable. To ensure that only the most recently requested token is valid, old tokens belonging to `user.id` must be explicitly deleted before the new one is created.
- **Defect 4**: The sequential DB operations are susceptible to partial failures (e.g., if token deletion fails after the password updates). A `prisma.$transaction` guarantees atomicity. Furthermore, `process.exit(1)` abruptly halts the Node.js process, preventing the graceful execution of the `finally` block and leading to orphaned Prisma database connections. Using `process.exitCode = 1; return;` allows the function to complete and run the disconnection logic.

## 3. Caveats
- For Defect 1, casting to `any` disables type-safety for `count()` and `deleteMany()` at those specific lines, but given the dynamic nature of these admin scripts, it is the standard and safest workaround.
- For Defect 4, `process.exitCode = 1; return;` inside `main()` works correctly since `main()` is the entry point, though it relies on Node.js naturally exiting after the event loop drains.

## 4. Conclusion
The four defects require the following specific adjustments:
- **scripts/check-db.ts**: Modify `await table.model.count()` to `await (table.model as any).count()`.
- **scripts/sanitize-db-prod.ts**: Modify `await table.model.deleteMany({})` to `await (table.model as any).deleteMany({})`.
- **src/actions/auth/request-magic-link.ts**: 
  1. Change the blocked return statement to `return { success: true, error: null };`.
  2. Inside the transaction, add `await tx.authToken.deleteMany({ where: { userId: user.id } });` before `await tx.authToken.create(...)`.
- **scripts/set-admin-password.ts**:
  1. Replace all instances of `process.exit(1)` with `process.exitCode = 1; return;`.
  2. Combine lines 45-51 into:
     ```typescript
     await prisma.$transaction([
       prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
       prisma.session.deleteMany({ where: { userId: user.id } }),
       prisma.authToken.deleteMany({ where: { userId: user.id } })
     ]);
     ```

## 5. Verification Method
1. **TS Build**: Run `npx tsc --noEmit` and verify that the `TS2349` errors in `check-db.ts` and `sanitize-db-prod.ts` are resolved.
2. **Implementation**: Manually inspect `request-magic-link.ts` and `set-admin-password.ts` to ensure the logic was changed exactly as prescribed.
3. **Execution**: Run `npx tsx scripts/set-admin-password.ts` without arguments to verify that it prints the usage and exits gracefully without hanging the terminal.
