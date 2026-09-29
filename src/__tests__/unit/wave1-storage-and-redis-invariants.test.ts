/**
 * wave1-storage-and-redis-invariants.test.ts
 * Юнит-тесты на инварианты Волны 1: Хранилища (PostgreSQL, Prisma, RLS, Redis & BullMQ).
 */

import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { findUnindexedForeignKeys } from '@/../scripts/audit/check-unindexed-foreign-keys';
import { TENANT_SCOPED_MODELS } from '@/lib/prisma-tenant-enforcer';
import { createQueue, REPEATABLE_JOB_CLEANUP_OPTS } from '@/lib/queue-manager';
import { validateRedisUrl } from '@/lib/redis';

describe('Wave 1 Invariants: Storage, PostgreSQL & Redis SRE', () => {
  it('1. PostgreSQL FK Index Coverage: 100% of foreign keys have covering B-Tree indexes', () => {
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
    const content = fs.readFileSync(schemaPath, 'utf-8');
    const missing = findUnindexedForeignKeys(content);

    expect(missing).toEqual([]);
  });

  it('2. Multi-Tenant RLS Scope: All critical business models are registered in TENANT_SCOPED_MODELS', () => {
    const requiredModels = ['order', 'payment', 'ticket', 'user', 'service', 'category', 'ledgerEntry', 'supportFinancialAction'];
    for (const model of requiredModels) {
      expect(TENANT_SCOPED_MODELS).toContain(model);
    }
  });

  it('3. BullMQ Retention Safety: Queues enforce removeOnComplete and removeOnFail', () => {
    expect(REPEATABLE_JOB_CLEANUP_OPTS.removeOnComplete).toBeDefined();
    expect(REPEATABLE_JOB_CLEANUP_OPTS.removeOnComplete.count).toBeLessThanOrEqual(500);
    expect(REPEATABLE_JOB_CLEANUP_OPTS.removeOnFail.count).toBeLessThanOrEqual(1000);

    const testQueue = createQueue('testWave1Queue');
    expect(testQueue.defaultJobOptions).toBeDefined();
    expect(testQueue.defaultJobOptions?.attempts).toBe(3);
  });

  it('4. Redis SEC-001 Hardening: Rejects unauthenticated connections in production', () => {
    const insecureUrl = 'redis://192.168.1.50:6379';
    const validation = validateRedisUrl(insecureUrl, 'production');

    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('SEC-001 Violation');
  });

  it('5. Worker Graceful Shutdown Hook: src/workers/index.ts listens for SIGTERM and SIGINT', () => {
    const workerIndexPath = path.join(process.cwd(), 'src', 'workers', 'index.ts');
    const code = fs.readFileSync(workerIndexPath, 'utf-8');

    expect(code).toContain("process.on('SIGTERM', shutdown)");
    expect(code).toContain("process.on('SIGINT', shutdown)");
    expect(code).toContain('orderWorker.close()');
    expect(code).toContain('refillWorker.close()');
    expect(code).toContain('syncWorker.close()');
  });
});
