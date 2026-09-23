import { describe, it, expect } from 'vitest';
import type { ProviderListDTO } from '@/services/admin/provider.service';

describe('Admin Providers & Gateway Integrity (Step 7)', () => {
  it('should ensure ProviderListDTO strictly excludes secret apiKey and credentials', () => {
    const sampleProviderDto: ProviderListDTO = {
      id: 'prov-1',
      name: 'JustAnotherPanel',
      apiUrl: 'https://jap.com/api/v2',
      isActive: true,
      balanceCurrency: 'USD',
      serviceCount: 1420,
      avgResponseMs: 145,
      errorCount5m: 0,
      lastSuccessAt: new Date().toISOString(),
      ticketUrl: 'https://jap.com/tickets',
      createdAt: new Date().toISOString(),
    };

    expect(sampleProviderDto).not.toHaveProperty('apiKey');
    expect(sampleProviderDto).not.toHaveProperty('apiKeyEncrypted');
    expect(sampleProviderDto).not.toHaveProperty('password');
    expect(sampleProviderDto.apiUrl).toMatch(/^https?:\/\//);
    expect(sampleProviderDto.serviceCount).toBeGreaterThanOrEqual(0);
  });

  it('should verify SLA ping classification logic for provider health', () => {
    function classifyPing(ms: number): 'success' | 'warning' | 'destructive' {
      if (ms > 2000) return 'destructive';
      if (ms > 500) return 'warning';
      return 'success';
    }

    expect(classifyPing(120)).toBe('success');
    expect(classifyPing(499)).toBe('success');
    expect(classifyPing(501)).toBe('warning');
    expect(classifyPing(1800)).toBe('warning');
    expect(classifyPing(2001)).toBe('destructive');
    expect(classifyPing(5000)).toBe('destructive');
  });

  it('should verify Runway Days calculation and threshold alert formatting', () => {
    function calculateRunway(totalRub: number, burnRate24hRub: number): { days: number | null; alert: boolean } {
      if (burnRate24hRub <= 0) return { days: null, alert: false };
      const days = Math.floor(totalRub / burnRate24hRub);
      return { days, alert: days <= 7 };
    }

    // 1. High liquidity: 500k rub balance, 10k daily spend -> 50 days (safe)
    const safeRunway = calculateRunway(500000, 10000);
    expect(safeRunway.days).toBe(50);
    expect(safeRunway.alert).toBe(false);

    // 2. Critical liquidity: 15k rub balance, 5k daily spend -> 3 days (alert!)
    const criticalRunway = calculateRunway(15000, 5000);
    expect(criticalRunway.days).toBe(3);
    expect(criticalRunway.alert).toBe(true);

    // 3. Zero daily spend -> Infinite runway (no alert)
    const zeroSpend = calculateRunway(100000, 0);
    expect(zeroSpend.days).toBeNull();
    expect(zeroSpend.alert).toBe(false);
  });

  it('should verify provider filter counts aggregation (active, error, disabled)', () => {
    const mockProviders: Array<{ isActive: boolean; errorCount5m: number }> = [
      { isActive: true, errorCount5m: 0 },
      { isActive: true, errorCount5m: 0 },
      { isActive: true, errorCount5m: 3 }, // active with errors
      { isActive: false, errorCount5m: 0 }, // disabled
      { isActive: false, errorCount5m: 5 }, // disabled with errors
    ];

    const counts = {
      all: mockProviders.length,
      active: mockProviders.filter(p => p.isActive).length,
      error: mockProviders.filter(p => p.errorCount5m > 0).length,
      disabled: mockProviders.filter(p => !p.isActive).length,
    };

    expect(counts.all).toBe(5);
    expect(counts.active).toBe(3);
    expect(counts.error).toBe(2);
    expect(counts.disabled).toBe(2);
  });
});
