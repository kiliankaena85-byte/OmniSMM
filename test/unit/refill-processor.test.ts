import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnrecoverableError } from 'bullmq';

const mocks = vi.hoisted(() => {
  const mockRefill = vi.fn();
  const mockRefillDb = { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() };
  const mockGetWorkerProviderInstance = vi.fn();
  return { mockRefill, mockRefillDb, mockGetWorkerProviderInstance };
});

vi.mock('@/lib/db', () => ({
  db: { refill: mocks.mockRefillDb },
}));

vi.mock('@/services/providers/provider.service', () => ({
  providerService: {
    getWorkerProviderInstance: mocks.mockGetWorkerProviderInstance,
  },
}));

import refillProcessor from '@/workers/processors/refill.processor';

function fakeJob(data: any) {
  return { data } as any;
}

function mockRefillRecord(overrides: any = {}) {
  return {
    id: 'refill-1',
    status: 'PENDING',
    externalId: null,
    order: {
      id: 'ord-1',
      status: 'COMPLETED',
      externalId: 'ext-ord-123',
      service: {
        id: 'srv-1',
        isRefillEnabled: true,
        provider: {
          id: 'p1',
          apiUrl: 'https://api.example.com',
          apiKey: 'key',
        },
      },
    },
    ...overrides,
  };
}

describe('RefillProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockRefillDb.update.mockResolvedValue({});
    mocks.mockGetWorkerProviderInstance.mockResolvedValue({
      refill: mocks.mockRefill,
    });
  });

  it('Happy path: dispatches refill to provider and updates status to IN_PROGRESS', async () => {
    const refill = mockRefillRecord();
    mocks.mockRefillDb.findUnique.mockResolvedValue(refill);
    mocks.mockRefill.mockResolvedValue({ refill: 998877 });

    await refillProcessor(fakeJob({ refillId: 'refill-1' }));

    expect(mocks.mockRefill).toHaveBeenCalledWith('ext-ord-123');
    expect(mocks.mockRefillDb.update).toHaveBeenCalledWith({
      where: { id: 'refill-1' },
      data: {
        status: 'IN_PROGRESS',
        externalId: '998877',
      },
    });
  });

  it('Skips if refill is not found', async () => {
    mocks.mockRefillDb.findUnique.mockResolvedValue(null);

    await refillProcessor(fakeJob({ refillId: 'refill-x' }));

    expect(mocks.mockRefill).not.toHaveBeenCalled();
    expect(mocks.mockRefillDb.update).not.toHaveBeenCalled();
  });

  it('Skips if refill status is not PENDING', async () => {
    const refill = mockRefillRecord({ status: 'IN_PROGRESS' });
    mocks.mockRefillDb.findUnique.mockResolvedValue(refill);

    await refillProcessor(fakeJob({ refillId: 'refill-1' }));

    expect(mocks.mockRefill).not.toHaveBeenCalled();
    expect(mocks.mockRefillDb.update).not.toHaveBeenCalled();
  });

  it('Throws UnrecoverableError if order is CANCELED and marks refill status as ERROR', async () => {
    const refill = mockRefillRecord();
    refill.order.status = 'CANCELED';
    mocks.mockRefillDb.findUnique.mockResolvedValue(refill);

    await expect(refillProcessor(fakeJob({ refillId: 'refill-1' }))).rejects.toThrow(
      UnrecoverableError
    );

    expect(mocks.mockRefillDb.update).toHaveBeenCalledWith({
      where: { id: 'refill-1' },
      data: { status: 'ERROR' },
    });
    expect(mocks.mockRefill).not.toHaveBeenCalled();
  });

  it('Throws UnrecoverableError if order is ERROR and marks refill status as ERROR', async () => {
    const refill = mockRefillRecord();
    refill.order.status = 'ERROR';
    mocks.mockRefillDb.findUnique.mockResolvedValue(refill);

    await expect(refillProcessor(fakeJob({ refillId: 'refill-1' }))).rejects.toThrow(
      UnrecoverableError
    );

    expect(mocks.mockRefillDb.update).toHaveBeenCalledWith({
      where: { id: 'refill-1' },
      data: { status: 'ERROR' },
    });
    expect(mocks.mockRefill).not.toHaveBeenCalled();
  });

  it('Throws UnrecoverableError if order external ID is missing and marks refill status as ERROR', async () => {
    const refill = mockRefillRecord();
    refill.order.externalId = null;
    mocks.mockRefillDb.findUnique.mockResolvedValue(refill);

    await expect(refillProcessor(fakeJob({ refillId: 'refill-1' }))).rejects.toThrow(
      UnrecoverableError
    );

    expect(mocks.mockRefillDb.update).toHaveBeenCalledWith({
      where: { id: 'refill-1' },
      data: { status: 'ERROR' },
    });
    expect(mocks.mockRefill).not.toHaveBeenCalled();
  });

  it('Throws UnrecoverableError if provider is missing and marks refill status as ERROR', async () => {
    const refill = mockRefillRecord();
    refill.order.service.provider = null;
    mocks.mockRefillDb.findUnique.mockResolvedValue(refill);

    await expect(refillProcessor(fakeJob({ refillId: 'refill-1' }))).rejects.toThrow(
      UnrecoverableError
    );

    expect(mocks.mockRefillDb.update).toHaveBeenCalledWith({
      where: { id: 'refill-1' },
      data: { status: 'ERROR' },
    });
    expect(mocks.mockRefill).not.toHaveBeenCalled();
  });

  it('Throws and retries if provider returns error', async () => {
    const refill = mockRefillRecord();
    mocks.mockRefillDb.findUnique.mockResolvedValue(refill);
    mocks.mockRefill.mockResolvedValue({ error: 'Provider rate limit' });

    await expect(refillProcessor(fakeJob({ refillId: 'refill-1' }))).rejects.toThrow(
      'Provider rate limit'
    );

    expect(mocks.mockRefillDb.update).not.toHaveBeenCalled();
  });
});
