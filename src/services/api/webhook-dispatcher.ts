import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { safeFetch } from '@/lib/security/ssrf-guard';
import crypto from 'crypto';

const log = logger.child({ component: 'ApiWebhookDispatcher' });

export class ApiWebhookDispatcher {
  /**
   * Dispatches order status updates to API clients who configured webhooks.
   */
  static async dispatchOrderStatusUpdate(orderId: string, status: string) {
    try {
      const order = await db.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          numericId: true,
          userId: true,
          status: true,
          remains: true,
          charge: true,
          link: true,
          createdAt: true
        }
      });

      if (!order) return;

      const apiConfig = await db.apiConfig.findUnique({
        where: { userId: order.userId }
      });

      if (!apiConfig || !apiConfig.isApiEnabled || !apiConfig.isWebhookActive || !apiConfig.webhookUrl) {
        return;
      }

      const payload = JSON.stringify({
        event: 'order.status_update',
        timestamp: new Date().toISOString(),
        data: {
          orderId: order.id,
          numericId: order.numericId,
          status: order.status,
          remains: order.remains,
          chargeCents: Number(order.charge),
          link: order.link,
          createdAt: order.createdAt.toISOString()
        }
      });

      const signature = apiConfig.webhookSecret
        ? crypto.createHmac('sha256', apiConfig.webhookSecret).update(payload).digest('hex')
        : '';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'SMMplan-API-Webhook/2.0'
      };

      if (signature) {
        headers['X-SMMplan-Signature'] = signature;
      }

      const response = await safeFetch(apiConfig.webhookUrl, {
        method: 'POST',
        headers,
        body: payload,
        signal: AbortSignal.timeout(5000) // 5s timeout guard
      });

      await db.apiRequestLog.create({
        data: {
          apiKeyHash: 'webhook_dispatch',
          action: 'order.status_update',
          params: { orderId, status, endpoint: apiConfig.webhookUrl },
          httpStatus: response.status,
          latencyMs: 0
        }
      }).catch(() => {});

      log.info(`[API Webhook] Dispatched status update for order ${order.numericId} to ${apiConfig.webhookUrl} (Status: ${response.status})`);
    } catch (err) {
      log.error(`[API Webhook] Failed to dispatch webhook for order ${orderId}:`, { error: (err as Error).message });
    }
  }
}
