import { getRedisConnection } from './queue-manager';
import { metrics } from './metrics';

class CircuitBreakerOpenException extends Error {
  constructor(providerHost: string) {
    super(`Circuit breaker is OPEN for provider: ${providerHost}`);
    this.name = 'CircuitBreakerOpenException';
  }
}

/**
 * Redis-based Circuit Breaker for distributed environments.
 * Prevents cascading failures when external providers go down.
 */
export class CircuitBreaker {
  private static readonly FAILURE_THRESHOLD = 5; // failures
  private static readonly FAILURE_WINDOW_SEC = 60; // window to accumulate failures
  private static readonly COOL_DOWN_SEC = 30; // time before half-open state

  /**
   * Checks if a request to the given URL is allowed.
   * Throws CircuitBreakerOpenException if the circuit is OPEN.
   */
  static async check(providerUrl: string): Promise<void> {
    let host = providerUrl;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    try { host = new URL(providerUrl).hostname; } catch(e) { /* ignore */ }

    const redis = getRedisConnection();
    
    // 1. Is the circuit explicitly OPEN?
    const isOpen = await redis.get(`cb:${host}:open`);
    if (isOpen) {
      throw new CircuitBreakerOpenException(host);
    }

    // 2. Are we in HALF-OPEN state? (open expired, testing the waters)
    const isHalfOpen = await redis.get(`cb:${host}:half_open`);
    if (isHalfOpen) {
      // Only let ONE request through as a probe (Atomic setnx + expire 5s)
      const locked = await redis.set(`cb:${host}:probe_lock`, '1', 'EX', 5, 'NX');
      if (!locked) {
         // Probe is currently running, others must fail fast
         throw new CircuitBreakerOpenException(host);
      }
    }
  }

  /**
   * Records a successful request, resetting the circuit if it was HALF-OPEN.
   */
  static async recordSuccess(providerUrl: string): Promise<void> {
    let host = providerUrl;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    try { host = new URL(providerUrl).hostname; } catch(e) { /* ignore */ }

    const redis = getRedisConnection();
    
    await redis.del(`cb:${host}:failures`);
    await redis.del(`cb:${host}:open`);
    await redis.del(`cb:${host}:half_open`);
    await redis.del(`cb:${host}:probe_lock`);
  }

  /**
   * Records a failed request (timeout, 5xx).
   */
  static async recordFailure(providerUrl: string): Promise<void> {
    let host = providerUrl;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    try { host = new URL(providerUrl).hostname; } catch(e) { /* ignore */ }

    const redis = getRedisConnection();
    
    const isHalfOpen = await redis.get(`cb:${host}:half_open`);
    if (isHalfOpen) {
      // Probe failed. Trip circuit again immediately.
      await this.trip(host);
      return;
    }

    const failures = await redis.incr(`cb:${host}:failures`);
    if (failures === 1) {
      // Start the failure window on the first error
      await redis.expire(`cb:${host}:failures`, this.FAILURE_WINDOW_SEC);
    }

    if (failures >= this.FAILURE_THRESHOLD) {
      await this.trip(host);
    }
  }

  private static async trip(host: string) {
    const redis = getRedisConnection();
    
    metrics.recordCircuitBreakerTrip(host);
    console.warn(`[CircuitBreaker] 🔴 TRIPPED for ${host}. Failing fast for ${this.COOL_DOWN_SEC}s`);
    
    // Set OPEN for COOL_DOWN_SEC
    await redis.setex(`cb:${host}:open`, this.COOL_DOWN_SEC, '1');
    // Set HALF_OPEN so we know it was tripped after OPEN expires
    await redis.setex(`cb:${host}:half_open`, this.COOL_DOWN_SEC * 2, '1');
    // Release any probe lock
    await redis.del(`cb:${host}:probe_lock`);
  }
}
