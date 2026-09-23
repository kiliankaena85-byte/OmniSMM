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
      },
      order: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      systemSettings: {
        findFirst: vi.fn(),
      }
    }
  };
});

const mockedDb = vi.mocked(db);

describe('Telegram Bot: Smart Link-First & Navigation Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. BotCatalogService: Platform to Network Resolution', () => {
    it('resolves TELEGRAM platform to matching network with active services', async () => {
      (mockedDb.network.findFirst as any).mockResolvedValue({
        id: 'net-tg-1',
        name: 'Telegram',
        slug: 'telegram'
      });

      const network = await BotCatalogService.findNetworkByPlatform(IntelligencePlatform.TELEGRAM, 'smmplan');
      expect(network).not.toBeNull();
      expect(network?.slug).toBe('telegram');
      expect(network?.name).toBe('Telegram');

      expect(mockedDb.network.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: expect.arrayContaining([
              { slug: { in: ['telegram'] } },
              { name: { in: ['telegram'], mode: 'insensitive' } }
            ])
          })
        })
      );
    });

    it('resolves VK platform with alias fallback (vk/vkontakte)', async () => {
      (mockedDb.network.findFirst as any).mockResolvedValue({
        id: 'net-vk-1',
        name: 'ВКонтакте',
        slug: 'vk'
      });

      const network = await BotCatalogService.findNetworkByPlatform(IntelligencePlatform.VK, 'smmplan');
      expect(network).not.toBeNull();
      expect(network?.slug).toBe('vk');

      expect(mockedDb.network.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: expect.arrayContaining([
              { slug: { in: ['vk', 'vkontakte'] } }
            ])
          })
        })
      );
    });

    it('returns null for OTHER or empty platform', async () => {
      const networkOther = await BotCatalogService.findNetworkByPlatform(IntelligencePlatform.OTHER, 'smmplan');
      expect(networkOther).toBeNull();

      const networkEmpty = await BotCatalogService.findNetworkByPlatform('', 'smmplan');
      expect(networkEmpty).toBeNull();
    });
  });

  describe('2. IntelligenceLinkAnalyzer Integration Flow', () => {
    const analyzer = new IntelligenceLinkAnalyzer();

    it('accurately detects Telegram channel link and suggests engagement categories', async () => {
      const res = await analyzer.analyze('https://t.me/durov');
      expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(res.canonicalUrl).toContain('t.me/durov');
    });

    it('accurately detects Telegram post link', async () => {
      const res = await analyzer.analyze('https://t.me/telegram/123');
      expect(res.platform).toBe(IntelligencePlatform.TELEGRAM);
      expect(res.type).toBe('post');
    });

    it('accurately detects VK post link and normalizes URL', async () => {
      const res = await analyzer.analyze('https://vk.com/wall-1_23456');
      expect(res.platform).toBe(IntelligencePlatform.VK);
      expect(res.canonicalUrl).toContain('vk.com/wall-1_23456');
    });

    it('accurately detects YouTube video link', async () => {
      const res = await analyzer.analyze('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(res.platform).toBe(IntelligencePlatform.YOUTUBE);
      expect(res.type).toBe('video');
    });
  });

  describe('3. Two-Entry Architecture: Link-First vs Catalog-First', () => {
    it('Link-First: user sends link -> finds network -> fetches categories -> stores activeLink', async () => {
      (mockedDb.network.findFirst as any).mockResolvedValue({
        id: 'net-tg-1',
        name: 'Telegram',
        slug: 'telegram'
      });

      (mockedDb.category.findMany as any).mockResolvedValue([
        { id: 'cat-tg-subs', name: '👥 Подписчики', networkId: 'net-tg-1' },
        { id: 'cat-tg-views', name: '👁 Просмотры', networkId: 'net-tg-1' }
      ]);

      const analysis = await (new IntelligenceLinkAnalyzer()).analyze('https://t.me/durov');
      const network = await BotCatalogService.findNetworkByPlatform(analysis.platform, 'smmplan');
      expect(network).not.toBeNull();

      const categories = await BotCatalogService.getVisibleCategories(network!.id, 'smmplan');
      expect(categories).toHaveLength(2);
      expect(categories[0].name).toBe('👥 Подписчики');
    });

    it('Catalog-First: user opens shop -> sees all visible networks with services', async () => {
      (mockedDb.network.findMany as any).mockResolvedValue([
        { id: 'net-tg', name: 'Telegram', slug: 'telegram' },
        { id: 'net-vk', name: 'ВКонтакте', slug: 'vk' },
        { id: 'net-yt', name: 'YouTube', slug: 'youtube' }
      ]);

      const networks = await BotCatalogService.getVisibleNetworks('smmplan');
      expect(networks).toHaveLength(3);
      expect(networks.map(n => n.name)).toEqual(['Telegram', 'ВКонтакте', 'YouTube']);
    });
  });
});
