import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SlaTelemetryEngine } from '@/services/telemetry/sla-telemetry-engine.service';
import { SentinelConciergeService } from '@/services/support/sentinel-concierge.service';
import { SmartRecoveryEngine } from '@/services/provider/smart-recovery.engine';
import { CxCompensationGateService } from '@/services/financial/cx-compensation-gate.service';
import { CxApologyBonusService } from '@/services/financial/cx-apology-bonus.service';
import { VipSentimentEscalatorService } from '@/services/support/vip-sentiment-escalator.service';
import { db } from '@/lib/db';

describe('Stage 4: Sentinel AI Order Concierge, Real-time SLA Telemetry & Smart Recovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. SlaTelemetryEngine percentile computation', () => {
    it('computes exact P50, P90, P99 from latency samples', () => {
      const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const { p50, p90, p99 } = SlaTelemetryEngine.computePercentiles(latencies);

      expect(p50).toBe(50);
      expect(p90).toBe(90);
      expect(p99).toBe(100);
    });

    it('returns standard fallback percentiles on empty sample set', () => {
      const { p50, p90, p99 } = SlaTelemetryEngine.computePercentiles([]);
      expect(p50).toBe(300);
      expect(p90).toBe(1800);
      expect(p99).toBe(7200);
    });
  });

  describe('2. SentinelConciergeService Delay Detection', () => {
    it('detects orders exceeding P90 and suggests HOT_SWAP_READY when exceeding P99', async () => {
      const mockOrder = {
        id: 'ord_delayed_1',
        userId: 'usr_test',
        providerId: 'prov_slow',
        status: 'IN_PROGRESS',
        createdAt: new Date(Date.now() - 4000 * 1000), // 4000s ago
        service: { name: 'Telegram Members HQ' },
        user: { id: 'usr_test', telegramId: '123456', email: 'test@example.com' },
      };

      vi.spyOn(db.order, 'findUnique').mockResolvedValue(mockOrder as any);
      vi.spyOn(SlaTelemetryEngine, 'getProviderSlaSnapshot').mockResolvedValue({
        providerId: 'prov_slow',
        p50Seconds: 300,
        p90Seconds: 1800,
        p99Seconds: 3600, // 4000s > 3600s
        sampleCount: 50,
        isDegraded: true,
        calculatedAt: new Date().toISOString(),
      });

      const alert = await SentinelConciergeService.evaluateOrderHealth('ord_delayed_1');

      expect(alert).not.toBeNull();
      expect(alert?.suggestedAction).toBe('HOT_SWAP_READY');
      expect(alert?.elapsedSeconds).toBeGreaterThanOrEqual(4000);
    });
  });

  describe('3. SmartRecoveryEngine 1-Click Hot-Swap', () => {
    it('swaps failing order to fallback provider route and records delta', async () => {
      const mockOrder = {
        id: 'ord_to_swap',
        userId: 'usr_test',
        providerId: 'prov_failing',
        quantity: 1000,
        providerCost: BigInt(10000), // 100.00 RUB
        service: {
          rate: 120.0, // 120.00 RUB -> 12000 cents (20.00 RUB delta)
          routes: [
            {
              id: 'route_primary',
              providerId: 'prov_failing',
              priority: 1,
              isActive: true,
              provider: { isActive: true },
            },
            {
              id: 'route_backup',
              providerId: 'prov_backup',
              priority: 2,
              isActive: true,
              provider: { isActive: true },
            },
          ],
        },
      };

      vi.spyOn(db.order, 'findUnique').mockResolvedValue(mockOrder as any);

      const incidentCreateMock = vi.fn().mockResolvedValue({});
      const orderUpdateMock = vi.fn().mockResolvedValue({ id: 'ord_to_swap' });

      vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          orderRecoveryIncident: { create: incidentCreateMock },
          order: { update: orderUpdateMock },
        });
      });

      const result = await SmartRecoveryEngine.executeHotSwap('ord_to_swap', 'API timeout error');

      expect(result.success).toBe(true);
      expect(result.swappedProviderId).toBe('prov_backup');
      expect(result.absorbedDeltaCents).toBe(BigInt(2000)); // 20.00 RUB delta
      expect(incidentCreateMock).toHaveBeenCalled();
      expect(orderUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord_to_swap' },
          data: expect.objectContaining({ providerId: 'prov_backup', status: 'IN_PROGRESS' }),
        })
      );
    });
  });

  describe('4. CxCompensationGateService 5-Point Screening', () => {
    it('rejects fresh accounts under 72h from receiving compensation', async () => {
      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: 'usr_new',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day old
        payments: [{ amount: BigInt(50000) }],
        cxCompensations: [],
      } as any);

      const gate = await CxCompensationGateService.evaluateCompensationEligibility('usr_new', BigInt(1000));
      expect(gate.allowed).toBe(false);
      expect(gate.rejectionReason).toContain('Account age');
    });

    it('rejects accounts with insufficient lifetime deposits (< 300 RUB)', async () => {
      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: 'usr_low_deposit',
        createdAt: new Date(Date.now() - 100 * 60 * 60 * 1000), // 4 days old
        payments: [{ amount: BigInt(10000) }], // Only 100 RUB
        cxCompensations: [],
      } as any);

      const gate = await CxCompensationGateService.evaluateCompensationEligibility('usr_low_deposit', BigInt(1000));
      expect(gate.allowed).toBe(false);
      expect(gate.rejectionReason).toContain('Total lifetime deposit');
    });

    it('allows valid mature accounts within daily bonus cap', async () => {
      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: 'usr_valid',
        createdAt: new Date(Date.now() - 200 * 60 * 60 * 1000),
        payments: [{ amount: BigInt(100000) }], // 1000 RUB
        cxCompensations: [],
      } as any);

      const gate = await CxCompensationGateService.evaluateCompensationEligibility('usr_valid', BigInt(2000));
      expect(gate.allowed).toBe(true);
    });
  });

  describe('5. CxApologyBonusService Non-Withdrawable Bonus Wallet', () => {
    it('credits bonusBalance and writes LedgerEntry without changing withdrawable User.balance', async () => {
      vi.spyOn(CxCompensationGateService, 'evaluateCompensationEligibility').mockResolvedValue({ allowed: true });

      const mockUser = {
        id: 'usr_bonus_test',
        balance: BigInt(50000), // 500.00 RUB
        bonusBalance: BigInt(1000), // 10.00 RUB
        tenantId: 'smmplan',
      };

      const ledgerCreateMock = vi.fn().mockResolvedValue({});
      const userUpdateMock = vi.fn().mockResolvedValue({});
      const compCreateMock = vi.fn().mockResolvedValue({});

      vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          user: {
            findUnique: vi.fn().mockResolvedValue(mockUser),
            update: userUpdateMock,
          },
          ledgerEntry: { create: ledgerCreateMock },
          cxApologyCompensation: { create: compCreateMock },
        });
      });

      const res = await CxApologyBonusService.grantApologyBonus(
        'usr_bonus_test',
        'ord_123',
        BigInt(2000),
        'Delay compensation'
      );

      expect(res.success).toBe(true);
      expect(userUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'usr_bonus_test' },
          data: { bonusBalance: BigInt(3000) }, // 1000 + 2000
        })
      );
      expect(ledgerCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transactionType: 'COMPENSATION',
            amount: BigInt(2000),
            userId: 'usr_bonus_test',
            status: 'APPROVED',
          }),
        })
      );
    });
  });

  describe('6. VipSentimentEscalatorService Sentiment Routing', () => {
    it('escalates angry VIP client to VIP_DESK with 60s SLA', async () => {
      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: 'usr_vip',
        orders: [{ charge: BigInt(6000000) }], // 60,000 RUB spend
      } as any);

      const verdict = await VipSentimentEscalatorService.evaluateEscalation(
        'usr_vip',
        'Где заказ? Это обман, я пойду в Роспотребнадзор и суд!'
      );

      expect(verdict.shouldEscalate).toBe(true);
      expect(verdict.priorityLevel).toBe('CRITICAL_P0');
      expect(verdict.assignedQueue).toBe('VIP_DESK');
      expect(verdict.slaTargetSeconds).toBe(60);
    });
  });
});
