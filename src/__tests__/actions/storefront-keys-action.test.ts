import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  listStorefrontKeysAction, 
  generateStorefrontKeyAction, 
  revokeStorefrontKeyAction 
} from '@/actions/admin/storefront-keys';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    storefrontKey: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn(async (section, action, fn) => {
    return fn({ id: 'staff_1', email: 'admin@smmplan.pro', role: 'OWNER' });
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/admin-audit', () => ({
  auditAdminAwaitable: vi.fn().mockResolvedValue(true),
}));

describe('Admin Storefront Keys Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listStorefrontKeysAction', () => {
    it('should list keys for the specified tenant', async () => {
      const mockKeys = [
        {
          id: 'key_1',
          tenantId: 'smmplan',
          type: 'PUBLISHABLE',
          keyPrefix: 'pk_live_12345678',
          name: 'Public Web App',
          isActive: true,
          lastUsedAt: null,
          createdAt: new Date(),
        },
      ];

      vi.mocked(db.storefrontKey.findMany).mockResolvedValueOnce(mockKeys as any);

      const result = await listStorefrontKeysAction('smmplan');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(db.storefrontKey.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'smmplan' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('generateStorefrontKeyAction', () => {
    it('should validate input and generate a key', async () => {
      vi.mocked(db.storefrontKey.create).mockResolvedValueOnce({
        id: 'new_key_id',
        tenantId: 'smmplan',
        type: 'SECRET',
        keyPrefix: 'sk_live_abc12345',
        name: 'Backend Gateway',
        isActive: true,
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await generateStorefrontKeyAction({
        tenantId: 'smmplan',
        type: 'SECRET',
        name: 'Backend Gateway',
      });

      expect(result.success).toBe(true);
      expect(result.data?.token).toMatch(/^sk_live_/);
      expect(result.data?.key.id).toBe('new_key_id');
      expect(db.storefrontKey.create).toHaveBeenCalled();
    });

    it('should fail with invalid name', async () => {
      const result = await generateStorefrontKeyAction({
        tenantId: 'smmplan',
        type: 'SECRET',
        name: 'a', // Too short
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('revokeStorefrontKeyAction', () => {
    it('should deactivate the key if found for tenant', async () => {
      vi.mocked(db.storefrontKey.findFirst).mockResolvedValueOnce({
        id: 'key_to_revoke',
        tenantId: 'smmplan',
        isActive: true,
      } as any);

      vi.mocked(db.storefrontKey.update).mockResolvedValueOnce({
        id: 'key_to_revoke',
        isActive: false,
      } as any);

      const result = await revokeStorefrontKeyAction({
        id: 'key_to_revoke',
        tenantId: 'smmplan',
      });

      expect(result.success).toBe(true);
      expect(db.storefrontKey.update).toHaveBeenCalledWith({
        where: { id: 'key_to_revoke' },
        data: { isActive: false },
      });
    });

    it('should fail if key not found for tenant', async () => {
      vi.mocked(db.storefrontKey.findFirst).mockResolvedValueOnce(null);

      const result = await revokeStorefrontKeyAction({
        id: 'non_existent',
        tenantId: 'smmplan',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Ключ не найден');
    });
  });
});
