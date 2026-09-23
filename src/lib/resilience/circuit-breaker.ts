/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Distributed Circuit Breaker (Fail-Fast Isolation Pattern for SMM Providers).
 */

import { redis } from '@/lib/redis';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitStatus {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number | null;
  nextRetryTime: number | null;
}

export class ProviderUnavailableError extends Error {
  constructor(providerName: string, state: CircuitState) {
    super(`Провайдер ${providerName} временно недоступен (Circuit State: ${state})`);
    this.name = 'ProviderUnavailableError';
  }
}

// In-memory fallback state map when Redis is offline
const localCircuitStore = new Map<string, {
  state: CircuitState;
  failures: number;
  lastFailure: number;
  nextRetry: number;
}>();

export class CircuitBreaker {
  private static readonly FAILURE_THRESHOLD = 5;      // 5 consecutive failures trips circuit
  private static readonly RESET_TIMEOUT_MS = 60000;    // 60 seconds cool-down
  private static readonly MONITORING_WINDOW_MS = 30000; // 30 seconds failure window

  /**
   * Retrieves the current state of the circuit breaker for a provider.
   */
  static async getStatus(providerId: string): Promise<CircuitStatus> {
    const key = `circuit:provider:${providerId}`;

    try {
      if (redis && (redis.status === 'ready' || redis.status === 'connecting')) {
        const data = await redis.hgetall(key);
        if (data && data.state) {
          const state = data.state as CircuitState;
          const failureCount = parseInt(data.failures || '0', 10);
          const lastFailureTime = data.lastFailure ? parseInt(data.lastFailure, 10) : null;
          const nextRetryTime = data.nextRetry ? parseInt(data.nextRetry, 10) : null;

          // Check if OPEN circuit matured into HALF_OPEN
          if (state === 'OPEN' && nextRetryTime && Date.now() >= nextRetryTime) {
            await redis.hset(key, 'state', 'HALF_OPEN');
            return { state: 'HALF_OPEN', failureCount, lastFailureTime, nextRetryTime };
          }

          return { state, failureCount, lastFailureTime, nextRetryTime };
        }
      }
    } catch (err) {
      console.warn('[CircuitBreaker] Redis read failed, falling back to local memory store:', err);
    }

    // Local fallback
    const local = localCircuitStore.get(providerId);
    if (!local) {
      return { state: 'CLOSED', failureCount: 0, lastFailureTime: null, nextRetryTime: null };
    }

    if (local.state === 'OPEN' && Date.now() >= local.nextRetry) {
      local.state = 'HALF_OPEN';
      localCircuitStore.set(providerId, local);
    }

    return {
      state: local.state,
      failureCount: local.failures,
      lastFailureTime: local.lastFailure || null,
      nextRetryTime: local.nextRetry || null,
    };
  }

  /**
   * Executes a task protected by the Circuit Breaker.
   */
  static async execute<T>(providerId: string, providerName: string, task: () => Promise<T>): Promise<T> {
    const status = await this.getStatus(providerId);

    if (status.state === 'OPEN') {
      throw new ProviderUnavailableError(providerName, 'OPEN');
    }

    try {
      const result = await task();
      await this.recordSuccess(providerId);
      return result;
    } catch (error) {
      await this.recordFailure(providerId);
      throw error;
    }
  }

  /**
   * Records a successful execution (resets failure counter and closes circuit).
   */
  static async recordSuccess(providerId: string): Promise<void> {
    const key = `circuit:provider:${providerId}`;

    try {
      if (redis && (redis.status === 'ready' || redis.status === 'connecting')) {
        await redis.hset(key, {
          state: 'CLOSED',
          failures: '0',
          lastFailure: '0',
          nextRetry: '0',
        });
        await redis.expire(key, 86400);
      }
    } catch (err) {
      console.warn('[CircuitBreaker] Failed to record success in Redis:', err);
    }

    localCircuitStore.delete(providerId);
  }

  /**
   * Records an API error. If threshold is reached, trips circuit to OPEN.
   */
  static async recordFailure(providerId: string): Promise<void> {
    const now = Date.now();
    const key = `circuit:provider:${providerId}`;
    const status = await this.getStatus(providerId);

    const newFailures = status.failureCount + 1;
    let nextState: CircuitState = status.state;
    let nextRetry = 0;

    if (newFailures >= this.FAILURE_THRESHOLD || status.state === 'HALF_OPEN') {
      nextState = 'OPEN';
      nextRetry = now + this.RESET_TIMEOUT_MS;
      console.error(`[CircuitBreaker] TRIPPED TO OPEN for provider ${providerId} (${newFailures} failures)`);
    }

    try {
      if (redis && (redis.status === 'ready' || redis.status === 'connecting')) {
        await redis.hset(key, {
          state: nextState,
          failures: newFailures.toString(),
          lastFailure: now.toString(),
          nextRetry: nextRetry.toString(),
        });
        await redis.expire(key, 86400);
      }
    } catch (err) {
      console.warn('[CircuitBreaker] Failed to record failure in Redis:', err);
    }

    localCircuitStore.set(providerId, {
      state: nextState,
      failures: newFailures,
      lastFailure: now,
      nextRetry,
    });
  }

  /**
   * Operator force reset of circuit breaker.
   */
  static async forceReset(providerId: string): Promise<void> {
    await this.recordSuccess(providerId);
  }
}
