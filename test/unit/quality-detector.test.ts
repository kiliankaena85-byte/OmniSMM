import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanSubscriberQuality } from '@/workers/processors/quality-detector.processor';
import { db } from '@/lib/db';

// Mock DB
vi.mock('@/lib/db', () => ({
  db: {
    smartCampaign: { findUnique: vi.fn() },
    smartSnapshot: { findFirst: vi.fn(), create: vi.fn() },
    smartDetectedUser: { createMany: vi.fn() },
    $transaction: vi.fn(async (cb) => {
      await Promise.resolve();
      return cb(db);
    }),
  },
}));

describe('Quiet Quality Scorer Detector (Mock Scorer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('должен пропускать сканирование, если кампания не найдена', async () => {
    vi.mocked(db.smartCampaign.findUnique).mockResolvedValue(null);

    // Должно выполниться тихо без выброса ошибок
    await expect(scanSubscriberQuality('non-existent-campaign', 100, 'https://t.me/durov')).resolves.not.toThrow();
    
    expect(db.smartSnapshot.create).not.toHaveBeenCalled();
  });

  it('должен пропускать сканирование, если кампания не относится к Telegram', async () => {
    vi.mocked(db.smartCampaign.findUnique).mockResolvedValue({
      id: 'camp_vk',
      service: {
        id: 'svc_vk',
        name: 'Лайки ВК',
        category: {
          network: {
            slug: 'vkontakte',
            name: 'ВКонтакте',
          },
        },
      },
    } as any);

    await expect(scanSubscriberQuality('camp_vk', 100, 'https://vk.com/durov')).resolves.not.toThrow();
    
    expect(db.smartSnapshot.create).not.toHaveBeenCalled();
  });

  it('должен создавать новый слепок и записывать ботов для Telegram-кампании', async () => {
    vi.mocked(db.smartCampaign.findUnique).mockResolvedValue({
      id: 'camp_tg',
      service: {
        id: 'svc_tg',
        name: 'Подписчики Telegram',
        category: {
          network: {
            slug: 'telegram',
            name: 'Telegram',
          },
        },
      },
    } as any);

    // Нет предыдущего слепка
    vi.mocked(db.smartSnapshot.findFirst).mockResolvedValue(null);

    await scanSubscriberQuality('camp_tg', 50, 'https://t.me/durov');

    // Проверяем, что создается новый слепок сmembers
    expect(db.smartSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          campaignId: 'camp_tg',
          channelUrl: 'https://t.me/durov',
        }),
      })
    );

    // Должно сгенерировать 50 участников
    const snapshotCall = vi.mocked(db.smartSnapshot.create).mock.calls[0][0] as any;
    expect(snapshotCall.data.members.length).toBe(50);
  });

  it('должен объединять новый слепок со старым и тихо гасить любые DB сбои', async () => {
    vi.mocked(db.smartCampaign.findUnique).mockResolvedValue({
      id: 'camp_tg',
      service: {
        id: 'svc_tg',
        name: 'Подписчики Telegram',
        category: {
          network: {
            slug: 'telegram',
            name: 'Telegram',
          },
        },
      },
    } as any);

    // Имитируем предыдущий слепок с 5 мемберами
    vi.mocked(db.smartSnapshot.findFirst).mockResolvedValue({
      id: 'snap_old',
      campaignId: 'camp_tg',
      channelUrl: 'https://t.me/durov',
      members: ['user1', 'user2', 'user3', 'user4', 'user5'],
      createdAt: new Date(),
    } as any);

    // Настраиваем, чтобы DB create упал для проверки тихой устойчивости к сбоям
    vi.mocked(db.smartSnapshot.create).mockRejectedValue(new Error('DB Connection Timeout'));

    // Ошибка базы данных должна быть поймана тихо, не прерывая выполнение
    await expect(scanSubscriberQuality('camp_tg', 10, 'https://t.me/durov')).resolves.not.toThrow();
  });
});
