import { db } from '@/lib/db';
import { sendAdminAlert } from '@/lib/notifications';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'WebhookHealthMonitor' });

export interface WebhookHealthResult {
  healthy: boolean;
  pendingCount: number;
  succeededCount: number;
  alertSent: boolean;
}

/**
 * Checks for silent webhook failures (e.g. gateway dropped webhook delivery,
 * SSL certificate issues on tunnel, or invalid endpoint route).
 */
export async function checkWebhookHealth(): Promise<WebhookHealthResult> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  try {
    const recentPayments = await db.payment.findMany({
      where: {
        createdAt: { gte: oneHourAgo },
      },
      select: {
        id: true,
        status: true,
        gateway: true,
        createdAt: true,
      },
    });

    const pendingCount = recentPayments.filter(p => p.status === 'PENDING').length;
    const succeededCount = recentPayments.filter(p => p.status === 'SUCCEEDED').length;

    let healthy = true;
    let alertSent = false;

    // If there are multiple pending payments in the last hour but ZERO succeeded payments across gateways,
    // this strongly indicates broken incoming webhooks.
    if (pendingCount >= 3 && succeededCount === 0) {
      healthy = false;
      alertSent = true;
      log.error('Silent Webhook Failure Detected: 0 successes with multiple pending payments', {
        pendingCount,
        succeededCount,
      });

      sendAdminAlert(
        `🚨 <b>CRITICAL: Сбой платёжных вебхуков!</b>\nЗа последний час создано ${pendingCount} платежей, но получено <b>0 успешных подтверждений</b>.\nПроверьте доступность URL вебхука и логи платёжного шлюза!`,
        'CRITICAL'
      );
    } else {
      log.info('Webhook health check OK', { pendingCount, succeededCount });
    }

    return {
      healthy,
      pendingCount,
      succeededCount,
      alertSent,
    };
  } catch (err) {
    log.error('Failed to execute webhook health check', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      healthy: false,
      pendingCount: 0,
      succeededCount: 0,
      alertSent: false,
    };
  }
}
