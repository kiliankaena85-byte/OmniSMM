# Evidence: [OPS-02] BullMQ Queue Timeouts, Distributed Fencing Tokens & Provider Network Guards

## 1. Problem Description
- **Vulnerability/Defect**:
  1. Distributed locks in `src/lib/redis-lock.ts` lacked fencing tokens. In distributed environments where a worker experiences GC pause or network delay exceeding the lock TTL, another worker acquires the lock, leading to concurrent split-brain writes and race conditions.
  2. Asynchronous BullMQ background queues (`ordersQueue`, `syncQueue`, `catalogQueue`, `refillQueue`, `paymentGatewayQueue`) did not define execution timeouts in their default options, risking permanently stalled jobs when external network resources or database operations hung.
  3. External provider API requests and proxy calls risked hanging without bounded abort timeouts.
- **Severity**: Medium (Reliability / Data Concurrency & Stalled Job Prevention)
- **CWE**: CWE-662 (Improper Synchronization) / CWE-400 (Uncontrolled Resource Consumption)

## 2. Reproduction Proof
- Test file: `src/__tests__/unit/provider-timeout-guard.test.ts`
- Tests proved:
  1. Monotonic fencing tokens increment on each lock acquisition, guaranteeing order of execution.
  2. `withFencingLock` supplies the fence token to execution callbacks and safely cleans up on completion or failure.
  3. Queue instances declare bounded job execution timeouts:
     - `ordersQueue`: 60,000 ms
     - `syncQueue`: 120,000 ms
     - `catalogQueue`: 180,000 ms
     - `refillQueue`: 60,000 ms
     - `paymentGatewayQueue`: 30,000 ms
  4. AbortSignal cleanly terminates stalled provider requests upon timeout.

## 3. Remediation Details
- **`src/lib/redis-lock.ts`**:
  - Implemented `acquireLockWithFencing(key, ttlMs, maxWaitMs)` using Redis atomic increment `redis.incr(`${lockKey}:fence`)`.
  - Implemented `withFencingLock<T>(key, ttlMs, maxWaitMs, fn: (fence: number) => Promise<T>)`.
- **`src/lib/queue-manager.ts`**:
  - Configured explicit `timeout` options across `ordersQueue`, `syncQueue`, `catalogQueue`, `refillQueue`, and `paymentGatewayQueue`.
  - Propagated default options into test/build proxy queue definitions to guarantee parity between testing and production.
- **`src/services/providers/universal.provider.ts`**:
  - Verified bounded `AbortController` timeout (15s), exponential backoff retries, and circuit breaker recording.

## 4. Verification
- **Unit Test**: `npx vitest run src/__tests__/unit/provider-timeout-guard.test.ts` (4/4 passed).
- **TypeScript**: `npx tsc --noEmit` (0 errors).
- **Secret Scan**: `node scripts/check-bundle-secrets.mjs` (0 leaks).
