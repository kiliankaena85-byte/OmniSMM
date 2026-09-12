import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveStorefrontContext } from '@/lib/storefront/storefront-auth';
import { StorefrontKeyService } from '@/services/storefront/storefront-key.service';
import { db } from '@/lib/db';
import crypto from 'crypto';

// Мокируем модули
vi.mock('@/lib/db', () => ({
  db: {
    tenant: {
      findUnique: vi.fn(),
    },
    storefrontKey: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('Storefront Gateway API v1', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('storefront-auth (StorefrontAuth Context Resolver)', () => {
    it('should resolve context for a valid X-Storefront-Key', async () => {
      const rawToken = 'sk_live_1234567890';
      const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

      vi.mocked(db.storefrontKey.findUnique).mockResolvedValueOnce({
        id: 'sfk_123',
        tenantId: 'tenant_1',
        type: 'SECRET',
        keyPrefix: 'sk_live_123456',
        keyHash: hash,
        name: 'Test Key',
        isActive: true,
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        tenant: {
          id: 'tenant_1',
          slug: 'tenant-1',
          name: 'Tenant One',
          isActive: true,
        }
      } as any);

      vi.mocked(db.storefrontKey.update).mockResolvedValueOnce({} as any);

      const req = new Request('http://localhost', {
        headers: new Headers({
          'X-Storefront-Key': rawToken,
        }),
      }) as any;

      const ctx = await resolveStorefrontContext(req);

      expect(ctx).not.toBeNull();
      expect(ctx?.tenantId).toBe('tenant_1');
      expect(ctx?.keyType).toBe('secret');
      expect(ctx?.rateLimit).toBe(120);
    });

    it('should reject invalid keys', async () => {
      const req = new Request('http://localhost', {
        headers: new Headers({
          'X-Storefront-Key': 'pk_live_invalid',
        }),
      }) as any;

      vi.mocked(db.storefrontKey.findUnique).mockResolvedValueOnce(null);

      const ctx = await resolveStorefrontContext(req);
      expect(ctx).toBeNull();
    });

    it('should fallback to custom domain for publishable context', async () => {
      const req = new Request('http://investor-store.ru', {
        headers: new Headers({
          'Host': 'investor-store.ru',
        }),
      }) as any;

      vi.mocked(db.tenant.findUnique).mockResolvedValueOnce({
        id: 'tenant_2',
        slug: 'tenant-2',
        name: 'Tenant Two',
        isActive: true,
      } as any);

      const ctx = await resolveStorefrontContext(req);
      expect(ctx).not.toBeNull();
      expect(ctx?.tenantId).toBe('tenant_2');
      expect(ctx?.keyType).toBe('publishable');
    });
  });

  describe('Zero Vendor Leaks & BOLA Immunity', () => {
    it('StorefrontKeyService should securely hash keys', async () => {
      vi.mocked(db.storefrontKey.create).mockResolvedValueOnce({
        id: 'sfk_new',
      } as any);

      const { token, key } = await StorefrontKeyService.generateKey('tenant_3', 'PUBLISHABLE');
      expect(token.startsWith('pk_live_')).toBe(true);
      
      const createCall = vi.mocked(db.storefrontKey.create).mock.calls[0][0];
      
      expect(createCall.data.keyHash).toBeDefined();
      expect(createCall.data.keyHash).not.toBe(token);
    });
  });

});
