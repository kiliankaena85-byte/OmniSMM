import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitOrderWithFallback, findAvailableProvider } from '../fallback-router';
import { ProviderCircuitBreaker } from '../circuit-breaker';
import { db } from '@/lib/db';

describe('PREM-08: Provider Fallback Router', () => {
  const serviceId = 'srv_tg_views_100';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('submits directly to primary provider when available and healthy', async () => {
    vi.spyOn(db.service, 'findUnique').mockResolvedValueOnce({
      providerId: 'provider_primary',
      externalId: 'ext_123',
    } as any);

    vi.spyOn(db.providerServiceBackup, 'findMany').mockResolvedValueOnce([]);

    const submitFn = vi.fn().mockResolvedValueOnce({
      success: true,
      providerOrderId: 'order_ext_999',
    });

    const res = await submitOrderWithFallback({
      orderId: 'order_internal_1',
      serviceId,
      submitFn,
    });

    expect(res.success).toBe(true);
    expect(res.usedProviderId).toBe('provider_primary');
    expect(res.providerOrderId).toBe('order_ext_999');
    expect(res.triedProviders).toEqual(['provider_primary']);
    expect(submitFn).toHaveBeenCalledTimes(1);
  });

  it('falls back to secondary provider when primary fails', async () => {
    vi.spyOn(db.service, 'findUnique').mockResolvedValue({
      providerId: 'provider_primary_flaky',
      externalId: 'ext_123',
    } as any);

    (vi.spyOn(db.providerServiceBackup, 'findMany') as any).mockImplementation(async (args: any) => {
      const excluded = args?.where?.backupProviderId?.notIn || [];
      if (excluded.includes('provider_backup_reliable')) return [];
      return [
        {
          id: 'b1',
          serviceId,
          primaryProviderId: 'provider_primary_flaky',
          backupProviderId: 'provider_backup_reliable',
          backupExternalId: 'ext_backup_456',
          priority: 1,
          isActive: true,
          createdAt: new Date(),
        },
      ];
    });

    const submitFn = vi.fn()
      .mockResolvedValueOnce({ success: false, error: 'Provider primary timeout' })
      .mockResolvedValueOnce({ success: true, providerOrderId: 'order_backup_777' });

    const res = await submitOrderWithFallback({
      orderId: 'order_internal_2',
      serviceId,
      submitFn,
    });

    expect(res.success).toBe(true);
    expect(res.usedProviderId).toBe('provider_backup_reliable');
    expect(res.providerOrderId).toBe('order_backup_777');
    expect(res.triedProviders).toEqual(['provider_primary_flaky', 'provider_backup_reliable']);
    expect(submitFn).toHaveBeenCalledTimes(2);
  });

  it('returns failure when all candidates are exhausted', async () => {
    vi.spyOn(db.service, 'findUnique').mockResolvedValue({
      providerId: 'provider_dead_1',
      externalId: 'ext_1',
    } as any);

    vi.spyOn(db.providerServiceBackup, 'findMany').mockResolvedValue([]);

    const submitFn = vi.fn().mockResolvedValue({
      success: false,
      error: 'Upstream gateway 502',
    });

    const res = await submitOrderWithFallback({
      orderId: 'order_internal_3',
      serviceId,
      submitFn,
    });

    expect(res.success).toBe(false);
    expect(res.triedProviders).toEqual(['provider_dead_1']);
    expect(res.error).toContain('Все провайдеры недоступны');
  });
});
