/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Created by Artem (http://artmspektr.ru)
 * Unauthorized copying of this file is strictly prohibited.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { IntelligenceLinkAnalyzer } from '@/services/analyzer/link-analyzer';
import { IntelligencePlatform } from '@/services/analyzer/link-rules';
import { Decimal } from 'decimal.js';

vi.mock('@/lib/db', () => ({
  db: {
    service: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    }
  },
}));

describe('Bot Integration Logic', () => {
  const mockedDb = db as unknown as {
    service: { findMany: any, findUnique: any },
    user: { upsert: any, findUnique: any }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Flow: Analyze Link -> Find Services', async () => {
    const userLink = 'https://t.me/test_channel';
    const analyzer = new IntelligenceLinkAnalyzer();
    const analysis = await analyzer.analyze(userLink);

    expect(analysis).not.toBeNull();
    expect(analysis?.platform).toBe(IntelligencePlatform.TELEGRAM);

    const mockServices = [
      { id: 'svc1', name: 'Test Service', rate: 1.0, category: { name: 'SUBSCRIBERS' } }
    ];
    mockedDb.service.findMany.mockResolvedValue(mockServices);

    const foundServices = await db.service.findMany({
      take: 200,
      where: {
        category: { network: { name: analysis.platform } }
      }
    });

    expect(mockedDb.service.findMany).toHaveBeenCalled();
    expect(foundServices).toHaveLength(1);
    expect(foundServices[0].id).toBe('svc1');
  });

  it('Flow: Select Service -> Calculate Price', async () => {
    const serviceId = 'svc1';
    const quantity = 500;

    const mockService = {
      id: serviceId,
      name: 'Test Service',
      rate: 1.05, 
      markup: 3.0,
      minQty: 100,
      maxQty: 10000
    };

    mockedDb.service.findUnique.mockResolvedValue(mockService);

    const service = await db.service.findUnique({ where: { id: serviceId } });
    expect(service).toBeDefined();

    if (service) {
      // Internal Math: rate * USD_TO_RUB (approx 95) * markup = ~100 * 3 = 300 RUB
      const BASE_RATE = service.rate;
      const total = BASE_RATE * 95 * service.markup * (quantity / 1000);
      expect(Math.floor(total)).toBeGreaterThan(0);
    }
  });
});
