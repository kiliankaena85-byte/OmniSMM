import { describe, it, expect, vi, beforeEach } from 'vitest';
import syncProcessor from '../sync.processor';
import { db } from '../../../lib/db';
import { providerService } from '../../../services/providers/provider.service';

vi.mock('../../../lib/db', () => ({
  db: {
    provider: { findMany: vi.fn(), update: vi.fn() },
    order: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(async (cb: any) => cb(db)),
  }
}));

vi.mock('../../../services/providers/provider.service', () => ({
  providerService: {
    getWorkerProviderInstance: vi.fn()
  }
}));

vi.mock('../../../lib/smtp', () => ({
  sendOrderCompletedMail: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../../services/financial/refund-policy.service', () => ({
  RefundPolicyService: {
    processRefund: vi.fn()
  }
}));

vi.mock('@/services/providers/quarantine.service', () => ({
  QuarantineService: {
    evaluateTriggerB: vi.fn().mockResolvedValue(true),
    restoreExpiredQuarantines: vi.fn().mockResolvedValue(true),
    evaluateTriggerC: vi.fn().mockResolvedValue(true),
  }
}));

vi.mock('../../../services/core/order.service', () => ({
  orderService: {
    failOrderTerminal: vi.fn().mockResolvedValue(true)
  }
}));

vi.mock('../../../services/financial/compensation.service', () => ({
  CompensationService: {
    trackCompensation: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('Sync Processor', () => {
  const mockJob = { name: 'sync-all' } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.order.findUnique).mockResolvedValue({ id: 'o1', status: 'PENDING' } as any);
  });

  it('Normal status transition (PENDING -> COMPLETED)', async () => {
    vi.mocked(db.provider.findMany).mockResolvedValue([
      { id: 'p1', isActive: true, apiUrl: 'url', apiKey: 'key' } as any
    ]);
    vi.mocked(db.order.findMany).mockResolvedValueOnce([
      { id: 'o1' } as any
    ]).mockResolvedValueOnce([
      { id: 'o1', externalId: 'ext1', user: { email: 'test@test.com' }, service: { name: 'S1' } } as any
    ]).mockResolvedValueOnce([]) // for orphan orders
      .mockResolvedValueOnce([]); // for zero-start detector

    const providerMock = {
      getMultiOrderStatus: vi.fn().mockResolvedValue({
        'ext1': { status: 'COMPLETED', remains: '0' }
      })
    };
    vi.mocked(providerService.getWorkerProviderInstance).mockResolvedValue(providerMock as any);

    await syncProcessor(mockJob);

    expect(db.order.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'o1' },
      data: expect.objectContaining({ status: 'COMPLETED', remains: 0 })
    }));
  });

  it('Provider timeout (ensure SLA metrics log error)', async () => {
    vi.mocked(db.provider.findMany).mockResolvedValue([
      { id: 'p1', isActive: true, apiUrl: 'url', apiKey: 'key' } as any
    ]);
    vi.mocked(db.order.findMany).mockResolvedValueOnce([
      { id: 'o1' } as any
    ]).mockResolvedValueOnce([
      { id: 'o1', externalId: 'ext1', user: { email: 'test@test.com' }, service: { name: 'S1' } } as any
    ]).mockResolvedValueOnce([]) // for orphan orders
      .mockResolvedValueOnce([]); // for zero-start detector

    const providerMock = {
      getMultiOrderStatus: vi.fn().mockRejectedValue(new Error('PROVIDER_TIMEOUT'))
    };
    vi.mocked(providerService.getWorkerProviderInstance).mockResolvedValue(providerMock as any);

    await syncProcessor(mockJob);

    expect(db.provider.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        lastErrorAt: expect.any(Date),
        errorCount5m: { increment: 1 }
      }
    });
  });

  it('Refund path (status -> PARTIAL/CANCELED)', async () => {
    vi.mocked(db.provider.findMany).mockResolvedValue([
      { id: 'p1', isActive: true, apiUrl: 'url', apiKey: 'key' } as any
    ]);
    vi.mocked(db.order.findMany).mockResolvedValueOnce([
      { id: 'o1' }, { id: 'o2' }
    ] as any).mockResolvedValueOnce([
      { id: 'o1', externalId: 'ext1', charge: 100, quantity: 100, user: { email: 'test@test.com' }, service: { name: 'S1' }, serviceId: 's1', updatedAt: new Date() },
      { id: 'o2', externalId: 'ext2', charge: 100, quantity: 100, user: { email: 'test@test.com' }, service: { name: 'S1' }, serviceId: 's1', updatedAt: new Date() }
    ] as any).mockResolvedValueOnce([]) // for orphan orders
      .mockResolvedValueOnce([]); // for zero-start detector

    vi.mocked(db.order.update).mockImplementation(((args: any) => {
      return Promise.resolve({ id: args.where.id, charge: 100 });
    }) as any);

    const providerMock = {
      getMultiOrderStatus: vi.fn().mockResolvedValue({
        'ext1': { status: 'PARTIAL', remains: '50' },
        'ext2': { status: 'CANCELED', remains: '100' }
      })
    };
    vi.mocked(providerService.getWorkerProviderInstance).mockResolvedValue(providerMock as any);

    await syncProcessor(mockJob);

    expect(db.order.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'o1' },
      data: expect.objectContaining({ status: 'PARTIAL', remains: 50 })
    }));
    expect(db.order.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'o2' },
      data: expect.objectContaining({ status: 'CANCELED', remains: 100 })
    }));
  });
});
