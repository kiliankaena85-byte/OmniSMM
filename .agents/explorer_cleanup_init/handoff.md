# Codebase Cleanup Investigation Report

## 1. Observation

Direct observations from running codebase audit tools, linting, tests, and database queries.

### 1.1 ESLint Warnings & Ignored Rules
ESLint command executed: `npm run lint` (runs `eslint .` using `eslint.config.mjs` config).
Result: **Failed (exit code 1)** with **3109 problems (24 errors, 3085 warnings)**.

*   **Ignored paths in `eslint.config.mjs`**:
    ```javascript
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "out/**",
      "build/**",
      "scripts/**",
      "scratch/**",
      ".agents/**"
    ]
    ```
*   **Active custom warning rules**:
    *   `"@typescript-eslint/no-unused-vars": "warn"`
    *   `"@typescript-eslint/no-explicit-any": "warn"`
    *   `"no-unused-vars": "warn"`
    *   `"no-undef": "warn"`
*   **Sample of standard warnings** (from task log):
    *   `D:\SMM_plan_2\vitest.config.ts:22:25 - warning: '__dirname' is not defined (no-undef)`
    *   `D:\SMM_plan_2\test\unit\smart-analyzer.test.ts:10:1 - warning: 'vi' is not defined (no-undef)`
    *   `D:\SMM_plan_2\test\unit\user-roles.test.ts:55:26 - warning: 'FormData' is not defined (no-undef)`
    *   `D:\SMM_plan_2\verify-providers-catalog.ts:8:9 - warning: 'console' is not defined (no-undef)`

### 1.2 Knip Unused Code Audit
Knip command executed: `npm run lint:debt` (runs `npx knip`).
Result: **Failed (exit code 1)**.

*   **Unused dependencies**: `@heroui/theme`
*   **Unlisted dependencies**:
    *   `dotenv` (imported in `playwright.config.ts`, `scripts/marketing-rewrite.ts`, `src/bot/index.ts`)
    *   `dotenv/config` (imported in `scripts/ai-cherry-pick.ts`)
    *   `node-fetch` (imported in `scripts/pen-test.ts`)
    *   `decimal.js` (imported in `src/bot/bot.test.ts`)
*   **Unresolved imports**:
    *   `../src/app/api/workers/sync-catalog/route` inside `scripts/qa-simulator-p2.ts` (line 161)
*   **Unused exports** (46 items total, key items quoted):
    *   `deleteContent` (`src/actions/admin/content.ts:159:23`)
    *   `deleteProvider` (`src/actions/admin/providers/crud.ts:146:23`)
    *   `getAllArticlesAdmin` (`src/actions/knowledge.ts:230:23`)
    *   `getArticleById` (`src/actions/knowledge.ts:249:23`)
    *   `parseMassOrderText` (`src/actions/order/mass.ts:23:14`)
    *   `sendLiveChatMessage` (`src/actions/support/ticket.ts:42:23`)
    *   `CreateServiceModal`, `EditServiceModal` (`src/components/admin/catalog-table-v2.tsx`)
    *   `badgeVariants` (`src/components/ui/badge.tsx:33:17`)
    *   `requireOwnerPermission` (`src/lib/server/rbac.ts:76:23`)
    *   `runInProgressTTLSweep` (`src/workers/processors/cleanup.processor.ts:300:23`)
    *   `checkAndCompleteCampaign` (`src/workers/processors/dripfeed.processor.ts:8:23`)
*   **Unused exported types**:
    *   `DisputePackOrderDTO` (`src/actions/admin/finance/payments.ts:126:13`)

### 1.3 Legacy CommonJS Scans
Scanning using grep search for `require(` patterns.
*   **Legacy JS Files using require()**:
    *   `scripts/safe-replace.js` (uses CommonJS `const fs = require('fs'); const path = require('path');`)
*   **TS Scripts using require()**:
    *   `scripts/qa-simulator-p2.ts` uses dynamic require to dynamically load API handlers and actions (e.g. `const { POST } = require('../src/app/api/webhooks/crypto/route');` on line 40, `const { checkoutCore } = require('../src/actions/order/checkout');` on line 107).
*   **ESM JS files** (using standard `import`):
    *   `scripts/visual-qa.js`
    *   `test/load/api-api.js`

### 1.4 Test Run & Potential Network Leaks
Test command executed: `npm run test` (runs `dotenv -e .env.test -- vitest run`).
Result: **Failed (exit code 1)**: **1 failed file, 78 passed, 2 skipped (81 total). 5 tests failed.**

*   **Failing Test Suite**: `src/utils/balance-verifier.test.ts`
*   **Verbatim Errors**:
    ```
    FAIL  src/utils/balance-verifier.test.ts > BalanceVerifier Service Tests > should successfully reconcile a user with a perfectly matching balance and ledger entries
    AssertionError: expected 3 to be 1 // Object.is equality
    - Expected: 1
    + Received: 3
    
    FAIL  src/utils/balance-verifier.test.ts > BalanceVerifier Service Tests > should completely ignore inactive or deleted users
    AssertionError: expected 2 to be +0 // Object.is equality
    - Expected: 0
    + Received: 2
    ```
*   **Network Isolation Observations (`test/setup.ts`)**:
    *   `nodemailer` is globally mocked with `createTransport` returning a stub.
    *   `resend` is globally mocked returning a class stub.
    *   `ioredis` is globally mocked returning `MockRedis` working in-memory.
    *   `bullmq` is globally mocked returning `MockQueue` and `MockWorker`.
    *   `fetch` is globally stubbed using `vi.stubGlobal('fetch', vi.fn())` in `beforeAll`.
    *   **Conclusion**: There are **no network leaks** to third-party services (YooKassa, CryptoBot, SMTP providers) during test runs.

### 1.5 Database State & Sanitization Inspection
Database inspection executed via Prisma client:
*   **Table Row Counts**:
    *   `User`: 5
    *   `Order`: 14
    *   `Payment`: 12
    *   `Ticket`: 2
    *   `TicketMessage`: 2
    *   `LedgerEntry`: 4
    *   `SystemSettings`: 1
    *   `Provider`: 9
    *   `Service`: 1358
    *   `Category`: 255
    *   `Network`: 38
    *   `PromoCode`: 0
*   **Global SystemSettings verified**:
    *   `isTestMode`: `true`
    *   `siteName`: `"Smmplan Lite"`
    *   `exchangeRateUSD`: `90`
    *   `smtpHost`: `"smtp.yandex.ru"`
    *   `smtpPort`: `465`
    *   `smtpUser`: `"infosokoloff@yandex.ru"`
    *   `smtpPassword` (length): 98
    *   `yookassaTestShopId`: `"1155075"`
    *   `yookassaShopId`, `yookassaSecretKey`, `robokassaLogin`, `robokassaPassword` are all `null`.
*   **Providers**: 9 total, including `E2E Test Provider` pointing to `http://localhost:3001/api/dev/mock-provider` and live api URLs (Vexboost, Likedrom, Soc-Rocket, Smmprime, Stream-Promotion, Smmpanelus, Soc-Proof, Telegram.Shop).

---

## 2. Logic Chain

1.  **ESLint globals configuration missing**:
    *   Standard symbols like `console`, `__dirname`, `vi`, `FormData`, and `HTMLInputElement` are flagged with `no-undef`.
    *   ESLint uses the new flat config format `eslint.config.mjs` (Observation 1.1) but lacks the imports or settings defining environments like `node`, `browser`, or `vitest` (such as importing the `globals` package and extending `languageOptions.globals`).
    *   Therefore, standard JS/TS globals are flagged as undefined, inflating the lint warning count to over 3000.

2.  **Unused dependency list is small but real**:
    *   Knip identified `@heroui/theme` as unused in `package.json`.
    *   Several script tools use dependencies (`dotenv`, `node-fetch`, `decimal.js`) that are present in `devDependencies` but not listed as direct dependencies, or vice versa (Observation 1.2).
    *   46 unused code exports exist, reflecting dead code paths that can be safely deleted or un-exported.

3.  **Dynamic require is used intentionally in TS script to avoid compile cycles**:
    *   `scripts/qa-simulator-p2.ts` is running as a standalone node utility using TSX. It uses dynamic `require()` (Observation 1.3) to import Next.js route handlers (`src/app/api/webhooks/crypto/route.ts` etc.). This is likely to prevent Next.js server-side framework components from trying to compile or run compile-time checks on script entrypoints.
    *   `scripts/safe-replace.js` is a legacy Javascript file using node `require()`.

4.  **Test database state leakage causes Vitest failure**:
    *   In `test/setup.ts`, `shouldReset` is skipped for unit tests (defined by `testPath` having `unit/` unless specifically allowed in a whitelist, and also matching `skipPatterns` like `utils` and `balance-verifier`) (Observation 1.4).
    *   This database reset skip leaves leftover rows created by earlier integration tests (such as `e2e-tester@test.com`) inside the test database.
    *   `src/utils/balance-verifier.test.ts` only deletes users whose emails end with `@example.com` in its own `beforeEach` hook.
    *   Therefore, when `BalanceVerifier.verifyAllBalances()` executes, it queries all active users in the database, including the leftover users from other tests.
    *   This increases the results array length (e.g. returning 3 instead of 1, and 2 instead of 0) (Observation 1.4), causing all assertions based on array length to fail.

5.  **Database contains test/garbage data**:
    *   We observed row counts of `User: 5`, `Order: 14`, `Payment: 12`, `Ticket: 2`, `TicketMessage: 2`, `LedgerEntry: 4` in the local PostgreSQL DB (Observation 1.5). These tables represent transaction logs and user accounts that contain temporary test data.
    *   `SystemSettings` is configured for local development test mode (`isTestMode: true`), with SMTP pointing to Yandex and YooKassa utilizing the test shop ID.

---

## 3. Caveats

*   **ESLint Warnings Volume**: The massive number of warnings (3085) means that individual TypeScript bugs might be masked. We only examined a representative subset of warnings, but the underlying reason (globals setup) is highly uniform.
*   **Dynamic Require Alternatives**: Rewriting `scripts/qa-simulator-p2.ts` to ESM standard dynamic `import()` requires testing under the `tsx` launcher to ensure it resolves App Router dependencies correctly.
*   **Test Database reset impact**: Enforcing DB truncation for all unit tests will resolve the state leakage but might increase the duration of unit test execution (which currently is already very long, taking ~43 minutes on Windows).

---

## 4. Conclusion

1.  **Linting Action**: ESLint flat config `eslint.config.mjs` should be updated to import `globals` from `"globals"` and configure `languageOptions: { globals: { ...globals.node, ...globals.browser, ...globals.serviceworker } }` to eliminate `no-undef` warnings for standard environment variables and symbols.
2.  **Dead Code Action**: Unused exports (46 items identified by Knip) should be un-exported or removed. Unused `@heroui/theme` can be cleaned from `package.json`.
3.  **Legacy Scripts**: `scripts/safe-replace.js` should be rewritten as a TypeScript ES Module (`safe-replace.ts`), and the dynamic `require` statements in `scripts/qa-simulator-p2.ts` should be replaced with ES dynamic `import()`.
4.  **Vitest Fix**: To resolve the `balance-verifier.test.ts` failures, its local `beforeEach` hook should be updated to execute an absolute table truncation of `User`, `LedgerEntry`, and `AdminAuditLog` instead of selectively deleting `@example.com` emails. This isolates the test without depending on the global `test/setup.ts` database reset strategy.
5.  **DB Sanitization**: A seed/cleanup script is recommended to wipe `User`, `Order`, `Payment`, `Ticket`, `TicketMessage`, and `LedgerEntry` tables before production deployments.

---

## 5. Verification Method

*   **Verify ESLint configuration**:
    ```bash
    npm run lint
    ```
    (Ensure problem count drops from 3109 after configuring environment globals).

*   **Verify Knip debt**:
    ```bash
    npm run lint:debt
    ```

*   **Verify Vitest suite**:
    Run the specific test file that fails to ensure it passes once isolated:
    ```bash
    npx vitest run src/utils/balance-verifier.test.ts
    ```
    If isolated database truncation is added to its local `beforeEach`, this test file will pass even when run alongside other integration tests.

*   **Verify DB rows**:
    Execute the inspection script:
    ```bash
    npx dotenv -e .env -- npx tsx .agents/explorer_cleanup_init/inspect-db.ts
    ```
