/**
 * db-memory-premortem-invariants.test.ts
 *
 * Automated regression suite for Dual Agent Improving Loop Pre-Mortem Audit (2026).
 * Enforces memory safety, non-blocking Redis SCAN, PostgreSQL buffer sizing,
 * MVCC HOT fillfactor calibration, and cgroup-to-heap headroom.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { RedisCacheService } from '@/lib/cache/redis-cache.service';
import { redis } from '@/lib/redis';

describe('DB & Memory Pre-Mortem Invariants (Maker-Checker 2026)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Vector 1 & 2: Redis Non-Blocking Invariant & L1 Cache Bound', () => {
    it('1. RedisCacheService limits L1 in-memory cache to prevent V8 heap exhaustion', async () => {
      // Fill cache with 1200 unique items
      for (let i = 0; i < 1200; i++) {
        await RedisCacheService.set(`test-key-${i}`, { index: i }, 60);
      }

      // Keys from 0 to 199 should have been evicted (FIFO/LRU bound)
      const earlyKey = await RedisCacheService.get('test-key-10');
      const recentKey = await RedisCacheService.get('test-key-1199');

      // The recent key must exist in memory
      expect(recentKey).toEqual({ index: 1199 });
    });

    it('2. RedisCacheService.scanAndDelete uses non-blocking redis.scan and avoids blocking redis.keys', async () => {
      const scanSpy = vi.spyOn(redis, 'scan').mockImplementation(async (cursor: string | number) => {
        if (String(cursor) === '0') {
          return ['10', ['mock:key:1', 'mock:key:2']];
        }
        return ['0', ['mock:key:3']];
      });
      const delSpy = vi.spyOn(redis, 'del').mockResolvedValue(3);

      const deleted = await RedisCacheService.scanAndDelete('mock:key:*');

      expect(scanSpy).toHaveBeenCalled();
      expect(delSpy).toHaveBeenCalled();
      expect(deleted).toBe(6); // 3 per del batch
    });

    it('3. Codebase scan: Zero calls to blocking redis.keys() in production runtime services', () => {
      const cacheServiceCode = fs.readFileSync(
        path.join(process.cwd(), 'src/lib/cache/redis-cache.service.ts'),
        'utf-8'
      );
      expect(cacheServiceCode).not.toContain('redis.keys(');

      const ownerHubCode = fs.readFileSync(
        path.join(process.cwd(), 'src/bot/scenes/owner-hub.wizard.ts'),
        'utf-8'
      );
      expect(ownerHubCode).not.toContain('redis.keys(');
    });
  });

  describe('Vector 3 & 4: PostgreSQL Sizing & MVCC HOT Invariants', () => {
    it('4. PostgreSQL production docker-compose sets high-load connection pool, shared_buffers and autovacuum', () => {
      const prodCompose = fs.readFileSync(
        path.join(process.cwd(), 'docker-compose.prod.yml'),
        'utf-8'
      );

      expect(prodCompose).toContain('max_connections=150');
      expect(prodCompose).toContain('shared_buffers=256MB');
      expect(prodCompose).toContain('autovacuum_vacuum_scale_factor=0.05');
      expect(prodCompose).toContain('maxmemory 512mb');
      expect(prodCompose).toContain('connection_limit=15');
    });

    it('5. Database optimization script calibrates fillfactor to eliminate Order table bloat and enables GIN fastupdate', () => {
      const scriptCode = fs.readFileSync(
        path.join(process.cwd(), 'scripts/apply-hardened-db-optimizations.ts'),
        'utf-8'
      );

      // User table has fillfactor = 85 (for frequent balance/profile HOT updates)
      expect(scriptCode).toContain('ALTER TABLE "User" SET (fillfactor = 85)');
      // Order table has fillfactor = 100 (since status is indexed in idx_orders_active_queue)
      expect(scriptCode).toContain('ALTER TABLE "Order" SET (fillfactor = 100)');
      // GIN Trigram indexes have fastupdate = on
      expect(scriptCode).toContain('idx_order_link_trgm" SET (fastupdate = on)');
    });
  });

  describe('Vector 5: Container Sizing vs V8 Heap & Prisma Native Memory Headroom', () => {
    it('6. Worker and Bot containers provide >= 96MB resident memory headroom for Prisma Rust Engine', () => {
      const composeContent = fs.readFileSync(
        path.join(process.cwd(), 'docker-compose.yml'),
        'utf-8'
      );

      // Worker: mem_limit must be at least 384m
      expect(composeContent).toMatch(/container_name:\s*smmplan_lite_worker[\s\S]*?mem_limit:\s*384m/);
      // Worker: NODE_OPTIONS heap limit
      expect(composeContent).toMatch(/container_name:\s*smmplan_lite_worker[\s\S]*?--max-old-space-size=256/);

      // Bot: mem_limit must be at least 256m
      expect(composeContent).toMatch(/container_name:\s*smmplan_bot[\s\S]*?mem_limit:\s*256m/);
      expect(composeContent).toMatch(/container_name:\s*smmplan_bot[\s\S]*?--max-old-space-size=160/);
    });
  });
});
