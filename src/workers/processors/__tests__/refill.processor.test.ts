import { describe, it, expect, vi, beforeEach } from 'vitest';
import refillProcessor from '../refill.processor';
import { db } from '../../../lib/db';
import { providerService } from '../../../services/providers/provider.service';

vi.mock('../../../lib/db', () => ({
  db: {
    refill: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../../services/providers/provider.service', () => ({
  providerService: {
    getWorkerProviderInstance: vi.fn(),
  },
}));

const mockRedis = {
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
};

vi.mock('../../../lib/queue-manager', () => ({
  getRedisConnection: () => mockRedis,
}));

describe('Refill Processor (Architectural Self-Healing)', () => {
  const mockJob = {
    id: 'job-refill-1',
    data: { refillId: 'refill-123' },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.set.mockResolvedValue('OK');
  });

  it('successfully dispatches refill and sets status to IN_PROGRESS', async () => {
    vi.mocked(db.refill.findUnique).mockResolvedValue({
      id: 'refill-123',
      status: 'PENDING',
      order: {
        id: 'order-1',
        numericId: 176,
        externalId: '299048069',
        status: 'COMPLETED',
        service: {
          provider: {
            id: 'p1',
            name: 'Vexboost',
            apiUrl: 'https://vexboost.com/api/v2',
            apiKey: 'key123',
          },
        },
      },
    } as any);

    const mockProvider = {
      refill: vi.fn().mockResolvedValue({ refill: 554433 }),
    };
    vi.mocked(providerService.getWorkerProviderInstance).mockResolvedValue(mockProvider as any);

    const result = await refillProcessor(mockJob);

    expect(mockProvider.refill).toHaveBeenCalledWith('299048069');
    expect(db.refill.update).toHaveBeenCalledWith({
      where: { id: 'refill-123' },
      data: {
        status: 'IN_PROGRESS',
        externalId: '554433',
      },
    });
    expect(result).toEqual({
      success: true,
      status: 'IN_PROGRESS',
      externalId: '554433',
    });
  });

  it('handles provider business rejection "is_not_available" gracefully without retries or throwing', async () => {
    vi.mocked(db.refill.findUnique).mockResolvedValue({
      id: 'refill-123',
      status: 'PENDING',
      order: {
        id: 'order-1',
        numericId: 176,
        externalId: '299048069',
        status: 'COMPLETED',
        service: {
          provider: {
            id: 'p1',
            name: 'Vexboost',
            apiUrl: 'https://vexboost.com/api/v2',
            apiKey: 'key123',
          },
        },
      },
    } as any);

    const mockProvider = {
      refill: vi.fn().mockResolvedValue({ error: 'is_not_available' }),
    };
    vi.mocked(providerService.getWorkerProviderInstance).mockResolvedValue(mockProvider as any);

    // Must NOT throw an error (which would cause BullMQ retries and DLQ dump)
    const result = await refillProcessor(mockJob);

    expect(db.refill.update).toHaveBeenCalledWith({
      where: { id: 'refill-123' },
      data: { status: 'REJECTED' },
    });
    expect(result).toMatchObject({
      success: false,
      status: 'REJECTED',
      reason: 'is_not_available',
      code: 'REFILL_NOT_AVAILABLE',
    });
  });

  it('handles provider business rejection "guarantee_expired" without throwing', async () => {
    vi.mocked(db.refill.findUnique).mockResolvedValue({
      id: 'refill-123',
      status: 'PENDING',
      order: {
        id: 'order-1',
        numericId: 176,
        externalId: '299048069',
        status: 'COMPLETED',
        service: {
          provider: {
            id: 'p1',
            name: 'Vexboost',
            apiUrl: 'https://vexboost.com/api/v2',
            apiKey: 'key123',
          },
        },
      },
    } as any);

    const mockProvider = {
      refill: vi.fn().mockResolvedValue({ error: 'guarantee_expired' }),
    };
    vi.mocked(providerService.getWorkerProviderInstance).mockResolvedValue(mockProvider as any);

    const result = await refillProcessor(mockJob);

    expect(db.refill.update).toHaveBeenCalledWith({
      where: { id: 'refill-123' },
      data: { status: 'REJECTED' },
    });
    expect(result).toMatchObject({
      success: false,
      status: 'REJECTED',
      code: 'GUARANTEE_EXPIRED',
    });
  });

  it('throws on transient network error so BullMQ can perform backoff retries', async () => {
    vi.mocked(db.refill.findUnique).mockResolvedValue({
      id: 'refill-123',
      status: 'PENDING',
      order: {
        id: 'order-1',
        numericId: 176,
        externalId: '299048069',
        status: 'COMPLETED',
        service: {
          provider: {
            id: 'p1',
            name: 'Vexboost',
            apiUrl: 'https://vexboost.com/api/v2',
            apiKey: 'key123',
          },
        },
      },
    } as any);

    const mockProvider = {
      refill: vi.fn().mockResolvedValue({ error: 'ETIMEDOUT: upstream gateway timeout' }),
    };
    vi.mocked(providerService.getWorkerProviderInstance).mockResolvedValue(mockProvider as any);

    await expect(refillProcessor(mockJob)).rejects.toThrow('ETIMEDOUT: upstream gateway timeout');
    // Ensure mutex key was released on error so retry can reacquire
    expect(mockRedis.del).toHaveBeenCalledWith('refill:dispatched:refill-123');
  });

  it('skips processing if refill record is already IN_PROGRESS or COMPLETED', async () => {
    vi.mocked(db.refill.findUnique).mockResolvedValue({
      id: 'refill-123',
      status: 'IN_PROGRESS',
      order: { id: 'order-1' },
    } as any);

    await refillProcessor(mockJob);
    expect(providerService.getWorkerProviderInstance).not.toHaveBeenCalled();
  });

  it('skips processing if duplicate dispatch mutex is locked', async () => {
    vi.mocked(db.refill.findUnique).mockResolvedValue({
      id: 'refill-123',
      status: 'PENDING',
      order: {
        id: 'order-1',
        numericId: 176,
        externalId: '299048069',
        status: 'COMPLETED',
        service: {
          provider: { id: 'p1', apiUrl: 'url', apiKey: 'key' },
        },
      },
    } as any);

    // Simulate mutex already acquired
    mockRedis.set.mockResolvedValue(null);

    await refillProcessor(mockJob);
    expect(providerService.getWorkerProviderInstance).not.toHaveBeenCalled();
  });

  it('gracefully rejects refill if order was canceled', async () => {
    vi.mocked(db.refill.findUnique).mockResolvedValue({
      id: 'refill-123',
      status: 'PENDING',
      order: {
        id: 'order-1',
        numericId: 176,
        status: 'CANCELED',
        service: {
          provider: { id: 'p1', apiUrl: 'url', apiKey: 'key' },
        },
      },
    } as any);

    const res = await refillProcessor(mockJob);
    expect(db.refill.update).toHaveBeenCalledWith({
      where: { id: 'refill-123' },
      data: { status: 'REJECTED' },
    });
    expect(res).toMatchObject({
      success: false,
      status: 'REJECTED',
    });
  });

  it('releases dispatch mutex when provider returns a business rejection', async () => {
    vi.mocked(db.refill.findUnique).mockResolvedValue({
      id: 'refill-123',
      status: 'PENDING',
      order: {
        id: 'order-1',
        numericId: 176,
        externalId: '299048069',
        status: 'COMPLETED',
        service: {
          provider: { id: 'p1', apiUrl: 'url', apiKey: 'key' },
        },
      },
    } as any);

    const mockProvider = {
      refill: vi.fn().mockResolvedValue({ error: 'is_not_available' }),
    };
    vi.mocked(providerService.getWorkerProviderInstance).mockResolvedValue(mockProvider as any);

    await refillProcessor(mockJob);

    expect(mockRedis.del).toHaveBeenCalledWith('refill:dispatched:refill-123');
  });

  it('rejects provider response when refill ID is an object instead of string or number', async () => {
    vi.mocked(db.refill.findUnique).mockResolvedValue({
      id: 'refill-123',
      status: 'PENDING',
      order: {
        id: 'order-1',
        numericId: 176,
        externalId: '299048069',
        status: 'COMPLETED',
        service: {
          provider: { id: 'p1', apiUrl: 'url', apiKey: 'key' },
        },
      },
    } as any);

    const mockProvider = {
      refill: vi.fn().mockResolvedValue({ refill: { unexpected: 'nested object' } }),
    };
    vi.mocked(providerService.getWorkerProviderInstance).mockResolvedValue(mockProvider as any);

    await expect(refillProcessor(mockJob)).rejects.toThrow('No valid refill ID returned by provider');
  });
});
