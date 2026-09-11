import { logger } from '@/lib/logger';

const log = logger.child({ component: 'HoneypotDefenseService' });

export interface MinimalRedisClient {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode?: string, duration?: number) => Promise<unknown>;
}

async function getRedisInstance(): Promise<MinimalRedisClient | null> {
  try {
    const { redis } = await import('@/lib/redis');
    return redis as unknown as MinimalRedisClient;
  } catch (err) {
    log.warn('Redis unavailable for DDoS shield honeypot service', { error: String(err) });
    return null;
  }
}

/**
 * Automatically blacklists an aggressive bot or scraper in Redis for 24 hours.
 */
export async function recordHoneypotViolation(
  ip: string,
  fingerprint: string,
  customRedis?: MinimalRedisClient
): Promise<void> {
  const redis = customRedis || (await getRedisInstance());
  if (!redis) return;

  const TTL_SECONDS = 86400; // 24 hours

  try {
    const tasks: Promise<unknown>[] = [];
    if (ip && ip !== 'unknown') {
      tasks.push(redis.set(`blacklist:ddos:ip:${ip}`, '1', 'EX', TTL_SECONDS));
    }
    if (fingerprint && fingerprint.length === 64) {
      tasks.push(redis.set(`blacklist:ddos:fp:${fingerprint}`, '1', 'EX', TTL_SECONDS));
    }
    await Promise.all(tasks);

    log.warn('🚨 Bot successfully trapped in Honeypot! Blacklisted for 24h', { ip, fingerprint });
  } catch (err) {
    log.error('Failed to blacklist honeypot attacker in Redis', { error: String(err), ip });
  }
}

/**
 * Checks whether an IP or browser fingerprint is currently in the active DDoS blacklist.
 */
export async function isBlacklistedDdosTarget(
  ip: string,
  fingerprint: string,
  customRedis?: MinimalRedisClient
): Promise<boolean> {
  const redis = customRedis || (await getRedisInstance());
  if (!redis) return false;

  try {
    const [ipBlocked, fpBlocked] = await Promise.all([
      ip && ip !== 'unknown' ? redis.get(`blacklist:ddos:ip:${ip}`) : null,
      fingerprint && fingerprint.length === 64 ? redis.get(`blacklist:ddos:fp:${fingerprint}`) : null,
    ]);

    return Boolean(ipBlocked || fpBlocked);
  } catch {
    return false; // Fail-Open on Redis query errors
  }
}
