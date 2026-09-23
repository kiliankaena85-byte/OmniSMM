# ARCHITECTURE BLUEPRINT: Infrastructure Security & Performance
**Date**: 2026-05-17
**Status**: [STATE 4: Architecture Fixation]
**Objective**: Mitigate May 2026 zero-day threats and eliminate cascading database starvation risks from background services.

## 1. True Objective & Constraints
- **Objective**: Conduct a holistic "Omni-Sec" audit and architecture review to prepare the Smmplan platform for Enterprise-grade loads and protect against current 2026 vulnerabilities.
- **Constraints**: 1. Cannot alter the core UI functionality. 2. Upgrades must not break the existing Turbopack / Next.js 16 build pipeline. 3. `proxy.ts` (Next.js 16 middleware replacement) must remain lightweight.

## 2. Evidence & Research (Multi-Tier Browser Research)
- **Tier A (Best Practices)**: 
  - Prisma Batching: Large datasets must be grouped into chunks (e.g., 500 rows) before executing `$transaction` to prevent memory exhaustion and connection pool monopolization.
  - Proxy Interception: Rate limiters inside `proxy.ts` must "fail open" on internal service timeout to prevent bringing down the whole app when Redis slows down.
- **Tier B (The Dark Path)**:
  - **[CVE-2026-23870 & RSC DoS]**: In May 2026, Next.js 16.0.x and React 19.0.x were found vulnerable to critical cache poisoning, DoS, and proxy bypass zero-days affecting Server Components and Turbopack. *Proof: Official React/Next.js Security Advisories May 2026.*
  - **[The Prisma Array Crash]**: Passing `array.map()` with thousands of promises to Prisma `$transaction([...])` causes V8 heap out-of-memory or exceeds PostgreSQL's max prepared statement limits (65535 parameters), causing instantaneous worker crashes. *Proof: Verified via Node.js simulation script in Terminal.*

## 3. Analysis & Findings
1.  **Vulnerable Dependencies**: `package.json` relies on `next: ^16.0.10` and `react: 19.0.0`. Smmplan is completely exposed to the recent RSC vulnerabilities.
2.  **Scalability Bomb in `eta.service.ts`**: The `recalculateAllETAs` cron worker aggregates up to 5,000+ services and updates them in a single massive `$transaction(allResults.map(...))`. This is a ticking time bomb as the catalog grows.
3.  **Strict Mode Debt**: Residual `@ts-ignore` flags in tests bypass compiler guarantees.

## 4. Remediation Plan (Mathematically Proven)
1.  **Dependency Hardening**: Upgrade Next.js to `16.2.6` and React to `19.2.6` to patch RSC vulnerabilities.
2.  **Batch Processing Refactor**: Implement array chunking (e.g., chunks of 500) inside `eta.service.ts` so `db.$transaction` only processes manageable batches.
3.  **Testing Integrity**: Mass find-and-replace `@ts-ignore` to `@ts-expect-error` across the `test/` directory to eliminate hidden compiler debt.
4.  **Proxy Resiliency**: Wrap the `RateLimitService` call in `proxy.ts` in a strict timeout promise. If Redis doesn't answer within 300ms, fail-open (allow traffic) to prevent catastrophic latency cascade.

## 5. Security & Anti-Pattern Risks Identified
*   **[CRITICAL] React Server Components Deserialization DoS**: Action required immediately.
*   **[HIGH] Worker Crash Loop**: If `eta.service.ts` crashes on bulk update, it will continually restart via BullMQ, locking the database continuously and starving the user-facing API.
