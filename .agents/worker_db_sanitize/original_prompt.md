## 2026-06-05T06:29:12Z
You are `worker_db_sanitize` (role: Database Sanitizer & Validator). Your working directory is d:\SMM_plan_2\.agents\worker_db_sanitize.
Your task is to sanitize the local development database and configure domains ready for migration, following the Zero-Defect standard.

Please perform the following tasks:
1. Write a TypeScript script at `scripts/sanitize-db-prod.ts` that will:
   - Connect to the local PostgreSQL database using PrismaClient.
   - Safely delete/truncate all transactional and user-related garbage tables. Since there are foreign key constraints, you should execute raw SQL truncates/deletes or delete them in the correct order:
     - Empty tables:
       - `SmartDetectedUser`
       - `SmartSnapshot`
       - `SmartChannelMetric`
       - `SmartExecution`
       - `SmartTask`
       - `SmartCampaign`
       - `SecurityEvent`
       - `PromoCodeUsage`
       - `Commission`
       - `LedgerEntry`
       - `AdminAuditLog`
       - `AuditLog`
       - `LoginLog`
       - `RoutingAuditLog`
       - `RateLimit`
       - `AnalyticsEvent`
       - `Session`
       - `AuthToken`
       - `MessageAttachment`
       - `TicketMessage`
       - `Ticket`
       - `Invoice`
       - `Refill`
       - `Order`
       - `Payment`
       - `ApiConfig`
     - Delete all `User` records EXCEPT those with role `OWNER` or `ADMIN`. (You can execute `DELETE FROM "User" WHERE role NOT IN ('OWNER', 'ADMIN');` or via Prisma client).
   - Update all settings in `SystemSettings` (row with id='global') and `SystemSetting` key-value table:
     - Search for any string fields containing `http://localhost:3000` or `http://127.0.0.1:3000` and replace that part with `https://smmplan.pro`.
   - Update the `Provider` table:
     - For any provider, if its `apiUrl` contains `localhost:3000` or `127.0.0.1:3000`, replace that portion with `https://smmplan.pro` (or the proper mock API endpoint).
   - Report the count of deleted items and updated configurations.
2. Execute the script:
   - Run `npx tsx scripts/sanitize-db-prod.ts` (or equivalent ts-node/tsx command) to perform the sanitization.
3. Verify the database state:
   - Write a short verification script or query (or run `npx tsx scripts/check-db.ts`) and check that:
     - Transactional tables are empty (0 rows).
     - Only OWNER/ADMIN users exist in the `User` table.
     - SystemSettings / SystemSetting contains domain `https://smmplan.pro` and no reference to `localhost:3000`.
     - Providers are still intact but their URLs are corrected.
4. Run validation checks:
   - Run `npm run lint` to confirm 0 errors/warnings.
   - Run `npm run test` to confirm all tests still pass.
   - Run `npm run build` to verify the codebase compiles successfully.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Save your results, command outputs, and the contents of the script in a handoff report at `d:\SMM_plan_2\.agents\worker_db_sanitize\handoff.md` following the Handoff Protocol. Send a message to me with the path to the handoff and a summary of your results when you are done.
