import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';

describe('DB Purge Guard in Production Suite (P3-24)', () => {
  it('blocks unconditional deleteMany() on Service in production environment', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAppEnv = process.env.APP_ENV;

    try {
      (process.env as any).NODE_ENV = 'production';
      process.env.APP_ENV = 'production';

      await expect(
        db.service.deleteMany()
      ).rejects.toThrow('Unconditional Service.deleteMany() is strictly blocked in production');
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      process.env.APP_ENV = originalAppEnv;
    }
  });
});
