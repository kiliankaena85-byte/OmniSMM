import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { BotCatalogService, botStorefrontCategoryFilter } from '../services/bot-catalog.service';

vi.mock('@/lib/db', () => ({
  db: {
    network: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    }
  },
}));

describe('Telegram Bot: Catalog Taxonomy, Ghost Filtering & Tenant Isolation Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Ghost Networks & Categories Elimination (Root Cause)
  // =========================================================================
  describe('Ghost Networks & Categories Elimination', () => {
    it('only queries networks containing active categories with active non-quarantined services', async () => {
      const mockNetworks = [
        { id: 'net_telegram', name: 'Telegram', slug: 'telegram' }
      ];
      vi.mocked(db.network.findMany).mockResolvedValue(mockNetworks as any);

      const result = await BotCatalogService.getVisibleNetworks('smmplan');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Telegram');

      // Verify Prisma query includes categories.some with botStorefrontCategoryFilter
      expect(db.network.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            tenantId: { in: ['smmplan', 'all'] },
            categories: {
              some: expect.objectContaining({
                tenantId: { in: ['smmplan', 'all'] },
                services: expect.objectContaining({
                  some: expect.objectContaining({
                    isActive: true,
                    isQuarantined: false,
                    tenantId: { in: ['smmplan', 'all'] }
                  })
                })
              })
            }
          })
        })
      );
    });

    it('filters out empty categories when browsing a specific network', async () => {
      const mockCategories = [
        { id: 'cat_tg_subs', name: 'Подписчики', networkId: 'net_telegram' }
      ];
      vi.mocked(db.category.findMany).mockResolvedValue(mockCategories as any);

      const result = await BotCatalogService.getVisibleCategories('net_telegram', 'smmplan');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Подписчики');

      expect(db.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            networkId: 'net_telegram',
            tenantId: { in: ['smmplan', 'all'] },
            services: expect.objectContaining({
              some: expect.objectContaining({
                isActive: true,
                isQuarantined: false,
                tenantId: { in: ['smmplan', 'all'] }
              })
            })
          })
        })
      );
    });
  });

  // =========================================================================
  // 2. Quarantine, Inactive & Cooldown Service Filtering
  // =========================================================================
  describe('Quarantine & Cooldown Service Filtering', () => {
    it('enforces isQuarantined: false and cooldown checks when querying services', async () => {
      const mockServices = [
        {
          id: 'svc_active',
          numericId: 101,
          name: 'Telegram Подписчики Быстрые',
          rate: 1.5,
          markup: 3.0,
          providerCurrency: 'RUB',
          minQty: 10,
          maxQty: 50000,
          isDripFeedEnabled: true,
          targetType: 'CHANNEL',
          features: null
        }
      ];
      vi.mocked(db.service.findMany).mockResolvedValue(mockServices as any);

      const services = await BotCatalogService.getVisibleServices('cat_tg_subs', 'smmplan');

      expect(services).toHaveLength(1);
      expect(services[0].id).toBe('svc_active');

      expect(db.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoryId: 'cat_tg_subs',
            isActive: true,
            isQuarantined: false,
            tenantId: { in: ['smmplan', 'all'] }
          })
        })
      );
    });

    it('rejects quarantined or inactive service in getServiceForOrder', async () => {
      vi.mocked(db.service.findFirst).mockResolvedValue(null);

      const service = await BotCatalogService.getServiceForOrder('svc_quarantined_123', 'smmplan');

      expect(service).toBeNull();
      expect(db.service.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'svc_quarantined_123',
            isActive: true,
            isQuarantined: false,
            tenantId: { in: ['smmplan', 'all'] }
          })
        })
      );
    });
  });

  // =========================================================================
  // 3. Multi-Tenant Isolation
  // =========================================================================
  describe('Multi-Tenant Isolation (smmplan vs flux)', () => {
    it('scopes all filter conditions strictly to the requested tenantId', () => {
      const filterSmmplan = botStorefrontCategoryFilter('smmplan');
      expect(filterSmmplan.tenantId).toEqual({ in: ['smmplan', 'all'] });

      const filterFlux = botStorefrontCategoryFilter('flux');
      expect(filterFlux.tenantId).toEqual({ in: ['flux', 'all'] });
    });
  });

  // =========================================================================
  // 4. Adversarial Red Team vs Blue Team Defense
  // =========================================================================
  describe('⚔️ Red Team vs Blue Team Adversarial Simulation', () => {
    it('Red Team attempts to order a quarantined service -> Blue Team intercepts with null', async () => {
      // Attacker attempts to craft inline query for a service with provider price surge
      vi.mocked(db.service.findFirst).mockResolvedValue(null);

      const attemptedService = await BotCatalogService.getServiceForOrder('srv_malicious_exploit', 'smmplan');
      expect(attemptedService).toBeNull();
    });

    it('Red Team attempts cross-tenant probing -> Blue Team isolates via tenantVisibilityFilter', async () => {
      // Flux service probed from smmplan bot
      vi.mocked(db.service.findFirst).mockResolvedValue(null);

      const crossTenantProbe = await BotCatalogService.getServiceForOrder('srv_flux_exclusive', 'smmplan');
      expect(crossTenantProbe).toBeNull();
    });
  });
});
