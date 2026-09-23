import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPendingCheckResolution } from '../cleanup.processor';
import { db } from '../../../lib/db';
import { providerService } from '@/services/providers/provider.service';
import { orderService } from '@/services/core/order.service';

vi.mock('../../../lib/db', () => ({
  db: {
    order: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  }
}));

vi.mock('@/services/providers/provider.service', () => ({
  providerService: {
    getWorkerProviderInstance: vi.fn(),
  }
}));

vi.mock('@/services/core/order.service', () => ({
  orderService: {
    processStatusUpdate: vi.fn(),
    failOrderTerminalFast: vi.fn(),
  }
}));

describe('WRK-03: PENDING_CHECK Auto-Resolution (runPendingCheckResolution)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves stale PENDING_CHECK order (>6h) when provider returns valid status', async () => {
    const mockOrder = {
      id: 'order-pc-1',
      numericId: 1001,
      externalId: 'ext-1001',
      status: 'PENDING_CHECK',
      updatedAt: new Date(Date.now() - 7 * 60 * 60 * 1000), // 7h ago
      service: {
        provider: {
          id: 'prov-1',
          name: 'Provider 1',
          apiUrl: 'https://api.prov.com',
          apiKey: 'key-1'
        }
      }
    };

    vi.mocked(db.order.findMany).mockResolvedValue([mockOrder] as any);

    const mockProviderInstance = {
      getOrderStatus: vi.fn().mockResolvedValue({ status: 'Completed', remains: '0' })
    };
    vi.mocked(providerService.getWorkerProviderInstance).mockResolvedValue(mockProviderInstance as any);

    await runPendingCheckResolution();

    expect(db.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'PENDING_CHECK',
      })
    }));

    expect(providerService.getWorkerProviderInstance).toHaveBeenCalledWith(mockOrder.service.provider);
    expect(mockProviderInstance.getOrderStatus).toHaveBeenCalledWith('ext-1001');
    expect(orderService.processStatusUpdate).toHaveBeenCalledWith('ext-1001', 'Completed', 0);
    expect(orderService.failOrderTerminalFast).not.toHaveBeenCalled();
  });

  it('does NOT fail order when provider status is temporarily unavailable (transient API timeout)', async () => {
    const mockOrder = {
      id: 'order-pc-2',
      numericId: 1002,
      externalId: 'ext-1002',
      status: 'PENDING_CHECK',
      updatedAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
      service: {
        provider: {
          id: 'prov-1',
          name: 'Provider 1'
        }
      }
    };

    vi.mocked(db.order.findMany).mockResolvedValue([mockOrder] as any);

    const mockProviderInstance = {
      getOrderStatus: vi.fn().mockResolvedValue(null)
    };
    vi.mocked(providerService.getWorkerProviderInstance).mockResolvedValue(mockProviderInstance as any);

    await runPendingCheckResolution();

    expect(orderService.processStatusUpdate).not.toHaveBeenCalled();
    // Safety Invariant: Must NOT auto-cancel customer order on transient provider timeout
    expect(orderService.failOrderTerminalFast).not.toHaveBeenCalled();
  });

  it('does not touch PENDING_CHECK orders younger than 6 hours threshold', async () => {
    // When threshold filter in db.order.findMany returns empty list
    vi.mocked(db.order.findMany).mockResolvedValue([]);

    await runPendingCheckResolution();

    expect(providerService.getWorkerProviderInstance).not.toHaveBeenCalled();
    expect(orderService.processStatusUpdate).not.toHaveBeenCalled();
    expect(orderService.failOrderTerminalFast).not.toHaveBeenCalled();
  });
});
