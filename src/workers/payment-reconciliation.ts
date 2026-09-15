import { db } from '@/lib/db';
import { paymentService } from '@/services/financial/payment.service';
import { SettingsManager } from '@/lib/settings';
import { safeFetch } from '@/lib/security/ssrf-guard';
import { sendAdminAlert } from '@/lib/notifications';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'PaymentReconciliation' });

export interface ReconciliationReport {
  scanned: number;
  reconciledSuccess: number;
  reconciledCanceled: number;
  orphans: number;
  errors: number;
}

/**
 * Reconciles stale PENDING payments with payment gateways.
 * Runs every 5-10 minutes to catch any payments missed due to lost webhooks.
 */
export async function reconcileStalePayments(): Promise<ReconciliationReport> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const report: ReconciliationReport = {
    scanned: 0,
    reconciledSuccess: 0,
    reconciledCanceled: 0,
    orphans: 0,
    errors: 0,
  };

  try {
    const stalePayments = await db.payment.findMany({
      where: {
        status: 'PENDING',
        createdAt: {
          lte: tenMinutesAgo,
          gte: twentyFourHoursAgo,
        },
      },
      include: {
        user: { select: { id: true, email: true } },
      },
      take: 100,
    });

    report.scanned = stalePayments.length;
    if (stalePayments.length === 0) {
      log.info('No stale PENDING payments found for reconciliation');
      return report;
    }

    log.info(`Found ${stalePayments.length} stale PENDING payments for reconciliation`);

    const reconciledItems: Array<{
      id: string;
      gatewayId: string;
      maskedEmail: string;
      amountRub: string;
      latencyMinutes: number;
    }> = [];

    for (const payment of stalePayments) {
      if (!payment.gatewayId) {
        report.orphans += 1;
        log.warn(`Stale payment ${payment.id} has no remote gatewayId`);
        continue;
      }

      if (payment.gateway === 'yookassa') {
        try {
          const secrets = await SettingsManager.getPaymentSecrets(payment.tenantId).catch(() => null);
          const isTestMode = await SettingsManager.isTestMode(payment.tenantId);
          const authHeader = (secrets?.yookassaShopId && secrets?.yookassaSecretKey)
            ? 'Basic ' + Buffer.from(`${secrets.yookassaShopId}:${secrets.yookassaSecretKey}`).toString('base64')
            : 'Basic mock_auth';

          const res = await safeFetch(`https://api.yookassa.ru/v3/payments/${payment.gatewayId}`, {
            method: 'GET',
            headers: { Authorization: authHeader },
            signal: AbortSignal.timeout(10000),
          });

          if (res.status === 404) {
            report.orphans += 1;
            log.warn(`Payment ${payment.id} (YooKassa: ${payment.gatewayId}) not found on remote gateway`);
            continue;
          }

          if (res.ok) {
            const data = await res.json() as { status: string; amount?: { value: string } };

            if (data.status === 'succeeded') {
              const realAmount = data.amount?.value ? Math.round(parseFloat(data.amount.value) * 100) : Number(payment.amount);
              await paymentService.confirmPayment(
                payment.gatewayId,
                realAmount,
                payment.userId,
                isTestMode,
                'yookassa',
                payment.id
              );
              report.reconciledSuccess += 1;

              const latencyMinutes = Math.max(1, Math.round((Date.now() - new Date(payment.createdAt).getTime()) / 60000));
              const email = payment.user?.email || 'неизвестен';
              const maskedEmail = email.includes('@')
                ? email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => `${a}${'*'.repeat(Math.min(4, b.length))}${c}`)
                : email;

              reconciledItems.push({
                id: payment.id,
                gatewayId: payment.gatewayId,
                maskedEmail,
                amountRub: (Number(payment.amount) / 100).toFixed(2),
                latencyMinutes,
              });

              log.info(`Reconciled succeeded payment ${payment.id} (latency: ${latencyMinutes}m)`);
            } else if (data.status === 'canceled') {
              await db.payment.update({
                where: { id: payment.id },
                data: { status: 'CANCELED' },
              });
              report.reconciledCanceled += 1;
              log.info(`Reconciled canceled payment ${payment.id}`);
            }
          }
        } catch (err) {
          report.errors += 1;
          log.error(`Failed to reconcile payment ${payment.id}`, { error: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    if (reconciledItems.length > 0) {
      const itemsList = reconciledItems.map(item => 
        `• <b>${item.amountRub} ₽</b> — <code>${item.maskedEmail}</code> (Задержка: <b>${item.latencyMinutes} мин</b>, Шлюз: <code>${item.gatewayId}</code>)`
      ).join('\n');

      sendAdminAlert(
        `⚡ <b>[Авто-сверка] Подтверждены зависшие платежи (${reconciledItems.length})</b>\n\nВебхуки не поступили вовремя, балансы начислены через опрос API шлюза:\n\n${itemsList}`,
        'WARNING'
      );
    }

    return report;
  } catch (err) {
    log.error('Payment reconciliation job failed', { error: err instanceof Error ? err.message : String(err) });
    return report;
  }
}
