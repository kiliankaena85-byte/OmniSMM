/**
 * FeatureFlagService
 * 
 * Manages predefined feature flags with Redis caching.
 * State: ON (all users) | TEST (test accounts only) | OFF
 * 
 * Cache strategy: Redis key `ff:{key}` with TTL 60s.
 * On cache miss → read from DB → write to Redis.
 * On toggle → invalidate Redis key immediately.
 * 
 * Docs: https://redis.io/docs/manual/keyspace/
 */

import { db } from '@/lib/db';
import { redis } from '@/lib/redis';

export type FlagState = 'ON' | 'TEST' | 'OFF';

export interface FeatureFlagDTO {
  id: string;
  key: string;
  label: string;
  description: string;
  state: FlagState;
  updatedBy: string | null;
  updatedAt: Date;
}

/** Predefined flags — single source of truth for seed & UI */
const PREDEFINED_FLAGS = [
  { key: 'drip_feed',          label: 'Drip-Feed',              description: 'Постепенная накрутка (капельная)' },
  { key: 'promo_codes',        label: 'Промокоды',              description: 'Скидочные и ваучерные коды' },
] as const;

export type FlagKey = (typeof PREDEFINED_FLAGS)[number]['key'];

const CACHE_TTL_SECONDS = 60;
const cacheKey = (key: string) => `ff:${key}`;

class FeatureFlagService {
  /**
   * Get flag state for a given key.
   * Returns 'OFF' if flag not found in DB.
   * Caches result in Redis for 60s.
   */
  async getState(key: FlagKey): Promise<FlagState> {
    // 1. Check Redis cache
    const cached = await redis.get(cacheKey(key));
    if (cached) return cached as FlagState;

    // 2. DB fallback
    const flag = await db.featureFlag.findUnique({ where: { key } });
    const state = (flag?.state as FlagState) ?? 'OFF';

    // 3. Write to cache
    await redis.setex(cacheKey(key), CACHE_TTL_SECONDS, state);
    return state;
  }

  /**
   * Check if feature is enabled.
   * isTestUser=true allows TEST-state flags to pass.
   */
  async isEnabled(key: FlagKey, isTestUser = false): Promise<boolean> {
    const state = await this.getState(key);
    if (state === 'ON') return true;
    if (state === 'TEST' && isTestUser) return true;
    return false;
  }

  /**
   * Update flag state. Invalidates Redis cache immediately.
   * Records updatedBy for audit trail.
   */
  async setState(key: FlagKey, state: FlagState, adminEmail: string): Promise<FeatureFlagDTO> {
    const flag = await db.featureFlag.upsert({
      where: { key },
      update: { state, updatedBy: adminEmail },
      create: {
        key,
        label: PREDEFINED_FLAGS.find(f => f.key === key)?.label ?? key,
        description: PREDEFINED_FLAGS.find(f => f.key === key)?.description ?? '',
        state,
        updatedBy: adminEmail,
      },
    });

    // Invalidate cache immediately
    await redis.del(cacheKey(key));

    return {
      id: flag.id,
      key: flag.key as FlagKey,
      label: flag.label,
      description: flag.description,
      state: flag.state as FlagState,
      updatedBy: flag.updatedBy,
      updatedAt: flag.updatedAt,
    };
  }

  /**
   * List all predefined flags with their current state.
   * Merges DB state with PREDEFINED_FLAGS definition.
   */
  async listAll(): Promise<FeatureFlagDTO[]> {
    const dbFlags = await db.featureFlag.findMany();
    const dbMap = new Map(dbFlags.map(f => [f.key, f]));

    return PREDEFINED_FLAGS.map(def => {
      const dbFlag = dbMap.get(def.key);
      return {
        id: dbFlag?.id ?? '',
        key: def.key,
        label: def.label,
        description: def.description,
        state: (dbFlag?.state as FlagState) ?? 'OFF',
        updatedBy: dbFlag?.updatedBy ?? null,
        updatedAt: dbFlag?.updatedAt ?? new Date(0),
      };
    });
  }
}

export const featureFlagService = new FeatureFlagService();
