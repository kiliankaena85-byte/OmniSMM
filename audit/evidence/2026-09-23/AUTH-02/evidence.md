# Evidence: [AUTH-02] CSP Telemetry Rate Limiting & Violation Deduplication

## 1. Problem Description
- **Vulnerability/Defect**:
  - The `/api/telemetry/csp-report` endpoint was unprotected by rate limiting and allowed unconstrained inbound POST requests.
  - Repeated identical CSP violation reports from misbehaving client extensions or malicious flooders triggered unbounded database writes to `SecurityAlert`, causing database table bloat, Redis resource consumption, and potential Denial of Service (DoS).
- **Severity**: Medium (Availability / Anti-Spam Telemetry Hardening)
- **CWE**: CWE-799 (Improper Control of Generation of Frequent Consecutive Requests) / CWE-400 (Uncontrolled Resource Consumption)

## 2. Reproduction Proof
- Test file: `src/__tests__/unit/auth-csp-report-ratelimit.test.ts`
- Tests proved:
  1. High-frequency report bursts without rate limiting flooded the alert subsystem.
  2. With the fix, requests exceeding 10 req/min return HTTP `429 Too Many Requests` with standard `Retry-After`, `X-RateLimit-Limit`, and `X-RateLimit-Remaining` headers.
  3. Identical reports from the same IP within a 5-minute window are safely acknowledged with `200 { status: 'deduplicated' }` without persisting duplicate alerts.

## 3. Remediation Details
- **`src/app/api/telemetry/csp-report/route.ts`**:
  - Integrated `checkRateLimit(ip, 'csp_report', { limit: 10, windowSeconds: 60 })` using Redis atomic sliding-window script.
  - Implemented 5-minute deduplication using SHA-256 hash of `blockedUri:violatedDirective` with atomic Redis `SET NX EX 300`.
  - Replaced catch blocks with structured error responses.

## 4. Verification
- **Unit Test**: `npx vitest run src/__tests__/unit/auth-csp-report-ratelimit.test.ts` (3/3 passed).
- **TypeScript**: `npx tsc --noEmit` (0 errors).
- **Secret Scan**: `node scripts/check-bundle-secrets.mjs` (0 leaks).
