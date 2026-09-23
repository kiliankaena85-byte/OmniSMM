# Plan 023: Production Test Mode Env Leakage Prevention

## Status
- **Priority**: P0
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness + infrastructure

## Why this matters
During hot-patching deployment (`npx tsx scripts/fast-patch.ts --prod`), Next.js builds the app (`npm run build`) locally on the developer's machine before transferring it to production. Since the local `.env` file contains `NEXT_PUBLIC_APP_ENV=test` and `DATABASE_URL` referencing `smmplan_test`, Next.js bakes `isTestEnvironment() { return true; }` as a static constant optimization into the server and client bundles. Once hot-patched into production, the server is locked in test mode, preventing orders from going to real providers.

## Current state
- [settings.ts](file:///d:/SMM_plan_2/src/lib/settings.ts) contains `isTestEnvironment()` which checks environment variables.
- [fast-patch.ts](file:///d:/SMM_plan_2/scripts/fast-patch.ts) executes `npm run build` locally without overriding build-time environment variables.

## Smmplan default commands
| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Build | `npx tsx scripts/fast-patch.ts --prod` | runs build and outputs patch |

## Scope
**In scope**:
- `scripts/fast-patch.ts`

**Out of scope**:
- Direct changes to `.env` files.
- Full deployment configuration.

## Steps

### Step 1: Override build-time env variables in `fast-patch.ts`
Modify the `npm run build` execution in `scripts/fast-patch.ts` to explicitly set `NEXT_PUBLIC_APP_ENV` and `DATABASE_URL` (to a dummy production string) in the env context of the process. This prevents Next.js from reading developer's local test variables.

```diff
  // 3. Локальный билд Next.js
  log.info('2/6 Сборка Next.js приложения...');
  try {
-    execSync('npm run build', { stdio: 'inherit', env: { ...process.env, DISABLE_REDIS_CACHE: '1' } });
+    execSync('npm run build', { 
+      stdio: 'inherit', 
+      env: { 
+        ...process.env, 
+        DISABLE_REDIS_CACHE: '1',
+        NEXT_PUBLIC_APP_ENV: 'production',
+        DATABASE_URL: 'postgresql://db:5432/smmplan_lite?schema=public'
+      } 
+    });
    log.success('Сборка Next.js выполнена успешно.');
```

### Step 2: Validate the build configuration
Verify that running `npx tsx scripts/fast-patch.ts --prod --skip-tsc` compiles settings correctly (the compiler will generate dynamic checks instead of a static `return !0`).
