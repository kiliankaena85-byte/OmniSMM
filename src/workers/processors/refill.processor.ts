import { Job, UnrecoverableError } from 'bullmq';
import { db } from '../../lib/db';
import { RefillJobPayload } from '@/lib/queue-manager';
import { providerService } from '../../services/providers/provider.service';
import { logger } from '../../lib/logger';
import { classifyRefillError } from '@/services/refill/refill-error-classifier';

const log = logger.child({ component: 'RefillProcessor' });

export default async function refillProcessor(job: Job<RefillJobPayload>) {
  let refillId: string;
  try {
    const { RefillJobSchema } = await import('../../schemas/jobs.schema');
    const parsed = RefillJobSchema.parse(job.data);
    refillId = parsed.refillId;
  } catch (zodErr) {
    log.error(`[RefillProcessor] Invalid job payload for job ${job.id}`, { cause: zodErr });
    throw new UnrecoverableError('Invalid job payload');
  }

  const refill = await db.refill.findUnique({
    where: { id: refillId },
    include: {
      order: {
        include: {
          service: {
            include: {
              provider: true
            }
          }
        }
      }
    }
  });

  if (!refill) {
    log.error(`[RefillProcessor] Refill ${refillId} not found.`);
    return;
  }

  if (refill.status !== 'PENDING') {
    log.warn(`[RefillProcessor] Refill ${refillId} is not PENDING (current status: ${refill.status}). Skipping.`);
    return;
  }

  const order = refill.order;
  if (!order) {
    throw new UnrecoverableError(`Refill ${refillId} has no associated order.`);
  }

  if (order.status === 'CANCELED' || order.status === 'ERROR') {
    await db.refill.update({
      where: { id: refillId },
      data: { status: 'REJECTED' }
    });
    log.warn(`[RefillProcessor] Refill ${refillId} rejected: order status is ${order.status}`);
    return { success: false, status: 'REJECTED', reason: `Order status is ${order.status}` };
  }

  if (!order.externalId) {
    await db.refill.update({
      where: { id: refillId },
      data: { status: 'ERROR' }
    });
    log.error(`[RefillProcessor] Refill ${refillId} aborted: Order ${order.id} has no external ID`);
    return { success: false, status: 'ERROR', reason: 'Order has no external ID' };
  }

  const providerDef = order.service.provider;
  if (!providerDef || !providerDef.apiUrl || !providerDef.apiKey) {
    await db.refill.update({
      where: { id: refillId },
      data: { status: 'ERROR' }
    });
    throw new UnrecoverableError('Provider is missing or misconfigured.');
  }

  const { getRedisConnection } = await import('../../lib/queue-manager');
  const redis = getRedisConnection();
  const mutexKey = `refill:dispatched:${refill.id}`;

  try {
    const acquired = await redis.set(mutexKey, '1', 'EX', 300, 'NX');
    if (!acquired) {
      log.warn(`[RefillProcessor] Duplicate Dispatch Guard: Refill ${refill.id} was already dispatched by previous attempt. Skipping.`);
      return;
    }

    const provider = await providerService.getWorkerProviderInstance(providerDef);
    const response = await provider.refill(order.externalId);

    if (response.error) {
      const classification = classifyRefillError(response.error);
      if (classification.type === 'BUSINESS_REJECTION') {
        await db.refill.update({
          where: { id: refill.id },
          data: { status: 'REJECTED' }
        });
        await redis.del(mutexKey).catch(() => {});
        log.warn(
          `[RefillProcessor] Refill ${refill.id} for order #${order.numericId} rejected by provider (${providerDef.name}): ${response.error} [${classification.code}]`
        );
        return {
          success: false,
          status: 'REJECTED',
          reason: response.error,
          code: classification.code,
          userMessage: classification.userMessage
        };
      }

      // Transient failure: throw so BullMQ retries
      throw new Error(response.error);
    }

    if (!response.refill || response.refill === 0 || response.refill === '0' || typeof response.refill === 'object') {
      throw new Error('No valid refill ID returned by provider');
    }

    const extId = response.refill.toString();

    await db.refill.update({
      where: { id: refill.id },
      data: {
        status: 'IN_PROGRESS',
        externalId: extId
      }
    });

    log.info(`[RefillProcessor] Successfully dispatched refill ${refill.id} for order #${order.numericId} | External ID: ${extId}`);
    return { success: true, status: 'IN_PROGRESS', externalId: extId };
  } catch (error: unknown) {
    log.error(`[RefillProcessor] Failed to process refill ${refill.id}: ${(error instanceof Error ? error.message : String(error))}`);
    await redis.del(mutexKey).catch(() => {});
    throw error;
  }
}

