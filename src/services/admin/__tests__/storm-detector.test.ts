import { describe, it, expect, beforeEach, vi } from 'vitest';
import { stormDetectorService } from '../storm-detector.service';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findMany: vi.fn(),
    },
  },
}));

describe('StormDetectorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should ignore user-fault errors (private account, bad link) from storm calculations', async () => {
    (db.order.findMany as any).mockResolvedValue([
      {
        id: 'ord-1',
        numericId: 101,
        externalId: 'ext-101',
        status: 'CANCELED',
        error: 'Invalid link provided by user',
        userId: 'usr-1',
        serviceId: 'srv-1',
        service: {
          id: 'srv-1',
          name: 'Telegram Followers RU',
          provider: { name: 'HQ-Provider' },
          category: { name: 'Followers', network: { name: 'Telegram' } }
        }
      },
      {
        id: 'ord-2',
        numericId: 102,
        externalId: 'ext-102',
        status: 'COMPLETED',
        error: null,
        userId: 'usr-2',
        serviceId: 'srv-1',
        service: {
          id: 'srv-1',
          name: 'Telegram Followers RU',
          provider: { name: 'HQ-Provider' },
          category: { name: 'Followers', network: { name: 'Telegram' } }
        }
      }
    ]);

    const report = await stormDetectorService.auditServiceStorms({ windowHours: 24, minOrders: 2, minUsers: 1 });
    expect(report.criticalCount).toBe(0);
    expect(report.healthyCount).toBe(1);
    expect(report.alerts).toHaveLength(0);
  });

  it('should flag CRITICAL storm and generate 1-click ticket template when provider failure rate >= 45%', async () => {
    (db.order.findMany as any).mockResolvedValue([
      {
        id: 'ord-1',
        numericId: 201,
        externalId: 'ext-201',
        status: 'CANCELED',
        error: 'Provider API rejected task: Service down',
        userId: 'usr-1',
        serviceId: 'srv-storm',
        service: {
          id: 'srv-storm',
          name: 'Instagram Likes Speed',
          provider: { name: 'InstaProvider' },
          category: { name: 'Likes', network: { name: 'Instagram' } }
        }
      },
      {
        id: 'ord-2',
        numericId: 202,
        externalId: 'ext-202',
        status: 'CANCELED',
        error: 'Drop rate exceeded, refunded',
        userId: 'usr-2',
        serviceId: 'srv-storm',
        service: {
          id: 'srv-storm',
          name: 'Instagram Likes Speed',
          provider: { name: 'InstaProvider' },
          category: { name: 'Likes', network: { name: 'Instagram' } }
        }
      },
      {
        id: 'ord-3',
        numericId: 203,
        externalId: 'ext-203',
        status: 'COMPLETED',
        error: null,
        userId: 'usr-3',
        serviceId: 'srv-storm',
        service: {
          id: 'srv-storm',
          name: 'Instagram Likes Speed',
          provider: { name: 'InstaProvider' },
          category: { name: 'Likes', network: { name: 'Instagram' } }
        }
      }
    ]);

    const report = await stormDetectorService.auditServiceStorms({ windowHours: 24, minOrders: 2, minUsers: 2 });
    expect(report.criticalCount).toBe(1);
    expect(report.alerts).toHaveLength(1);
    
    const alert = report.alerts[0];
    expect(alert.serviceName).toBe('Instagram Likes Speed');
    expect(alert.failureRate).toBe(67);
    expect(alert.severity).toBe('CRITICAL');
    expect(alert.ticketTemplate).toContain('ext-201, ext-202');
    expect(alert.ticketTemplate).toContain('Instagram Likes Speed');
  });
});
