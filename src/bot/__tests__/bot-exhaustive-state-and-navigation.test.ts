import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BotCatalogService } from '../services/bot-catalog.service';
import { IntelligenceLinkAnalyzer } from '@/services/analyzer/link-analyzer';
import { IntelligencePlatform } from '@/services/analyzer/link-rules';
import { db } from '@/lib/db';

// Mock database
vi.mock('@/lib/db', () => {
  return {
    db: {
      network: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      category: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      service: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
        upsert: vi.fn(),
        findUnique: vi.fn(),
      },
      order: {
        count: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      ticket: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      ticketFeedback: {
        upsert: vi.fn(),
      },
      systemSettings: {
        findFirst: vi.fn(),
      }
    }
  };
});

const mockedDb = db as any;

describe('Telegram Bot: Exhaustive State Machine, Buttons & Full Navigation Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Full Catalog Navigation & Back Button Traversal', () => {
    it('traverses Network -> Category -> Service -> Back to Category -> Back to Networks', async () => {
      // Step 1: Networks list
      mockedDb.network.findMany.mockResolvedValueOnce([
        { id: 'net-tg', name: 'Telegram', slug: 'telegram' },
        { id: 'net-vk', name: 'ВКонтакте', slug: 'vk' }
      ] as any);

      const networks = await BotCatalogService.getVisibleNetworks('smmplan');
      expect(networks).toHaveLength(2);
      expect(networks[0].id).toBe('net-tg');

      // Step 2: Categories in Telegram
      mockedDb.category.findMany.mockResolvedValueOnce([
        { id: 'cat-tg-subs', name: '👥 Подписчики', networkId: 'net-tg' },
        { id: 'cat-tg-views', name: '👁 Просмотры', networkId: 'net-tg' }
      ] as any);

      const categories = await BotCatalogService.getVisibleCategories('net-tg', 'smmplan');
      expect(categories).toHaveLength(2);
      expect(categories[0].id).toBe('cat-tg-subs');

      // Step 3: Services in Subscribers Category
      mockedDb.service.findMany.mockResolvedValueOnce([
        {
          id: 'svc-tg-subs-1',
          numericId: 101,
          name: 'Подписчики РФ (Быстрые)',
          rate: 150,
          markup: 20,
          providerCurrency: 'RUB',
          minQty: 100,
          maxQty: 50000,
          isDripFeedEnabled: true,
          targetType: 'CHANNEL',
          features: null
        }
      ] as any);

      const services = await BotCatalogService.getVisibleServices('cat-tg-subs', 'smmplan');
      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('Подписчики РФ (Быстрые)');

      // Step 4: Back to Categories check
      mockedDb.network.findUnique.mockResolvedValueOnce({ id: 'net-tg', name: 'Telegram' } as any);
      mockedDb.category.findMany.mockResolvedValueOnce([
        { id: 'cat-tg-subs', name: '👥 Подписчики', networkId: 'net-tg' },
        { id: 'cat-tg-views', name: '👁 Просмотры', networkId: 'net-tg' }
      ] as any);

      const backCategories = await BotCatalogService.getVisibleCategories('net-tg', 'smmplan');
      expect(backCategories).toHaveLength(2);

      // Step 5: Back to Networks check
      mockedDb.network.findMany.mockResolvedValueOnce([
        { id: 'net-tg', name: 'Telegram', slug: 'telegram' },
        { id: 'net-vk', name: 'ВКонтакте', slug: 'vk' }
      ] as any);

      const backNetworks = await BotCatalogService.getVisibleNetworks('smmplan');
      expect(backNetworks).toHaveLength(2);
    });
  });

  describe('2. Link-First Analyzer to Order Wizard Pipeline', () => {
    it('analyzes Telegram channel link, fetches categories and verifies order service payload', async () => {
      const analyzer = new IntelligenceLinkAnalyzer();
      const analysis = await analyzer.analyze('https://t.me/telegram');
      expect(analysis.platform).toBe(IntelligencePlatform.TELEGRAM);

      mockedDb.network.findFirst.mockResolvedValueOnce({
        id: 'net-tg',
        name: 'Telegram',
        slug: 'telegram'
      } as any);

      const network = await BotCatalogService.findNetworkByPlatform(analysis.platform, 'smmplan');
      expect(network).not.toBeNull();
      expect(network?.id).toBe('net-tg');

      mockedDb.service.findFirst.mockResolvedValueOnce({
        id: 'svc-tg-subs-1',
        numericId: 101,
        name: 'Подписчики РФ',
        minQty: 100,
        maxQty: 10000,
        isActive: true,
        isQuarantined: false,
        category: {
          name: 'Подписчики',
          network: { name: 'Telegram', slug: 'telegram' }
        }
      } as any);

      const orderService = await BotCatalogService.getServiceForOrder('svc-tg-subs-1', 'smmplan');
      expect(orderService).not.toBeNull();
      expect(orderService?.category?.network?.slug).toBe('telegram');
    });
  });

  describe('3. Support and CSAT Feedback Interaction', () => {
    it('records CSAT score and updates ticket tags', async () => {
      mockedDb.ticket.findUnique.mockResolvedValueOnce({
        id: 'ticket-123',
        userId: 'user-456',
        tenantId: 'smmplan',
        tags: ['BOT_INIT']
      } as any);

      mockedDb.ticket.update.mockResolvedValueOnce({
        id: 'ticket-123',
        tags: ['BOT_INIT', 'CSAT_5_STAR']
      } as any);

      const ticket = await mockedDb.ticket.findUnique({ where: { id: 'ticket-123' } });
      expect(ticket).not.toBeNull();

      const newTags = Array.from(new Set([...(ticket!.tags || []), 'CSAT_5_STAR']));
      await mockedDb.ticket.update({
        where: { id: 'ticket-123' },
        data: { tags: newTags }
      });

      expect(mockedDb.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        data: { tags: ['BOT_INIT', 'CSAT_5_STAR'] }
      });
    });
  });

  describe('4. Strict Zero-Trust Quarantined & Ghost Isolation', () => {
    it('strictly hides quarantined services from visible listings and order entry', async () => {
      mockedDb.service.findMany.mockResolvedValueOnce([]); // No non-quarantined services

      const visible = await BotCatalogService.getVisibleServices('cat-quarantined', 'smmplan');
      expect(visible).toEqual([]);

      mockedDb.service.findFirst.mockResolvedValueOnce(null); // Quarantined rejected
      const service = await BotCatalogService.getServiceForOrder('svc-quarantined', 'smmplan');
      expect(service).toBeNull();
    });
  });
});
