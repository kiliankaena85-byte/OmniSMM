import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiEconomicOptimizerService } from '@/services/pricing/ai-economic-optimizer.service';
import aiEconomicOptimizerProcessor from '@/workers/processors/ai-economic-optimizer.processor';
import { db } from '@/lib/db';
import { MutexManager } from '@/lib/redis-lock';

describe('Stage 2: BullMQ Nightly Optimizer Worker & Database Telemetry Pipeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. AiEconomicOptimizerService Telemetry Scanner', () => {
    it('scans active services, detects margin leakages, enforces 15% floor and generates snapshot', async () => {
      // Mock db queries
      vi.spyOn(db.service, 'findMany').mockResolvedValue([
        {
          id: 'srv_underpriced',
          name: 'Telegram Subscribers HQ',
          rate: 1.0, // $1.00 USD rate
          providerCurrency: 'USD',
          markup: 1.10, // Underpriced (only 10% markup)
          pricePer1000Cents: 10175,
          categoryId: 'cat_tg',
        },
        {
          id: 'srv_healthy',
          name: 'Instagram Likes VIP',
          rate: 2.0,
          providerCurrency: 'USD',
          markup: 3.50, // Healthy margin (350%)
          pricePer1000Cents: 64750,
          categoryId: 'cat_ig',
        },
      ] as any);

      vi.spyOn(db.order, 'findMany').mockResolvedValue([
        {
          serviceId: 'srv_underpriced',
          charge: BigInt(50000), // 500.00 RUB
          providerCost: BigInt(46000), // 460.00 RUB
          quantity: 5000,
          remains: 0,
        },
      ] as any);

      const mockCreatedSnapshot = {
        id: 'snap_test_123',
        tenantId: 'smmplan',
        analyzedPeriodDays: 30,
        totalLeakageRub: 550,
        leakingServicesCount: 1,
        executiveSummary: 'Test summary',
        status: 'GENERATED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          economicOptimizationSnapshot: {
            create: vi.fn().mockResolvedValue(mockCreatedSnapshot),
          },
          aiPricingRecommendation: {
            createMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        });
      });

      const result = await AiEconomicOptimizerService.runNightlyOptimization({
        tenantId: 'smmplan',
        analyzedPeriodDays: 30,
      });

      expect(result.snapshotId).toBe('snap_test_123');
      expect(result.tenantId).toBe('smmplan');
      expect(result.leakingServicesCount).toBe(1);
      expect(result.trace.length).toBeGreaterThanOrEqual(4);
      expect(result.trace.some((t) => t.step === 'INVARIANT_PIPELINE_EXECUTION')).toBe(true);
    });
  });

  describe('2. BullMQ Worker Execution & Mutex Lock', () => {
    it('acquires distributed lock and executes optimization for both tenants', async () => {
      const runSpy = vi.spyOn(AiEconomicOptimizerService, 'runNightlyOptimization').mockResolvedValue({
        snapshotId: 'snap_tenant_mock',
        tenantId: 'mock',
        totalLeakageRub: 1200,
        leakingServicesCount: 2,
        durationMs: 45,
        trace: [],
      });

      const mockJob: any = {
        id: 'job_nightly_test',
        data: { tenantId: 'all', analyzedPeriodDays: 30 },
      };

      const result = await aiEconomicOptimizerProcessor(mockJob);

      expect(result.success).toBe(true);
      expect(result.processedTenants.length).toBe(2); // smmplan and flux
      expect(runSpy).toHaveBeenCalledTimes(2);
    });

    it('gracefully skips execution when lock contention occurs', async () => {
      vi.spyOn(MutexManager, 'withLock').mockRejectedValue(new Error('Failed to acquire lock for key worker:ai-economic-optimizer:smmplan'));

      const mockJob: any = {
        id: 'job_contention_test',
        data: { tenantId: 'smmplan', analyzedPeriodDays: 30 },
      };

      const result = await aiEconomicOptimizerProcessor(mockJob);

      expect(result.success).toBe(true);
      expect(result.processedTenants[0]).toMatchObject({
        tenantId: 'smmplan',
        skipped: true,
        reason: 'LOCK_CONTENTION',
      });
    });
  });
});
