import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

export class ProviderSyncMutex {
  private static LOCK_PREFIX = 'lock:provider:sync:';
  private static DEFAULT_TTL_SEC = 180; // 3 minutes

  /**
   * Tries to acquire exclusive lock for a provider sync.
   * Returns a release function if acquired, or null if locked.
   */
  static async acquire(providerId: string, ttlSec = this.DEFAULT_TTL_SEC): Promise<(() => Promise<void>) | null> {
    const lockKey = `${this.LOCK_PREFIX}${providerId}`;
    const token = `${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;

    try {
      const acquired = await redis.set(lockKey, token, 'EX', ttlSec, 'NX');
      if (!acquired) {
        logger.info(`[ProviderSyncMutex] Sync already running for provider ${providerId}. Skipping.`);
        return null;
      }

      return async () => {
        const releaseLua = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        try {
          await redis.eval(releaseLua, 1, lockKey, token);
        } catch (err: any) {
          logger.error(`[ProviderSyncMutex] Error releasing lock for ${providerId}: ${err.message}`);
        }
      };
    } catch (err: any) {
      logger.error(`[ProviderSyncMutex] Redis error acquiring lock: ${err.message}`);
      // Fail safe - allow sync if Redis is temporarily unreachable
      return async () => {};
    }
  }
}
