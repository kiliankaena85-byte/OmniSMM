import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'RevenueRecognition' });

/**
 * Recognizes realized revenue upon order fulfillment.
 */
export async function recognizeOrderRevenue(
  orderId: string,
  amountKopecks: bigint
): Promise<{ success: boolean; id?: string }> {
  try {
    const record = await db.revenueRecognition.upsert({
      where: { orderId },
      create: {
        orderId,
        amount: amountKopecks,
        recognizedAt: new Date(),
      },
      update: {
        amount: amountKopecks,
      },
    });

    log.info('Revenue recognized for order', { orderId, amountKopecks: amountKopecks.toString() });
    return { success: true, id: record.id };
  } catch (err) {
    log.error('Failed to recognize revenue for order', { orderId, error: err });
    return { success: false };
  }
}

/**
 * Reverses recognized revenue upon order cancellation or refund.
 * Maintains immutable audit trail without hard-deleting the initial recognition record.
 */
export async function reverseOrderRevenue(
  orderId: string,
  reversalReason: string
): Promise<{ success: boolean }> {
  try {
    const existing = await db.revenueRecognition.findUnique({
      where: { orderId },
    });

    if (!existing) {
      return { success: false };
    }

    await db.revenueRecognition.update({
      where: { orderId },
      data: {
        reversed: true,
        reversedAt: new Date(),
        reversalReason,
      },
    });

    log.info('Revenue reversed for order', { orderId, reversalReason });
    return { success: true };
  } catch (err) {
    log.error('Failed to reverse revenue for order', { orderId, error: err });
    return { success: false };
  }
}
