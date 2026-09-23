# Handoff Report: Smmplan Testing Infrastructure Mapping & Import Script Analysis

## 1. Observation

During our read-only investigation, we mapped Smmplan's testing infrastructure, analyzed the article import script, and located the exact targets for implementing tests for requirements R1 through R5.

### 1.1 Testing Infrastructure Setup
*   **Vitest Configuration**:
    *   Main Config (`d:\SMM_plan_2\vitest.config.ts`): Sets up a node environment (`environment: 'node'`), resolves `@/` alias to `./src`, loads `test/setup.ts` as a setup file, and disables parallel test execution (`maxWorkers: 1`, `fileParallelism: false`) to avoid postgres transaction deadlocks.
    *   Unit Config (`d:\SMM_plan_2\vitest.unit.config.ts`): A lightweight test configuration that runs without `setupFiles`, facilitating fast pure unit tests.
*   **Playwright Configuration** (`d:\SMM_plan_2\playwright.config.ts`):
    *   Directs E2E tests to the `./e2e` directory, runs `./e2e/utils/db-cleaner.ts` as global teardown, and starts the local web server on port 3000 using `npm run start` with test environment variables (`.env.test`).
*   **Test Environment Guards** (`d:\SMM_plan_2\test\setup.ts`):
    *   Guards the database against accidental production/dev wipes in the `beforeAll` block:
        ```typescript
        const dbUrl = process.env.DATABASE_URL || '';
        if (!dbUrl.includes('test') && !dbUrl.includes('smmplan_test')) {
          throw new Error(
            `[FATAL] Accidental DB wipe protection triggered! ...`
          );
        }
        ```
    *   Mocks `nodemailer`, `resend`, `ioredis`, and `bullmq` globally by default to prevent external effects.
    *   Stubs global `fetch` via `vi.stubGlobal('fetch', vi.fn())`.

### 1.2 Analysis of `scripts/import-articles-to-db.ts`
*   **Database Models Needed**:
    *   Reads and interacts with the `Article` model. According to `prisma/schema.prisma` (lines 1016-1033):
        ```prisma
        model Article {
          id          String        @id @default(cuid())
          slug        String        @unique
          title       String
          description String        @db.Text
          content     String        @db.Text
          status      ArticleStatus
          category    String
          viewCount   Int           @default(0)
          createdAt   DateTime      @default(now())
          updatedAt   DateTime      @updatedAt
          authorName  String        @default("Михаил")
          authorRole  String        @default("Системный архитектор прокси-сетей Smmplan")
          priority    Int           @default(0) // 0-100, used for Drip-Feed publish queue

          @@index([category, status])
          @@index([status])
        }
        ```
    *   Uses the `ArticleStatus` enum from `@prisma/client`. According to `prisma/schema.prisma` (lines 1011-1014):
        ```prisma
        enum ArticleStatus {
          DRAFT
          PUBLISHED
        }
        ```
*   **Directory Structure and Source Data**:
    *   Reads `.md` and `.mdx` files located in the `src/data/knowledge` directory.
    *   Each file must follow a frontmatter pattern:
        ```yaml
        ---
        title: "Article Title"
        description: "Article Description"
        category: "knowledge"
        ---
        Content body goes here.
        ```
*   **Runtime Environment Setup**:
    *   Requires a valid `DATABASE_URL` environment variable pointing to the target PostgreSQL database containing the `Article` table schema.
    *   Requires generated Prisma client (`npx prisma generate`).
    *   Requires `tsx` dependency to execute the script in a TypeScript environment.
    *   Execution command: `npx tsx scripts/import-articles-to-db.ts`.

### 1.3 Implementation Plan & Target Locations for R1 to R5 Tests
*   **R1: Integration Verification (Providers & CBR Sync)**
    *   *Intent*: Verify CBR rate service syncs exchange rates correctly from external bank sources, and ensure provider universal endpoints correctly fetch balances/services over real internet.
    *   *Target Location*: `test/integration/cbr-rate-sync.test.ts` (New integration test) and `test/unit/provider-universal.test.ts` (Existing, uses `vi.unstubAllGlobals()` to contact live provider APIs).
*   **R2: Payment Gateways API Verification (Anti-Mocking & Fallbacks)**
    *   *Intent*: Test that the unified payment gateway factory returns mock URLs if and only if shop/secrets credentials are set to empty or default placeholder strings (`test_shop_id`, `test_login`), and successfully forwards to real external services when test/prod credentials exist.
    *   *Target Location*: `test/unit/payment-gateway-selection.test.ts` (New unit test file targeting `src/services/financial/payment-gateway.service.ts`).
*   **R3: End-to-End User Flow Tests (Playwright)**
    *   *Intent*: Automate authorization checks, single unit pricing formatting (`pricePerUnitRub` with `₽ / шт`), link validation target types (`CHANNEL`, `POST`, `STORY`, `CUSTOM`), and order creation.
    *   *Target Location*: `e2e/checkout-yookassa.spec.ts` (Modify to add magic link login and check unit price formatting) and `e2e/user-flows.spec.ts` (New spec).
*   **R4: Admin Panel & Operator Roles E2E Tests**
    *   *Intent*: Automate admin authentication, provider management, service importing from shadow catalog, margin editing, quarantine zones checks, and admin audit log creation.
    *   *Target Location*: `e2e/admin-panel.spec.ts` (Existing, expand to test role changes, audit logs, and service importing).
*   **R5: Queue & SLA Verification (BullMQ Workers)**
    *   *Intent*: Verify order dispatches, test queue delays, SLA limits, and check connection timeout fallback to `PENDING_CHECK` and Prisma `$transaction` rollbacks.
    *   *Target Location*: `test/unit/red-team.queue.test.ts` (Existing queue test; expand to verify transaction rollbacks and SLA bounds).

---

## 2. Logic Chain

1. **Prisma Client Dependency**: The import script `import-articles-to-db.ts` uses `@prisma/client` to call `prisma.article.upsert`. Therefore, the script cannot run unless the database migrations have been successfully applied and the Prisma Client is generated.
2. **Database Wipe Safe-Guard**: `test/setup.ts` blocks any Vitest test run if `DATABASE_URL` does not point to a database whose name includes `test` or `smmplan_test`. Running integration tests must follow this rule.
3. **Anti-Mocking Verification**: The selection between real payment endpoints and the internal simulator is handled within `payment-gateway.service.ts` based on settings. Testing this requires mocking different state outcomes in `SettingsManager`.
4. **CBR Sync Real Fetching**: Since `test/setup.ts` stubs `fetch` globally by default, any test for R1 that needs to check real API responses must explicitly call `vi.unstubAllGlobals()` or restore `fetch` to verify network connectivity.

---

## 3. Caveats

*   **Real Network Connectivity**: CBR daily rate API and provider API endpoints might be rate-limited or experience downtime during integration checks.
*   **Local Redis Context**: BullMQ queue connection tests assume a local Redis server is active at `redis://127.0.0.1:6379`.

---

## 4. Conclusion

All existing testing architectures and scripts have been fully mapped. Smmplan uses a robust combination of Playwright (for E2E user flows and admin operations) and Vitest (for unit and integration tests). The requirements R1 to R5 can be cleanly implemented in the designated files and directories identified above.

### Recommended Next Steps for implementer:
1. Fix empty `expect().toBe()` stubs in `test/unit/tc-fin-hedge.test.ts`.
2. Write integration tests for CBRRateService under `test/integration/cbr-rate-sync.test.ts` ensuring that it correctly retrieves rates and saves them.
3. Create unit tests in `test/unit/payment-gateway-selection.test.ts` to ensure dummy credentials trigger the internal mock URL while non-dummy credentials cause real API requests.

---

## 5. Verification Method

To verify the setup independently:
1. **Prisma client and migrations**:
   Run `npx prisma migrate dev` or `npx prisma generate` to ensure client is ready.
2. **Run Import Script**:
   Run `npx tsx scripts/import-articles-to-db.ts` to confirm articles import successfully into the `Article` table without database errors.
3. **Unit Tests**:
   Run `npm run test` or `npx vitest run test/unit/provider-universal.test.ts` to verify provider integrations can successfully fetch data when unstubbed.
