import { redis } from '@/lib/redis';
import { db } from '@/lib/db';
import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'RealtimeOrderStatus' });

export interface OrderStatusPayload {
  orderId: string;
  status: string;
  remains?: number | null;
  startCount?: number | null;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

// In-memory emitter for local test and non-redis environments
export const memoryOrderEmitter = new EventEmitter();

/**
 * Publishes order status transition to real-time subscribers (SSE / WebSockets).
 */
export async function publishOrderStatusUpdate(
  orderId: string,
  status: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const payload: OrderStatusPayload = {
    orderId,
    status,
    updatedAt: new Date().toISOString(),
    metadata,
  };

  const channel = `order:${orderId}:status`;
  const serialized = JSON.stringify(payload);

  // 1. In-memory local emit
  memoryOrderEmitter.emit(channel, payload);

  // 2. Redis Pub/Sub broadcast
  try {
    if (redis && typeof redis.publish === 'function') {
      await redis.publish(channel, serialized);
    }
  } catch (err) {
    log.warn('Redis publish failed, local emission completed', { orderId, error: err });
  }

  // 3. Auto-resolve dispute tickets if order completed
  if (status === 'COMPLETED') {
    try {
      await autoResolveOrderDisputes(orderId);
    } catch (err) {
      log.error('Failed to auto-resolve disputes on order completion', { orderId, error: err });
    }
  }
}

/**
 * Automatically resolves pending dispute tickets when an order reaches COMPLETED state.
 */
export async function autoResolveOrderDisputes(orderId: string): Promise<number> {
  const tickets = await db.ticket.findMany({
    where: {
      orderId,
      status: { in: ['OPEN', 'PENDING'] },
      tags: { hasSome: ['DISPUTE', 'NOT_DELIVERED', 'STATUS_LAG'] },
    },
  });

  if (tickets.length === 0) return 0;

  for (const ticket of tickets) {
    await db.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'CLOSED',
        messages: {
          create: {
            sender: 'INTERNAL',
            text: `✅ [Авто-разрешение] Заказ #${orderId.slice(0, 8)} успешно выполнен провайдером (статус COMPLETED). Тикет спора автоматически закрыт.`,
          },
        },
      },
    });
  }

  log.info('Auto-resolved dispute tickets for completed order', {
    orderId,
    closedCount: tickets.length,
  });

  return tickets.length;
}
