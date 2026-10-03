import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InHouseOrderDispatcher } from '@/workers/processors/order/in-house-order-dispatcher';
import type { OrderWithRelations } from '@/workers/processors/order/types';

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      update: vi.fn().mockResolvedValue({ id: 'ord_123', status: 'IN_PROGRESS' }),
    },
  },
}));

vi.mock('@/lib/queue-manager', () => ({
  getRedisConnection: vi.fn().mockReturnValue({
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  }),
}));

vi.mock('@/utils/ssrf-guard', () => ({
  assertSafeUrl: vi.fn().mockResolvedValue(undefined),
}));

describe('InHouseOrderDispatcher (Tier-0 Production Bridge)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockOrder = (overrides: {
    networkName?: string;
    serviceName?: string;
    activityType?: string;
    link?: string;
    runs?: number;
    quantity?: number;
    customData?: string;
  }): OrderWithRelations => {
    return {
      id: 'ord_test_001',
      numericId: 1001,
      userId: 'usr_001',
      serviceId: 'srv_001',
      link: overrides.link || 'https://t.me/mychannel',
      quantity: overrides.quantity || 1,
      charge: BigInt(5000),
      profitKopecks: BigInt(3000),
      status: 'PENDING',
      isDripFeed: false,
      runs: overrides.runs || null,
      interval: null,
      customData: overrides.customData || null,
      remains: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      tenantId: 'smmplan',
      providerId: null,
      providerServiceId: null,
      externalId: null,
      error: null,
      startCount: 0,
      paymentId: null,
      isCompensated: false,
      metadata: null,
      smartCampaignId: null,
      service: {
        id: 'srv_001',
        numericId: 101,
        name: overrides.serviceName || 'Бусты Telegram канала (Level Boost)',
        description: null,
        icon: null,
        features: null,
        categoryId: 'cat_001',
        providerId: null,
        providerServiceId: null,
        rate: 50.0,
        min: 1,
        max: 100,
        isActive: true,
        tenantId: 'smmplan',
        createdAt: new Date(),
        updatedAt: new Date(),
        category: {
          id: 'cat_001',
          name: 'Telegram Бусты',
          slug: 'tg-boosts',
          networkId: 'net_001',
          tenantId: 'smmplan',
          sort: 1,
          activityType: overrides.activityType || 'BOOSTS',
          requireWarning: false,
          warningMessage: null,
          analyzerTags: null,
          icon: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          network: {
            id: 'net_001',
            name: overrides.networkName || 'Telegram',
            slug: 'telegram',
            icon: null,
            sort: 1,
            isActive: true,
            tenantId: 'smmplan',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        provider: null,
      },
      user: {
        id: 'usr_001',
        email: 'client@example.com',
        tenantId: 'smmplan',
      },
      smartCampaign: null,
    } as unknown as OrderWithRelations;
  };

  it('должен возвращать true для бустов, реакций, просмотров Telegram и стримов Twitch/Kick', () => {
    const boostOrder = createMockOrder({ serviceName: 'Telegram Boosts', activityType: 'BOOSTS' });
    expect(InHouseOrderDispatcher.canHandleInHouse(boostOrder)).toBe(true);

    const reactionOrder = createMockOrder({ serviceName: 'Telegram Реакции 🔥', activityType: 'LIKES' });
    expect(InHouseOrderDispatcher.canHandleInHouse(reactionOrder)).toBe(true);

    const viewOrder = createMockOrder({ serviceName: 'Telegram Просмотры постов', activityType: 'VIEWS' });
    expect(InHouseOrderDispatcher.canHandleInHouse(viewOrder)).toBe(true);

    const twitchOrder = createMockOrder({ networkName: 'Twitch', link: 'https://twitch.tv/streamer', serviceName: 'Онлайн зрители на стрим' });
    expect(InHouseOrderDispatcher.canHandleInHouse(twitchOrder)).toBe(true);
  });

  it('должен возвращать false для внешних услуг (Instagram, VK)', () => {
    const instaOrder = createMockOrder({ networkName: 'Instagram', link: 'https://instagram.com/user', serviceName: 'Подписчики Instagram' });
    expect(InHouseOrderDispatcher.canHandleInHouse(instaOrder)).toBe(false);

    const vkOrder = createMockOrder({ networkName: 'ВКонтакте', link: 'https://vk.com/wall-123_456', serviceName: 'Лайки на стену VK' });
    expect(InHouseOrderDispatcher.canHandleInHouse(vkOrder)).toBe(false);
  });

  it('должен исполнять буст канала и обновлять статус заказа в IN_PROGRESS', async () => {
    const { getSharedTelegramExecutor } = await import('@/workers/processors/order/in-house-order-dispatcher');
    const executor = getSharedTelegramExecutor();

    // Регистрируем тестовую сессию с Premium
    executor.importSessionFromJson({
      phone: '+79998881122',
      has_premium: true,
      dc_id: 2,
    });

    const order = createMockOrder({
      serviceName: 'Буст канала 30 дней',
      link: 'https://t.me/target_channel',
    });

    const result = await InHouseOrderDispatcher.tryDispatchInHouse(order);

    expect(result.handled).toBe(true);
    expect(result.success).toBe(true);
    expect(result.externalOrderId).toContain('in_house_tg_');

    const { db } = await import('@/lib/db');
    expect(db.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: order.id },
        data: expect.objectContaining({
          status: 'IN_PROGRESS',
        }),
      })
    );
  });

  it('должен возвращать shouldFallbackToExternal = true при исчерпании свободных слотов буста', async () => {
    const order = createMockOrder({
      serviceName: 'Буст канала',
      link: 'https://t.me/overflow_channel',
    });

    // Запрашиваем буст на новый канал, когда все доступные слоты заняты
    const { getSharedTelegramExecutor } = await import('@/workers/processors/order/in-house-order-dispatcher');
    const executor = getSharedTelegramExecutor();

    // Занимаем все оставшиеся слоты
    for (let i = 0; i < 5; i++) {
      await executor.executeBoostChannel(`https://t.me/dummy_${i}`);
    }

    const result = await InHouseOrderDispatcher.tryDispatchInHouse(order);

    expect(result.handled).toBe(true);
    expect(result.success).toBe(false);
    expect(result.shouldFallbackToExternal).toBe(true);
  });

  it('должен исполнять реакцию и переводить статус в COMPLETED', async () => {
    const { getSharedTelegramExecutor } = await import('@/workers/processors/order/in-house-order-dispatcher');
    const executor = getSharedTelegramExecutor();
    executor.importSessionFromJson({
      phone: '+79998883344',
      has_premium: false,
      dc_id: 2,
    });

    const order = createMockOrder({
      serviceName: 'Реакции на пост 🔥',
      link: 'https://t.me/durov/100',
      customData: JSON.stringify({ emoji: '❤️' }),
    });

    const result = await InHouseOrderDispatcher.tryDispatchInHouse(order);

    expect(result.handled).toBe(true);
    expect(result.success).toBe(true);

    const { db } = await import('@/lib/db');
    expect(db.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: order.id },
        data: expect.objectContaining({
          status: 'COMPLETED',
          remains: 0,
        }),
      })
    );
  });

  it('должен исполнять просмотр поста через веб-шлюз и переводить статус в COMPLETED', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', mockFetch);

    const order = createMockOrder({
      serviceName: 'Просмотры постов',
      link: 'https://t.me/durov/200',
    });

    const result = await InHouseOrderDispatcher.tryDispatchInHouse(order);

    expect(result.handled).toBe(true);
    expect(result.success).toBe(true);

    const { db } = await import('@/lib/db');
    expect(db.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: order.id },
        data: expect.objectContaining({
          status: 'COMPLETED',
        }),
      })
    );
  });

  it('должен блокировать повторный вызов при активном distributed lock', async () => {
    const { getRedisConnection } = await import('@/lib/queue-manager');
    const redis = getRedisConnection();
    vi.mocked(redis.set).mockResolvedValueOnce(null as unknown as string); // Lock not acquired

    const order = createMockOrder({
      serviceName: 'Буст канала',
      link: 'https://t.me/concurrent_channel',
    });

    const result = await InHouseOrderDispatcher.tryDispatchInHouse(order);

    expect(result.handled).toBe(true);
    expect(result.success).toBe(false);
    expect(result.error).toBe('DISPATCH_LOCK_HELD');
  });

  it('должен отклонять заказ со статусом CANCELED при опасной ссылке (System 1 Decision Gate)', async () => {
    const order = createMockOrder({
      serviceName: 'Буст канала',
      link: 'https://malware-phishing.xyz/steal',
    });

    const result = await InHouseOrderDispatcher.tryDispatchInHouse(order);

    expect(result.handled).toBe(true);
    expect(result.success).toBe(false);
    expect(result.shouldFallbackToExternal).toBe(false);
    expect(result.error).toBe('MALICIOUS_LINK_REJECTED');

    const { db } = await import('@/lib/db');
    expect(db.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: order.id },
        data: expect.objectContaining({
          status: 'CANCELED',
          error: 'MALICIOUS_LINK_REJECTED',
        }),
      })
    );
  });
});

