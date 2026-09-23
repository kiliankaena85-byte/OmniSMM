import { redis } from '@/lib/redis';
import { sendAdminAlert } from '@/lib/notifications';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'ProviderCircuitBreaker' });

export type CircuitState = 'closed' | 'open' | 'half-open';

// In-memory fallback map when Redis is not available
const memoryState = new Map<string, { state: CircuitState; failures: number; openUntil?: number }>();

export class ProviderCircuitBreaker {
  constructor(
    public readonly providerId: string,
    public readonly failureThreshold: number = 5,
    public readonly resetTimeoutMs: number = 60_000
  ) {}

  async canCall(): Promise<boolean> {
    const keyState = `cb:${this.providerId}:state`;
    const keyOpenUntil = `cb:${this.providerId}:openUntil`;

    try {
      if (redis && typeof redis.get === 'function') {
        const state = (await redis.get(keyState)) as CircuitState | null;
        if (state === 'open') {
          const openUntil = await redis.get(keyOpenUntil);
          if (openUntil && Date.now() > parseInt(openUntil, 10)) {
            if (typeof redis.set === 'function') {
              await redis.set(keyState, 'half-open');
            }
            return true; // Trial request in half-open state
          }
          return false;
        }
        return true;
      }
    } catch {
      // Fallback to memory
    }

    // Memory fallback
    const mem = memoryState.get(this.providerId);
    if (mem?.state === 'open') {
      if (mem.openUntil && Date.now() > mem.openUntil) {
        mem.state = 'half-open';
        return true;
      }
      return false;
    }

    return true;
  }

  async recordSuccess(): Promise<void> {
    const keyState = `cb:${this.providerId}:state`;
    const keyFailures = `cb:${this.providerId}:failures`;

    try {
      if (redis && typeof redis.del === 'function' && typeof redis.set === 'function') {
        await redis.del(keyFailures);
        await redis.set(keyState, 'closed');
      }
    } catch {
      // Fallback
    }

    memoryState.set(this.providerId, { state: 'closed', failures: 0 });
    log.info('Circuit breaker CLOSED (recovered)', { providerId: this.providerId });
  }

  async recordFailure(): Promise<void> {
    const keyState = `cb:${this.providerId}:state`;
    const keyFailures = `cb:${this.providerId}:failures`;
    const keyOpenUntil = `cb:${this.providerId}:openUntil`;

    let failures = 1;

    try {
      if (redis && typeof redis.incr === 'function') {
        failures = await redis.incr(keyFailures);
        if (typeof redis.expire === 'function') {
          await redis.expire(keyFailures, 300); // 5-minute window
        }
        if (failures >= this.failureThreshold) {
          if (typeof redis.set === 'function') {
            await redis.set(keyState, 'open');
            await redis.set(keyOpenUntil, String(Date.now() + this.resetTimeoutMs));
          }
        }
      }
    } catch {
      const mem = memoryState.get(this.providerId) || { state: 'closed' as CircuitState, failures: 0 };
      mem.failures += 1;
      failures = mem.failures;
      if (failures >= this.failureThreshold) {
        mem.state = 'open';
        mem.openUntil = Date.now() + this.resetTimeoutMs;
      }
      memoryState.set(this.providerId, mem);
    }

    if (failures >= this.failureThreshold) {
      log.error('Circuit breaker OPENED due to threshold failures', {
        providerId: this.providerId,
        failures,
      });

      sendAdminAlert(
        `🚨 <b>CRITICAL: Circuit Breaker СРАБОТАЛ (OPEN)!</b>\nПровайдер: <code>${this.providerId}</code>\nЗафиксировано ${failures} подряд ошибок API. Вызовы к провайдеру временно заблокированы на ${this.resetTimeoutMs / 1000} сек для защиты очередей.`,
        'CRITICAL'
      );
    }
  }

  async getState(): Promise<CircuitState> {
    const can = await this.canCall();
    if (!can) return 'open';
    const keyState = `cb:${this.providerId}:state`;
    try {
      if (redis && typeof redis.get === 'function') {
        const s = (await redis.get(keyState)) as CircuitState | null;
        if (s) return s;
      }
    } catch {
      // ignore
    }
    return memoryState.get(this.providerId)?.state || 'closed';
  }
}
