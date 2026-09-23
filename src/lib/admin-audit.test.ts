import { describe, test, expect, vi } from 'vitest';
import { tenantStorage } from '@/lib/tenant-context';
import { db } from '@/lib/db';

// Ensure we test the REAL admin-audit implementation, bypassing the test/setup.ts global mock
vi.unmock('@/lib/admin-audit');

import { safeSerialize, auditAdmin, auditAdminAwaitable } from './admin-audit';

describe('safeSerialize', () => {
  test('should serialize simple object', () => {
    const obj = { a: 1, b: 'hello' };
    const res = safeSerialize(obj);
    expect(res).toBe(JSON.stringify(obj));
  });

  test('should handle BigInt successfully', () => {
    const obj = { a: BigInt(1), b: BigInt("1234567890123456789") };
    const res = safeSerialize(obj);
    const parsed = JSON.parse(res!);
    expect(parsed.a).toBe('1');
    expect(parsed.b).toBe('1234567890123456789');
  });

  test('should scrub sensitive keys recursively', () => {
    const obj = {
      user: 'admin',
      password: 'mypassword',
      nested: {
        token: 'mytoken',
        secret: 'mysecret',
        safeField: 'ok'
      }
    };
    const res = safeSerialize(obj);
    const parsed = JSON.parse(res!);
    expect(parsed.password).toBe('[SCRUBBED]');
    expect(parsed.nested.token).toBe('[SCRUBBED]');
    expect(parsed.nested.secret).toBe('[SCRUBBED]');
    expect(parsed.nested.safeField).toBe('ok');
  });

  test('should protect against circular references', () => {
    const obj: any = { name: 'circular' };
    obj.self = obj;
    const res = safeSerialize(obj);
    const parsed = JSON.parse(res!);
    expect(parsed.name).toBe('circular');
    expect(parsed.self).toBe('[Circular]');
  });
});

describe('auditAdmin & auditAdminAwaitable tenant isolation', () => {
  test('auditAdminAwaitable saves explicit tenantId and passes to db client', async () => {
    const mockTx = {
      adminAuditLog: {
        create: (args: any) => Promise.resolve({ id: 'log-1', ...args.data }),
      },
    };

    const result = await auditAdminAwaitable({
      adminId: 'admin-1',
      adminEmail: 'admin@flux.local',
      action: 'UPDATE_SERVICE',
      target: 'srv-100',
      targetType: 'SERVICE',
      tenantId: 'flux',
      tx: mockTx,
    });

    expect(result.tenantId).toBe('flux');
    expect(result.adminEmail).toBe('admin@flux.local');
    expect(result.action).toBe('UPDATE_SERVICE');
  });

  test('auditAdminAwaitable normalizes legacy tenant aliases (lovable -> flux)', async () => {
    const mockTx = {
      adminAuditLog: {
        create: (args: any) => Promise.resolve({ id: 'log-legacy', ...args.data }),
      },
    };

    const result = await auditAdminAwaitable({
      adminId: 'admin-1',
      adminEmail: 'admin@lovable.local',
      action: 'UPDATE_CONFIG',
      target: 'cfg-1',
      targetType: 'SETTINGS',
      tenantId: 'lovable',
      tx: mockTx,
    });

    expect(result.tenantId).toBe('flux');
  });

  test('auditAdminAwaitable resolves tenant context from AsyncLocalStorage tenantStorage', async () => {
    const mockTx = {
      adminAuditLog: {
        create: (args: any) => Promise.resolve({ id: 'log-als', ...args.data }),
      },
    };

    const result = await tenantStorage.run({ tenantId: 'flux' }, async () => {
      return await auditAdminAwaitable({
        adminId: 'admin-worker',
        adminEmail: 'worker@flux.local',
        action: 'EXECUTE_QUEUE_JOB',
        target: 'job-55',
        targetType: 'JOB',
        tx: mockTx,
      });
    });

    expect(result.tenantId).toBe('flux');
  });

  test('auditAdminAwaitable falls back to smmplan when no tenant context', async () => {
    const mockTx = {
      adminAuditLog: {
        create: (args: any) => Promise.resolve({ id: 'log-2', ...args.data }),
      },
    };

    const result = await auditAdminAwaitable({
      adminId: 'admin-2',
      adminEmail: 'admin@smmplan.pro',
      action: 'SETTINGS_UPDATE',
      target: 'settings-1',
      targetType: 'SETTINGS',
      tx: mockTx,
    });

    expect(result.tenantId).toBe('smmplan');
  });

  test('auditAdmin fire-and-forget creates log with resolved tenantId', async () => {
    const createSpy = vi.spyOn(db.adminAuditLog, 'create').mockResolvedValueOnce({
      id: 'log-faf',
      tenantId: 'flux',
      adminId: 'admin-faf',
      adminEmail: 'admin@flux.local',
      action: 'QUICK_ACTION',
      target: 'target-1',
      targetType: 'SERVICE',
      oldValue: null,
      newValue: null,
      ipAddress: null,
      createdAt: new Date(),
    } as any);

    auditAdmin({
      adminId: 'admin-faf',
      adminEmail: 'admin@flux.local',
      action: 'QUICK_ACTION',
      target: 'target-1',
      targetType: 'SERVICE',
      tenantId: 'flux',
    });

    // Wait for the fire-and-forget microtask to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'flux',
          adminId: 'admin-faf',
          action: 'QUICK_ACTION',
        }),
      })
    );

    createSpy.mockRestore();
  });
});

