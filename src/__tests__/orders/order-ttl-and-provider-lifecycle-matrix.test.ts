import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runInProgressTTLSweep, runPendingCheckTTLSweep } from '@/workers/processors/cleanup.processor';
import { providerService } from '@/services/providers/provider.service';
import { WalletOps } from '@/services/financial/wallet-ops';
import { LoyaltyService } from '@/services/users/loyalty.service';
import { db } from '@/lib/db';

vi.mock('@/services/providers/provider.service');
vi.mock('@/services/financial/wallet-ops');
vi.mock('@/services/users/loyalty.service', () => ({
  LoyaltyService: {
    confirmCommission: vi.fn().mockResolvedValue(undefined),
    reverseCommission: vi.fn().mockResolvedValue(undefined),
    handlePartialCommission: vi.fn().mockResolvedValue(undefined),
  }
}));
vi.mock('@/services/admin-alert.service', () => ({
  sendAdminAlert: vi.fn().mockResolvedValue(true),
}));

describe('🛡️ Comprehensive Order TTL & Provider Lifecycle Matrix (Real E2E)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. [ANTI-DRAIN INVARIANT] Long-running order (10 days in progress) MUST NOT be canceled while provider is in_progress', async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    
    const mockOrder = {
      id: 'ord_long_running_1',
      numericId: 101,
      userId: 'user_1',
      charge: BigInt(1500),
      quantity: 1000,
      remains: 800,
      serviceId: 'srv_1',
      externalId: 'ext_prov_101',
      runs: 1,
      interval: 0,
      createdAt: tenDaysAgo,
      service: {
        provider: { id: 'prov_vexboost', name: 'VexBoost' }
      }
    };

    vi.spyOn(db.order, 'findMany').mockResolvedValueOnce([mockOrder as any]).mockResolvedValue([]);
    const updateManySpy = vi.spyOn(db.order, 'updateMany').mockResolvedValue({ count: 1 });

    vi.spyOn(providerService, 'getWorkerProviderInstance').mockResolvedValueOnce({
      getOrderStatus: vi.fn().mockResolvedValue({
        status: 'In progress',
        remains: '600'
      })
    } as any);

    await runInProgressTTLSweep();

    expect(updateManySpy).toHaveBeenCalledWith({
      where: { id: 'ord_long_running_1', status: 'IN_PROGRESS' },
      data: {
        remains: 600,
        updatedAt: expect.any(Date),
      }
    });

    expect(WalletOps.refund).not.toHaveBeenCalled();
  });

  it('2. [MANUAL SMM PRIME INVARIANT] Manual slow orders (30 days) in Processing MUST NOT be cancelled', async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const mockOrder = {
      id: 'ord_manual_smm_prime',
      numericId: 102,
      userId: 'user_2',
      charge: BigInt(5000),
      quantity: 500,
      remains: 500,
      serviceId: 'srv_manual',
      externalId: 'ext_smm_prime_500',
      runs: 1,
      interval: 0,
      createdAt: thirtyDaysAgo,
      service: {
        provider: { id: 'prov_smm_prime', name: 'SMM Prime' }
      }
    };

    vi.spyOn(db.order, 'findMany').mockResolvedValueOnce([mockOrder as any]).mockResolvedValue([]);
    const updateManySpy = vi.spyOn(db.order, 'updateMany').mockResolvedValue({ count: 1 });

    vi.spyOn(providerService, 'getWorkerProviderInstance').mockResolvedValueOnce({
      getOrderStatus: vi.fn().mockResolvedValue({
        status: 'Processing',
        remains: '500'
      })
    } as any);

    await runInProgressTTLSweep();

    expect(updateManySpy).toHaveBeenCalledWith({
      where: { id: 'ord_manual_smm_prime', status: 'IN_PROGRESS' },
      data: {
        remains: 500,
        updatedAt: expect.any(Date),
      }
    });
    expect(WalletOps.refund).not.toHaveBeenCalled();
  });

  it('3. [DRIP-FEED DYNAMIC TTL] Drip-feed order (10 days total) at Day 4 MUST NOT be swept', async () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

    const mockDripOrder = {
      id: 'ord_drip_feed_active',
      numericId: 103,
      userId: 'user_3',
      charge: BigInt(10000),
      quantity: 10000,
      remains: 6000,
      serviceId: 'srv_drip',
      externalId: 'ext_drip_103',
      runs: 10,
      interval: 1440,
      createdAt: fourDaysAgo,
      service: {
        provider: { id: 'prov_vexboost', name: 'VexBoost' }
      }
    };

    vi.spyOn(db.order, 'findMany').mockResolvedValueOnce([mockDripOrder as any]).mockResolvedValue([]);

    await runInProgressTTLSweep();

    expect(providerService.getWorkerProviderInstance).not.toHaveBeenCalled();
    expect(WalletOps.refund).not.toHaveBeenCalled();
  });

  it('4. [GENUINE CANCELLATION] Order officially Canceled by provider MUST be marked ERROR with 100% refund', async () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

    const mockOrder = {
      id: 'ord_canceled_by_prov',
      numericId: 104,
      userId: 'user_4',
      charge: BigInt(2000),
      quantity: 1000,
      remains: 1000,
      serviceId: 'srv_1',
      externalId: 'ext_canceled_104',
      runs: 1,
      interval: 0,
      createdAt: fourDaysAgo,
      service: {
        provider: { id: 'prov_vexboost', name: 'VexBoost' }
      }
    };

    vi.spyOn(db.order, 'findMany').mockResolvedValueOnce([mockOrder as any]).mockResolvedValue([]);

    const txMock = {
      order: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      commission: { findMany: vi.fn().mockResolvedValue([]) },
      ledgerEntry: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      user: { update: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) => cb(txMock));

    vi.spyOn(providerService, 'getWorkerProviderInstance').mockResolvedValueOnce({
      getOrderStatus: vi.fn().mockResolvedValue({
        status: 'Canceled',
        remains: '1000'
      })
    } as any);

    await runInProgressTTLSweep();

    expect(WalletOps.refund).toHaveBeenCalledWith(
      expect.anything(),
      'user_4',
      2000,
      expect.stringContaining('Заказ отменён провайдером'),
      { idempotencyKey: 'refund-ttl-ord_canceled_by_prov' }
    );
  });

  it('5. [GENUINE PARTIAL] Order partially fulfilled by provider (800/1000) MUST receive proportional refund for remaining 200', async () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

    const mockOrder = {
      id: 'ord_partial_by_prov',
      numericId: 105,
      userId: 'user_5',
      charge: BigInt(1500),
      quantity: 1000,
      remains: 200,
      serviceId: 'srv_1',
      externalId: 'ext_partial_105',
      runs: 1,
      interval: 0,
      createdAt: fourDaysAgo,
      service: {
        provider: { id: 'prov_vexboost', name: 'VexBoost' }
      }
    };

    vi.spyOn(db.order, 'findMany').mockResolvedValueOnce([mockOrder as any]).mockResolvedValue([]);

    const txMock = {
      order: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      commission: { findMany: vi.fn().mockResolvedValue([]) },
      ledgerEntry: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      user: { update: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) => cb(txMock));

    vi.spyOn(providerService, 'getWorkerProviderInstance').mockResolvedValueOnce({
      getOrderStatus: vi.fn().mockResolvedValue({
        status: 'Partial',
        remains: '200'
      })
    } as any);

    await runInProgressTTLSweep();

    expect(WalletOps.refund).toHaveBeenCalledWith(
      expect.anything(),
      'user_5',
      300,
      expect.stringContaining('Заказ частично выполнен провайдером'),
      { idempotencyKey: 'refund-ttl-ord_partial_by_prov' }
    );
  });

  it('6. [PROVIDER NOT FOUND ERROR] Order lost by provider (Incorrect order ID) MUST be terminated with full refund', async () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

    const mockOrder = {
      id: 'ord_lost_by_prov',
      numericId: 106,
      userId: 'user_6',
      charge: BigInt(1000),
      quantity: 500,
      remains: 500,
      serviceId: 'srv_1',
      externalId: 'ext_lost_106',
      runs: 1,
      interval: 0,
      createdAt: fourDaysAgo,
      service: {
        provider: { id: 'prov_vexboost', name: 'VexBoost' }
      }
    };

    vi.spyOn(db.order, 'findMany').mockResolvedValueOnce([mockOrder as any]).mockResolvedValue([]);

    const txMock = {
      order: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      commission: { findMany: vi.fn().mockResolvedValue([]) },
      ledgerEntry: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      user: { update: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) => cb(txMock));

    vi.spyOn(providerService, 'getWorkerProviderInstance').mockResolvedValueOnce({
      getOrderStatus: vi.fn().mockRejectedValue(new Error('Incorrect order ID: order not found on provider server'))
    } as any);

    await runInProgressTTLSweep();

    expect(WalletOps.refund).toHaveBeenCalledWith(
      expect.anything(),
      'user_6',
      1000,
      expect.stringContaining('Заказ отменён провайдером'),
      { idempotencyKey: 'refund-ttl-ord_lost_by_prov' }
    );
  });

  it('7. [PENDING_CHECK 24H SWEEP] Orders in PENDING_CHECK are kept active unless provider confirms cancellation', async () => {
    const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);

    // Scenario A: Order in PENDING_CHECK without terminal provider failure is kept active (never canceled)
    const mockActiveOrder = {
      id: 'ord_active_pending_check',
      numericId: 107,
      userId: 'user_7',
      charge: BigInt(2500),
      quantity: 1000,
      status: 'PENDING_CHECK',
      createdAt: thirtyHoursAgo,
    };

    vi.spyOn(db.order, 'findMany').mockResolvedValueOnce([mockActiveOrder as any]);
    await runPendingCheckTTLSweep();
    expect(WalletOps.refund).not.toHaveBeenCalled();

    // Scenario B: Order confirmed canceled by provider API is refunded
    const mockCanceledOrder = {
      id: 'ord_canceled_pending_check',
      numericId: 108,
      userId: 'user_8',
      charge: BigInt(3000),
      quantity: 1000,
      externalId: 'ext_888',
      status: 'PENDING_CHECK',
      createdAt: thirtyHoursAgo,
      service: {
        provider: { id: 'prov_8', type: 'STANDARD' }
      }
    };

    vi.spyOn(db.order, 'findMany').mockResolvedValueOnce([mockCanceledOrder as any]);
    const { providerService } = await import('@/services/providers/provider.service');
    vi.spyOn(providerService, 'getWorkerProviderInstance').mockResolvedValueOnce({
      getOrderStatus: vi.fn().mockResolvedValue({ status: 'Canceled' })
    } as any);

    const txMock = {
      order: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      commission: { findMany: vi.fn().mockResolvedValue([]) },
      ledgerEntry: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      user: { update: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) => cb(txMock));

    await runPendingCheckTTLSweep();

    expect(WalletOps.refund).toHaveBeenCalledWith(
      expect.anything(),
      'user_8',
      3000,
      expect.stringContaining('отменён провайдером'),
      { idempotencyKey: 'refund-pending-check-ttl-ord_canceled_pending_check' }
    );
  });
});
