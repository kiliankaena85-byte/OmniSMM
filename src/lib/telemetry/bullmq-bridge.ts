import { Job } from 'bullmq';
import { withTelemetryContext, generateTraceId, LogContext, getTraceId } from '@/lib/logger';
import { registerValidTenant } from '@/lib/tenant-resolver-edge';
import { tenantStorage } from '@/lib/tenant-context';

export interface TelemetryJobData {
  tenantId?: string;
  metadata?: {
    traceId?: string;
    tenantId?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Extracts or generates a distributed TraceContext from a BullMQ job payload.
 */
export function extractJobTraceContext(job?: Job<TelemetryJobData>): { traceId: string; tenantId: string } {
  const data = (job?.data || {}) as TelemetryJobData;
  const traceId = data.metadata?.traceId || (data as any).traceId || getTraceId() || generateTraceId();
  const tenantId = data.tenantId || data.metadata?.tenantId || tenantStorage.getStore()?.tenantId || 'smmplan';

  return { traceId, tenantId };
}

/**
 * Wraps a BullMQ job processor with automatic Telemetry (traceId) and Tenant Context restoration.
 * Automatically restores AsyncLocalStorage for both logger and multi-tenant scoping.
 */
export function wrapWorkerProcessor<T = any, R = any>(
  componentName: string,
  processor: (job: Job<T>) => Promise<R>
): (job: Job<T>) => Promise<R> {
  return async (job: Job<T>): Promise<R> => {
    const { traceId, tenantId } = extractJobTraceContext(job as any);

    registerValidTenant(tenantId);

    const ctx: LogContext = {
      traceId,
      correlationId: traceId,
      tenantId,
      component: componentName,
    };

    return await withTelemetryContext(ctx, async () => {
      return await processor(job);
    });
  };
}
