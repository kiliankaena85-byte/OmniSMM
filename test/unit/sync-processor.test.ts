/**
 * QA-2: Order Lifecycle Engineer
 * Test Suite: SyncProcessor — Smart Waiting & Bulk Status Sync
 * Standards: ISTQB §4.3 (State Transition), ISO 25010 §6.1.3
 * 
 * UPDATED: After Ghost Proxy v2 refactoring, sync.processor.ts now uses
 * providerService.getWorkerProviderInstance() instead of direct `new UniversalProvider()`.
 * Mocks have been updated accordingly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() ensures these are available when vi.mock is hoisted
const { mockOrderDb, mockGetMultiOrderStatus, mockProcessRefund, mockGetWorkerProviderInstance } = vi.hoisted(() => ({
  mockOrderDb: { findMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  mockGetMultiOrderStatus: vi.fn(),
  mockProcessRefund: vi.fn(),
  mockGetWorkerProviderInstance: vi.fn(),
}));

vi.mock('@/lib/db', () => {
  const mockDb = {
    order: mockOrderDb,
    provider: { 
      findMany: vi.fn().mockResolvedValue([{ id: 'prov-1', apiUrl: 'https://api.provider.com', apiKey: 'encrypted-key' }]),
      update: vi.fn()
    },
    refill: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn()
    },
    smartCampaign: {
      findMany: vi.fn().mockResolvedValue([])
    },
    $transaction: vi.fn(async (cb) => cb(mockDb))
  };
  return { db: mockDb };
});

// Mock providerService (replaces old UniversalProvider mock after Ghost Proxy v2)
vi.mock('@/services/providers/provider.service', () => ({
  providerService: {
    getWorkerProviderInstance: mockGetWorkerProviderInstance,
  },
}));

vi.mock('@/services/financial/wallet.service', () => ({
  WalletService: { credit: vi.fn() },
}));

vi.mock('@/services/financial/refund-policy.service', () => ({
  RefundPolicyService: {
    processRefund: (...args: any[]) => mockProcessRefund(...args),
  },
}));

vi.mock('@/services/providers/quarantine.service', () => ({
  QuarantineService: {
    evaluateTriggerB: vi.fn().mockResolvedValue(undefined),
    restoreExpiredQuarantines: vi.fn().mockResolvedValue(undefined),
    evaluateTriggerC: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/core/order.service', () => ({
  orderService: {
    failOrderTerminal: vi.fn().mockResolvedValue(undefined),
  },
}));

import syncProcessor from '@/workers/processors/sync.processor';

function createFakeJob() {
  return { data: {} } as any;
}

function createMockOrder(overrides: any = {}) {
  return {
    id: 'ord-sync-1', userId: 'usr-1', status: 'IN_PROGRESS',
    externalId: 'ext-100', link: 'https://t.me/test',
    quantity: 1000, charge: 5000, remains: 1000,
    isDripFeed: false, dripExternalIds: [],
    waitingUntil: null, currentRun: 0, runs: null,
    service: {
      provider: { id: 'prov-1', apiUrl: 'https://api.provider.com', apiKey: 'encrypted-key' },
    },
    ...overrides,
  };
}

describe('SyncProcessor (QA-2: Order Lifecycle Engineer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderDb.update.mockImplementation(async (args: any) => {
      return { ...createMockOrder(), ...args.data };
    });
    mockOrderDb.findUnique.mockImplementation(async () => createMockOrder());
    // Default: factory returns a mock provider with getMultiOrderStatus
    mockGetWorkerProviderInstance.mockResolvedValue({
      getMultiOrderStatus: mockGetMultiOrderStatus,
    });
  });

  it('TC-ORD-021: No active orders → exits silently', async () => {
    mockOrderDb.findMany.mockResolvedValue([]);
    await syncProcessor(createFakeJob());
    expect(mockGetMultiOrderStatus).not.toHaveBeenCalled();
  });

  it('TC-ORD-013: Provider "Completed" → COMPLETED, remains=0', async () => {
    mockOrderDb.findMany.mockResolvedValue([createMockOrder()]);
    mockGetMultiOrderStatus.mockResolvedValue({
      'ext-100': { status: 'completed', charge: '50.00', remains: '0', order: 'ext-100', start_count: '0' },
    });
    await syncProcessor(createFakeJob());
    expect(mockOrderDb.update).toHaveBeenCalledWith({
      where: { id: 'ord-sync-1' }, data: { status: 'COMPLETED', remains: 0, startCount: 0 },
    });
    expect(mockProcessRefund).not.toHaveBeenCalled();
  });

  it('TC-ORD-014: Provider "Partial" → PARTIAL + RefundPolicy', async () => {
    mockOrderDb.findMany.mockResolvedValue([createMockOrder()]);
    mockGetMultiOrderStatus.mockResolvedValue({
      'ext-100': { status: 'partial', charge: '50.00', remains: '300', order: 'ext-100', start_count: '0' },
    });
    await syncProcessor(createFakeJob());
    expect(mockOrderDb.update).toHaveBeenCalledWith({
      where: { id: 'ord-sync-1' }, data: { status: 'PARTIAL', remains: 300, startCount: 0 },
    });
    expect(mockProcessRefund).toHaveBeenCalled();
  });

  it('TC-ORD-015: Provider "Canceled" → CANCELED + full refund', async () => {
    mockOrderDb.findMany.mockResolvedValue([createMockOrder()]);
    mockGetMultiOrderStatus.mockResolvedValue({
      'ext-100': { status: 'canceled', charge: '50.00', remains: '1000', order: 'ext-100', start_count: '0' },
    });
    await syncProcessor(createFakeJob());
    expect(mockOrderDb.update).toHaveBeenCalledWith({
      where: { id: 'ord-sync-1' }, data: { status: 'CANCELED', remains: 1000, startCount: 0 },
    });
    expect(mockProcessRefund).toHaveBeenCalledWith(
      expect.anything(), expect.stringContaining('Отмена на стороне провайдера'), expect.anything()
    );
  });

  it('TC-ORD-016: String error within waitingUntil → SKIP (Smart Waiting)', async () => {
    mockOrderDb.findMany.mockResolvedValue([createMockOrder({ waitingUntil: new Date(Date.now() + 30 * 60 * 1000) })]);
    mockGetMultiOrderStatus.mockResolvedValue({ 'ext-100': 'Incorrect order ID' });
    await syncProcessor(createFakeJob());
    expect(mockOrderDb.update).not.toHaveBeenCalled();
    expect(mockProcessRefund).not.toHaveBeenCalled();
  });

  it('TC-ORD-017: String error after waitingUntil expired → ERROR + refund', async () => {
    mockOrderDb.findMany.mockResolvedValue([createMockOrder({ waitingUntil: new Date(Date.now() - 10 * 60 * 1000) })]);
    mockGetMultiOrderStatus.mockResolvedValue({ 'ext-100': 'Incorrect order ID' });
    await syncProcessor(createFakeJob());
    expect(mockOrderDb.update).toHaveBeenCalledWith({
      where: { id: 'ord-sync-1' }, data: { status: 'ERROR', error: 'Incorrect order ID' },
    });
    expect(mockProcessRefund).toHaveBeenCalled();
  });

  it('TC-ORD-018: String error + no waitingUntil → ERROR immediately', async () => {
    mockOrderDb.findMany.mockResolvedValue([createMockOrder({ waitingUntil: null })]);
    mockGetMultiOrderStatus.mockResolvedValue({ 'ext-100': 'Incorrect order ID' });
    await syncProcessor(createFakeJob());
    expect(mockOrderDb.update).toHaveBeenCalledWith({
      where: { id: 'ord-sync-1' }, data: { status: 'ERROR', error: 'Incorrect order ID' },
    });
  });

  it('TC-ORD-022: Provider API exception → caught, no crash', async () => {
    mockOrderDb.findMany.mockResolvedValue([createMockOrder()]);
    mockGetMultiOrderStatus.mockRejectedValue(new Error('Network Timeout'));
    await expect(syncProcessor(createFakeJob())).resolves.not.toThrow();
  });

  it('TC-ORD-EXTRA: "Processing" status → only update remains', async () => {
    mockOrderDb.findMany.mockResolvedValue([createMockOrder()]);
    mockGetMultiOrderStatus.mockResolvedValue({
      'ext-100': { status: 'processing', charge: '50.00', remains: '500', order: 'ext-100', start_count: '0' },
    });
    await syncProcessor(createFakeJob());
    expect(mockOrderDb.update).toHaveBeenCalledWith({
      where: { id: 'ord-sync-1' }, data: { remains: 500, startCount: 0 },
    });
    expect(mockProcessRefund).not.toHaveBeenCalled();
  });

  it('TC-ORD-EXTRA: No externalId → skipped', async () => {
    mockOrderDb.findMany.mockResolvedValue([createMockOrder({ externalId: null })]);
    mockGetMultiOrderStatus.mockResolvedValue({});
    await syncProcessor(createFakeJob());
    expect(mockOrderDb.update).not.toHaveBeenCalled();
  });

  it('TC-SYNC-FACTORY: getWorkerProviderInstance called with correct provider', async () => {
    const order = createMockOrder();
    mockOrderDb.findMany.mockResolvedValue([order]);
    mockGetMultiOrderStatus.mockResolvedValue({
      'ext-100': { status: 'completed', charge: '0', remains: '0', order: 'ext-100', start_count: '0' },
    });
    await syncProcessor(createFakeJob());
    expect(mockGetWorkerProviderInstance).toHaveBeenCalledWith(order.service.provider);
  });
});
