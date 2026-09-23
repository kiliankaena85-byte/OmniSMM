/**
 * QA-2: Order Lifecycle Engineer
 * Test Suite: OrderProcessor — State Machine & Retry Logic
 * Standards: ISTQB §4.3 (State Transition Testing), IEEE 829 §9
 * 
 * UPDATED: After Ghost Proxy v2 refactoring, order.processor.ts now uses
 * providerService.getWorkerProviderInstance() instead of direct `new UniversalProvider()`.
 * Mocks have been updated accordingly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockCreateOrder = vi.fn();
  const mockProcessRefund = vi.fn();
  const mockOrderDb = { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() };
  const mockGetWorkerProviderInstance = vi.fn();
  return { mockCreateOrder, mockProcessRefund, mockOrderDb, mockGetWorkerProviderInstance };
});

vi.mock('@/lib/db', () => ({
  db: { order: mocks.mockOrderDb },
}));

// Mock providerService (replaces old UniversalProvider mock after Ghost Proxy v2)
vi.mock('@/services/providers/provider.service', () => ({
  providerService: {
    getWorkerProviderInstance: mocks.mockGetWorkerProviderInstance,
  },
}));

vi.mock('@/services/financial/wallet.service', () => ({
  WalletService: { credit: vi.fn() },
}));

vi.mock('@/services/financial/refund-policy.service', () => ({
  RefundPolicyService: {
    processRefund: (...args: any[]) => mocks.mockProcessRefund(...args),
  },
}));

import orderProcessor from '@/workers/processors/order.processor';

function fakeJob(data: any, attemptsMade = 0, maxAttempts = 3) {
  return { data, attemptsMade, opts: { attempts: maxAttempts } } as any;
}

function mockOrder(overrides: any = {}) {
  return {
    id: 'ord-1', userId: 'usr-1', status: 'PENDING',
    link: 'https://t.me/test', quantity: 1000, charge: 5000,
    providerCost: 2000, remains: 1000, runs: null,
    isDripFeed: false, externalId: null, dripExternalIds: [],
    waitingUntil: null, customData: null,
    service: {
      name: 'Telegram Followers',
      externalId: '12345',
      provider: { id: 'p1', apiUrl: 'https://api.example.com', apiKey: 'key' },
    },
    ...overrides,
  };
}

describe('OrderProcessor (QA-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockOrderDb.update.mockResolvedValue({});
    mocks.mockOrderDb.findMany.mockResolvedValue([]);
    // Default: factory returns a mock provider with createOrder
    mocks.mockGetWorkerProviderInstance.mockResolvedValue({
      createOrder: mocks.mockCreateOrder,
    });
  });

  it('TC-ORD-007: Happy path → IN_PROGRESS + externalId', async () => {
    mocks.mockOrderDb.findUnique.mockResolvedValue(mockOrder());
    mocks.mockCreateOrder.mockResolvedValue({ order: 99887 });
    await orderProcessor(fakeJob({ orderId: 'ord-1' }));
    expect(mocks.mockCreateOrder).toHaveBeenCalled();
    expect(mocks.mockOrderDb.update).toHaveBeenCalledWith({
      where: { id: 'ord-1' },
      data: expect.objectContaining({
        externalId: '99887', status: 'IN_PROGRESS', waitingUntil: expect.any(Date),
      }),
    });
  });

  it('TC-ORD-008: Non-PENDING skipped', async () => {
    mocks.mockOrderDb.findUnique.mockResolvedValue(mockOrder({ status: 'IN_PROGRESS' }));
    await orderProcessor(fakeJob({ orderId: 'ord-1' }));
    expect(mocks.mockCreateOrder).not.toHaveBeenCalled();
  });

  it('TC-ORD-009: Provider failure re-throws for retry', async () => {
    mocks.mockOrderDb.findUnique.mockResolvedValue(mockOrder());
    mocks.mockCreateOrder.mockRejectedValue(new Error('Timeout'));
    await expect(orderProcessor(fakeJob({ orderId: 'ord-1' }, 0, 3))).rejects.toThrow('Timeout');
  });

  it('TC-ORD-010: Retries exhausted → throws error (handled by DLQ)', async () => {
    const order = mockOrder();
    mocks.mockOrderDb.findUnique.mockResolvedValue(order);
    mocks.mockCreateOrder.mockRejectedValue(new Error('Down'));
    await expect(orderProcessor(fakeJob({ orderId: 'ord-1' }, 3, 3))).rejects.toThrow('Down');
  });

  it('TC-ORD-011: DripFeed child fail → throws error (handled by DLQ)', async () => {
    const order = mockOrder({ runs: 5, charge: 5000 });
    mocks.mockOrderDb.findUnique.mockResolvedValue(order);
    mocks.mockCreateOrder.mockRejectedValue(new Error('Down'));
    await expect(orderProcessor(fakeJob({ orderId: 'ord-1', isDripFeedChild: true }, 3, 3))).rejects.toThrow('Down');
  });

  it('TC-ORD-012: Missing credentials → throws', async () => {
    mocks.mockOrderDb.findUnique.mockResolvedValue(
      mockOrder({ service: { name: 'Test', externalId: '1', provider: { id: 'p', apiUrl: '', apiKey: '' } } })
    );
    await expect(orderProcessor(fakeJob({ orderId: 'ord-1' }))).rejects.toThrow('Provider missing');
  });

  it('TC-ORD-EXTRA: Order not found → skip', async () => {
    mocks.mockOrderDb.findUnique.mockResolvedValue(null);
    await orderProcessor(fakeJob({ orderId: 'x' }));
    expect(mocks.mockCreateOrder).not.toHaveBeenCalled();
  });

  it('TC-ORD-EXTRA: Provider error response → throws', async () => {
    mocks.mockOrderDb.findUnique.mockResolvedValue(mockOrder());
    mocks.mockCreateOrder.mockResolvedValue({ error: 'Bad service' });
    await expect(orderProcessor(fakeJob({ orderId: 'ord-1' }, 0, 3))).rejects.toThrow('Bad service');
  });

  it('TC-ORD-EXTRA: DripFeed child success → updates externalId', async () => {
    mocks.mockOrderDb.findUnique.mockResolvedValue(mockOrder({ runs: 3, isDripFeed: true }));
    mocks.mockCreateOrder.mockResolvedValue({ order: 55544 });
    await orderProcessor(fakeJob({ orderId: 'ord-1', isDripFeedChild: true }));
    expect(mocks.mockOrderDb.update).toHaveBeenCalledWith({
      where: { id: 'ord-1' },
      data: expect.objectContaining({ externalId: '55544', status: 'IN_PROGRESS' }),
    });
  });

  it('TC-ORD-FACTORY: getWorkerProviderInstance is called with correct provider config', async () => {
    const order = mockOrder();
    mocks.mockOrderDb.findUnique.mockResolvedValue(order);
    mocks.mockCreateOrder.mockResolvedValue({ order: 111 });
    await orderProcessor(fakeJob({ orderId: 'ord-1' }));
    expect(mocks.mockGetWorkerProviderInstance).toHaveBeenCalledWith(
      order.service.provider
    );
  });
});
