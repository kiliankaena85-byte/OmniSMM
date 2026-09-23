// tenant-isolation-ignore: Unit test for BullMQ tenant context resolution
import { describe, it, expect, vi, beforeEach } from 'vitest';
import orderProcessor from '@/workers/processors/order.processor';
import refillProcessor from '@/workers/processors/refill.processor';
import { db } from '@/lib/db';
import { Job } from 'bullmq';
import { OrderPreflightGuard } from '@/workers/processors/order/order-preflight-guard';
import { OrderRouteEvaluator } from '@/workers/processors/order/order-route-evaluator';
import { OrderDispatchExecutor } from '@/workers/processors/order/order-dispatch-executor';
import { tenantStorage } from '@/lib/tenant-context';
import { isValidTenant } from '@/lib/tenant-resolver-edge';

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findUnique: vi.fn(),
    },
    refill: {
      findUnique: vi.fn(),
      update: vi.fn(),
    }
  }
}));

vi.mock('@/workers/processors/order/order-preflight-guard', () => ({
  OrderPreflightGuard: {
    validateAndFetchOrder: vi.fn(),
  }
}));

vi.mock('@/workers/processors/order/order-route-evaluator', () => ({
  OrderRouteEvaluator: {
    resolveRoutes: vi.fn(),
  }
}));

vi.mock('@/workers/processors/order/order-dispatch-executor', () => ({
  OrderDispatchExecutor: {
    executeDispatchLoop: vi.fn(),
  }
}));

describe('BullMQ Tenant Context Hotfix Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs within explicit tenant context when job.data.tenantId is provided', async () => {
    let capturedTenantId: string | undefined;

    vi.mocked(OrderPreflightGuard.validateAndFetchOrder).mockImplementation(async () => {
      capturedTenantId = tenantStorage.getStore()?.tenantId;
      return { order: null, redisKey: '' };
    });

    const job = {
      id: 'job-1',
      data: {
        orderId: 'order-flux-1',
        tenantId: 'flux',
      }
    } as unknown as Job;

    await orderProcessor(job as any);

    expect(capturedTenantId).toBe('flux');
    expect(db.order.findUnique).not.toHaveBeenCalled();
  });

  it('resolves true tenantId from DB via runWithTenantBypass when job.data.tenantId is missing', async () => {
    let capturedTenantId: string | undefined;
    let wasBypassActiveDuringQuery: boolean | undefined;

    (vi.mocked(db.order.findUnique) as any).mockImplementation(async () => {
      wasBypassActiveDuringQuery = tenantStorage.getStore()?.isBypass;
      return { tenantId: 'flux' };
    });

    vi.mocked(OrderPreflightGuard.validateAndFetchOrder).mockImplementation(async () => {
      capturedTenantId = tenantStorage.getStore()?.tenantId;
      return { order: null, redisKey: '' };
    });

    const job = {
      id: 'job-2',
      data: {
        orderId: 'order-orphan-flux',
      }
    } as unknown as Job;

    await orderProcessor(job as any);

    expect(wasBypassActiveDuringQuery).toBe(true);
    expect(db.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'order-orphan-flux' },
      select: { tenantId: true },
    });
    expect(capturedTenantId).toBe('flux');
  });

  it('resolves true tenantId for dynamic custom tenant when job.data.tenantId is missing', async () => {
    let capturedTenantId: string | undefined;

    (vi.mocked(db.order.findUnique) as any).mockResolvedValue({ tenantId: 'vip-brand' });

    vi.mocked(OrderPreflightGuard.validateAndFetchOrder).mockImplementation(async () => {
      capturedTenantId = tenantStorage.getStore()?.tenantId;
      return { order: null, redisKey: '' };
    });

    const job = {
      id: 'job-3',
      data: {
        orderId: 'order-vip-99',
      }
    } as unknown as Job;

    await orderProcessor(job as any);

    expect(capturedTenantId).toBe('vip-brand');
  });

  it('falls back to smmplan if order is not found in DB', async () => {
    let capturedTenantId: string | undefined;

    (vi.mocked(db.order.findUnique) as any).mockResolvedValue(null);

    vi.mocked(OrderPreflightGuard.validateAndFetchOrder).mockImplementation(async () => {
      capturedTenantId = tenantStorage.getStore()?.tenantId;
      return { order: null, redisKey: '' };
    });

    const job = {
      id: 'job-4',
      data: {
        orderId: 'non-existent-order',
      }
    } as unknown as Job;

    await orderProcessor(job as any);

    expect(capturedTenantId).toBe('smmplan');
  });

  it('registers resolved dynamic tenant in VALID_TENANTS and updates job.data.tenantId on retry', async () => {
    (vi.mocked(db.order.findUnique) as any).mockResolvedValue({ tenantId: 'dynamic-agency' });

    vi.mocked(OrderPreflightGuard.validateAndFetchOrder).mockResolvedValue({ order: null, redisKey: '' });

    const jobData: any = { orderId: 'order-dynamic-1' };
    const job = {
      id: 'job-5',
      data: jobData,
    } as unknown as Job;

    await orderProcessor(job as any);

    expect(isValidTenant('dynamic-agency')).toBe(true);
    expect(jobData.tenantId).toBe('dynamic-agency');
  });

  it('refillProcessor recovers true tenantId via runWithTenantBypass and sets tenant context', async () => {
    let capturedTenantId: string | undefined;
    let wasBypassActive: boolean | undefined;

    (vi.mocked(db.refill.findUnique) as any).mockImplementation(async (args: any) => {
      // In bypass mode, query returns the order tenantId
      if (args?.select?.order?.select?.tenantId) {
        wasBypassActive = tenantStorage.getStore()?.isBypass;
        return { order: { tenantId: 'flux' } };
      }
      // When inside runWithTenant, capture the context
      capturedTenantId = tenantStorage.getStore()?.tenantId;
      return null; // Stop early
    });

    const job = {
      id: 'refill-job-1',
      data: {
        refillId: 'refill-flux-1',
      }
    } as unknown as Job;

    await refillProcessor(job as any);

    expect(wasBypassActive).toBe(true);
    expect(capturedTenantId).toBe('flux');
  });
});

