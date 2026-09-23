# Evidence: [OPS-01] Resilient Tunnel Daemon with Exponential Backoff & Jitter

## 1. Problem Description
- **Vulnerability/Defect**: In `scripts/tunnel-daemon.mjs`, when the SSH tunnel connection dropped or encountered a network error, the reconnect loop immediately restarted the process with a fixed or non-jittered delay. In addition, when imported for testing or health-checking, `scripts/tunnel-daemon.mjs` immediately invoked `startTunnel()` unconditionally at module evaluation time. Under network flapping or gateway disconnects, this caused reconnect stampedes, high CPU usage, and SSH port saturation.
- **Severity**: Medium (Availability / Denial of Service / Connection Storms)
- **CWE**: CWE-400 (Uncontrolled Resource Consumption) / CWE-799 (Improper Control of Generation of Frequent Consecutive Requests)

## 2. Reproduction Proof
- Test file: `src/__tests__/unit/tunnel-daemon-backoff.test.ts`
- Tests proved:
  1. Module import without execution guards spawned background child processes.
  2. Fixed delay failed to provide backoff scaling across sequential failures (e.g. failure 1 -> 3s, failure 2 -> 6s, failure 3 -> 12s, capped at 60s).
  3. Lack of jitter created synchronized reconnection patterns.

## 3. Remediation Details
- **`scripts/tunnel-daemon.mjs`**:
  - Implemented `getBackoffDelay(attempt, baseDelayMs = 3000, maxDelayMs = 60000)`:
    - Calculates exponential backoff: `Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1))`.
    - Injects randomized jitter: `delay + Math.floor(Math.random() * 1000)`.
  - Added module entry guard:
    - `const isMainModule = fileURLToPath(import.meta.url) === resolve(process.argv[1]);`
    - Prevents auto-execution during imports and unit tests.
  - Exported `getBackoffDelay` and helper utilities for isolated testing.

## 4. Verification
- **Unit Test**: `npx vitest run src/__tests__/unit/tunnel-daemon-backoff.test.ts` (3/3 passed).
- **TypeScript**: `npx tsc --noEmit` (0 errors).
- **Secret Scan**: `node scripts/check-bundle-secrets.mjs` (0 leaks).
