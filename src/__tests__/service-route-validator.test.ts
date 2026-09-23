import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assertValidServiceRoute, ServiceRouteValidationError } from '@/lib/validators/service-route-validator';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => {
  const fn = vi.fn();
  return {
    db: {
      service: {
        findUnique: fn,
        findFirst: fn,
      },
    },
  };
});

describe('ServiceRouteValidator Invariant Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects empty or whitespace providerServiceId', async () => {
    await expect(assertValidServiceRoute({
      serviceId: 'srv-1',
      providerId: 'prv-1',
      providerServiceId: '   ',
    })).rejects.toThrow('ID услуги у провайдера (providerServiceId) не может быть пустым');
  });

  it('rejects when service is not found in database', async () => {
    vi.mocked(db.service.findUnique).mockResolvedValue(null);

    await expect(assertValidServiceRoute({
      serviceId: 'non-existent',
      providerId: 'prv-1',
      providerServiceId: '2470',
    })).rejects.toThrow('не найдена в базе данных');
  });

  it('CRITICAL: strictly blocks providerServiceId when it matches internal numericId', async () => {
    vi.mocked(db.service.findUnique).mockResolvedValue({
      id: 'srv-1',
      name: 'Telegram Подписчики',
      numericId: 1315,
      externalId: '2470',
      providerId: 'prv-vexboost',
    } as any);

    // Attempt to pass internal numericId 1315
    await expect(assertValidServiceRoute({
      serviceId: 'srv-1',
      providerId: 'prv-vexboost',
      providerServiceId: '1315',
    })).rejects.toThrow('КРИТИЧЕСКИЙ СБОЙ МАППИНГА');
  });

  it('allows valid external providerServiceId that matches provider catalog', async () => {
    vi.mocked(db.service.findUnique).mockResolvedValue({
      id: 'srv-1',
      name: 'Telegram Подписчики',
      numericId: 1315,
      externalId: '2470',
      providerId: 'prv-vexboost',
    } as any);

    const result = await assertValidServiceRoute({
      serviceId: 'srv-1',
      providerId: 'prv-vexboost',
      providerServiceId: '2470',
    });

    expect(result.valid).toBe(true);
    expect(result.serviceName).toBe('Telegram Подписчики');
  });
});
