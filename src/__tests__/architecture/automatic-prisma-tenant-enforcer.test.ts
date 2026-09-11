import { describe, it, expect, vi } from 'vitest';
import {
  runWithTenant,
  runWithTenantBypass,
  resolveActiveTenantId,
  isTenantBypassActive,
  getTenantBypassReason,
} from '@/lib/tenant-context';
import { createTenantEnforcerExtension } from '@/lib/prisma-tenant-enforcer';

describe('Automatic Prisma Tenant Enforcer (SDD-TDD 2026)', () => {
  describe('1. Tenant Context & AsyncLocalStorage', () => {
    it('should resolve active tenant inside runWithTenant', async () => {
      const result = await runWithTenant('flux', async () => {
        return resolveActiveTenantId();
      });
      expect(result).toBe('flux');
    });

    it('should handle nested runWithTenant contexts cleanly', async () => {
      await runWithTenant('smmplan', async () => {
        expect(resolveActiveTenantId()).toBe('smmplan');

        await runWithTenant('flux', async () => {
          expect(resolveActiveTenantId()).toBe('flux');
        });

        expect(resolveActiveTenantId()).toBe('smmplan');
      });
    });

    it('should track bypass and audit reason inside runWithTenantBypass', async () => {
      await runWithTenantBypass('Provider Outbox Worker', async () => {
        expect(isTenantBypassActive()).toBe(true);
        expect(getTenantBypassReason()).toBe('Provider Outbox Worker');
      });

      expect(isTenantBypassActive()).toBe(false);
      expect(getTenantBypassReason()).toBeUndefined();
    });
  });

  describe('2. Prisma Extension Auto-Scoping (BOLA/IDOR Defense)', () => {
    it('should automatically inject tenantId into findMany where clause', async () => {
      const mockQuery = vi.fn().mockResolvedValue([{ id: 'order-1', tenantId: 'flux' }]);
      const extension = createTenantEnforcerExtension();

      // Simulate findMany on order
      const orderExtension = extension.query?.order?.findMany;
      expect(orderExtension).toBeDefined();

      await runWithTenant('flux', async () => {
        const args: any = { where: { status: 'COMPLETED' } };
        await orderExtension!({ args, query: mockQuery });

        expect(args.where.tenantId).toBe('flux');
        expect(args.where.status).toBe('COMPLETED');
        expect(mockQuery).toHaveBeenCalledWith(args);
      });
    });

    it('should convert findUnique to findFirst with tenantId to prevent IDOR', async () => {
      const mockFindFirst = vi.fn().mockResolvedValue({ id: 'order-1', tenantId: 'flux' });
      const extension = createTenantEnforcerExtension({
        findFirstDelegate: mockFindFirst,
      });

      const orderFindUnique = extension.query?.order?.findUnique;
      expect(orderFindUnique).toBeDefined();

      await runWithTenant('flux', async () => {
        const args: any = { where: { id: 'order-secret-id' } };
        await orderFindUnique!({ args, query: vi.fn() });

        expect(mockFindFirst).toHaveBeenCalledWith({
          where: { id: 'order-secret-id', tenantId: 'flux' },
        });
      });
    });

    it('should reject create operation if data has mismatched tenantId', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ id: 'order-1' });
      const extension = createTenantEnforcerExtension();

      const orderCreate = extension.query?.order?.create;
      expect(orderCreate).toBeDefined();

      await runWithTenant('flux', async () => {
        const args: any = { data: { serviceId: 'srv-1', tenantId: 'smmplan' } }; // Spoofing attempt!

        await expect(
          orderCreate!({ args, query: mockQuery })
        ).rejects.toThrow(/SECURITY_TENANT_MISMATCH/);
      });
    });

    it('should automatically populate data.tenantId if omitted on create', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ id: 'order-1' });
      const extension = createTenantEnforcerExtension();

      const orderCreate = extension.query?.order?.create;
      expect(orderCreate).toBeDefined();

      await runWithTenant('flux', async () => {
        const args: any = { data: { serviceId: 'srv-1' } };
        await orderCreate!({ args, query: mockQuery });

        expect(args.data.tenantId).toBe('flux');
        expect(mockQuery).toHaveBeenCalledWith(args);
      });
    });

    it('should allow cross-tenant query when runWithTenantBypass is active', async () => {
      const mockQuery = vi.fn().mockResolvedValue([{ id: 'order-cross' }]);
      const extension = createTenantEnforcerExtension();

      const orderFindMany = extension.query?.order?.findMany;

      await runWithTenantBypass('Outbox Global Sync', async () => {
        const args: any = { where: { status: 'PENDING' } };
        await orderFindMany!({ args, query: mockQuery });

        // When bypass is active, tenantId should NOT be forced
        expect(args.where.tenantId).toBeUndefined();
        expect(mockQuery).toHaveBeenCalledWith(args);
      });
    });
  });
});
