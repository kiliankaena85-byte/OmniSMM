/**
 * Challenger 2: Empirical UI Resilience & Malformed Data Tests
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ProviderBalanceCell } from '@/app/admin/providers/components/provider-balance-cell';
import { ProviderLiquidityWidget } from '@/app/admin/dashboard/ProviderLiquidityWidget';
import * as balanceActions from '@/actions/admin/providers/balance';
import { CachedProviderBalance, GlobalLiquiditySummary } from '@/services/admin/provider-balance.service';

vi.mock('@/actions/admin/providers/balance', () => ({
  getProviderBalanceAction: vi.fn(),
  getGlobalProviderLiquidityAction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    $disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Challenger 2 — UI Render Resilience & Malformed Data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ProviderBalanceCell Resilience', () => {
    it('renders healthy initialData correctly with formatted balance and currency', () => {
      const initial: CachedProviderBalance = {
        providerId: 'prov-1',
        providerName: 'Provider One',
        balance: 1250.5,
        rawBalance: '1250.50',
        currency: 'USD',
        balanceUsd: 1250.5,
        balanceRub: 125050,
        status: 'healthy',
        latencyMs: 45,
        cachedAt: Date.now() - 5000,
        expiresAt: Date.now() + 55000,
      };

      render(<ProviderBalanceCell providerId="prov-1" initialData={initial} />);
      expect(screen.getByText(/1.*250,5/)).toBeDefined();
      expect(screen.getByText('USD')).toBeDefined();
    });

    it('renders warning initialData correctly', () => {
      const initial: CachedProviderBalance = {
        providerId: 'prov-2',
        providerName: 'Provider Two',
        balance: 35.0,
        rawBalance: '35.00',
        currency: 'USD',
        balanceUsd: 35.0,
        balanceRub: 3500,
        status: 'warning',
        latencyMs: 60,
        cachedAt: Date.now() - 10000,
        expiresAt: Date.now() + 50000,
      };

      render(<ProviderBalanceCell providerId="prov-2" initialData={initial} />);
      expect(screen.getByText('35')).toBeDefined();
    });

    it('renders critical initialData correctly without crashing', () => {
      const initial: CachedProviderBalance = {
        providerId: 'prov-3',
        providerName: 'Provider Three',
        balance: 4.5,
        rawBalance: '4.50',
        currency: 'USD',
        balanceUsd: 4.5,
        balanceRub: 450,
        status: 'critical',
        latencyMs: 90,
        cachedAt: Date.now(),
        expiresAt: Date.now() + 60000,
      };

      render(<ProviderBalanceCell providerId="prov-3" initialData={initial} />);
      expect(screen.getByText('4,5')).toBeDefined();
    });

    it('renders error status with error badge and suggestedFix tooltip without throwing', () => {
      const initial: CachedProviderBalance = {
        providerId: 'prov-err',
        providerName: 'Broken Provider',
        balance: 0,
        rawBalance: '0',
        currency: 'USD',
        balanceUsd: 0,
        balanceRub: 0,
        status: 'error',
        latencyMs: 5000,
        cachedAt: Date.now(),
        expiresAt: Date.now() + 15000,
        error: 'Неверный API-ключ (HTTP 401)',
        suggestedFix: 'Проверьте API-ключ в настройках',
      };

      render(<ProviderBalanceCell providerId="prov-err" initialData={initial} />);
      expect(screen.getByText('Сбой API')).toBeDefined();
    });

    it('handles malformed initialData with unknown status safely without throwing', () => {
      const malformed = {
        providerId: 'prov-malformed',
        providerName: undefined,
        balance: NaN,
        rawBalance: null as any,
        currency: '',
        balanceUsd: 0,
        balanceRub: 0,
        status: 'unknown' as any,
        latencyMs: 0,
        cachedAt: 0,
        expiresAt: 0,
      } as unknown as CachedProviderBalance;

      expect(() => {
        render(<ProviderBalanceCell providerId="prov-malformed" initialData={malformed} />);
      }).not.toThrow();
    });

    it('handles server action failure ({ success: false, error: "Network Error" }) gracefully', async () => {
      vi.mocked(balanceActions.getProviderBalanceAction).mockResolvedValue({
        success: false,
        error: 'Network timeout',
      });

      render(<ProviderBalanceCell providerId="prov-network-fail" />);

      await waitFor(() => {
        expect(screen.getByText('Сбой API')).toBeDefined();
      });
    });

    it('handles unexpected server action rejection (throw Error) gracefully without unhandled exception', async () => {
      vi.mocked(balanceActions.getProviderBalanceAction).mockRejectedValue(new Error('Fatal connection crash'));

      render(<ProviderBalanceCell providerId="prov-crash" />);

      await waitFor(() => {
        expect(screen.getByText('Сбой API')).toBeDefined();
      });
    });
  });

  describe('ProviderLiquidityWidget Resilience', () => {
    it('renders complete liquidity summary data correctly', async () => {
      const summary: GlobalLiquiditySummary = {
        totalRub: 250000,
        totalUsd: 2500,
        activeCount: 4,
        healthyCount: 2,
        warningCount: 1,
        criticalCount: 1,
        errorCount: 0,
        burnRate24hRub: 15000,
        runwayDays: 16,
        providers: [],
        cachedAt: Date.now(),
      };

      vi.mocked(balanceActions.getGlobalProviderLiquidityAction).mockResolvedValue({
        success: true,
        ...summary,
        data: summary,
      });

      render(<ProviderLiquidityWidget />);

      await waitFor(() => {
        expect(screen.getByText('Провайдеры (4)')).toBeDefined();
      });
      expect(screen.getByText(/16\s*дн/)).toBeDefined();
      expect(screen.getAllByText(/₽/).length).toBeGreaterThan(0);
    });

    it('handles all-zero liquidity and null runway days without crashing', async () => {
      const zeroSummary: GlobalLiquiditySummary = {
        totalRub: 0,
        totalUsd: 0,
        activeCount: 0,
        healthyCount: 0,
        warningCount: 0,
        criticalCount: 0,
        errorCount: 0,
        burnRate24hRub: 0,
        runwayDays: null,
        providers: [],
        cachedAt: Date.now(),
      };

      vi.mocked(balanceActions.getGlobalProviderLiquidityAction).mockResolvedValue({
        success: true,
        ...zeroSummary,
        data: zeroSummary,
      });

      render(<ProviderLiquidityWidget />);

      await waitFor(() => {
        expect(screen.getByText('Провайдеры (0)')).toBeDefined();
      });
      expect(screen.getByText('Требует пополнения')).toBeDefined(); // totalRub < 5000 isDanger
      expect(screen.getAllByText(/₽/).length).toBeGreaterThan(0);
    });

    it('handles short runway (< 3 days) with critical indicator badge', async () => {
      const criticalRunway: GlobalLiquiditySummary = {
        totalRub: 4000,
        totalUsd: 40,
        activeCount: 2,
        healthyCount: 0,
        warningCount: 0,
        criticalCount: 2,
        errorCount: 0,
        burnRate24hRub: 2000,
        runwayDays: 2,
        providers: [],
        cachedAt: Date.now(),
      };

      vi.mocked(balanceActions.getGlobalProviderLiquidityAction).mockResolvedValue({
        success: true,
        ...criticalRunway,
        data: criticalRunway,
      });

      render(<ProviderLiquidityWidget />);

      await waitFor(() => {
        expect(screen.getByText(/2\s*дн/)).toBeDefined();
      });
      expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1); // matches criticalCount badge and provider count
    });

    it('handles server action error response gracefully by displaying error fallback', async () => {
      vi.mocked(balanceActions.getGlobalProviderLiquidityAction).mockResolvedValue({
        success: false,
        error: 'Database connection failed',
      });

      render(<ProviderLiquidityWidget />);

      await waitFor(() => {
        expect(screen.getByText('Database connection failed')).toBeDefined();
      });
      expect(screen.getByText('Повторить')).toBeDefined();
      expect(screen.getByText('Проверить провайдеров →')).toBeDefined();
    });

    it('handles server action thrown exception without unhandled crash', async () => {
      vi.mocked(balanceActions.getGlobalProviderLiquidityAction).mockRejectedValueOnce(new Error('Fatal RPC Error'));

      render(<ProviderLiquidityWidget />);

      await waitFor(() => {
        expect(screen.getByText('Fatal RPC Error')).toBeDefined();
      });
      expect(screen.getByText('Повторить')).toBeDefined();
    });
  });
});
