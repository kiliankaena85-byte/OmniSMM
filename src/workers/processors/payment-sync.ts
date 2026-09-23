import { Job } from 'bullmq';
import { db } from '../../lib/db';
import { SyncJobPayload } from '../../lib/queue-manager';
import { SettingsManager } from '../../lib/settings';
import { paymentService } from '../../services/financial/payment.service';
import { logger } from '../../lib/logger';
import { safeFetch } from '../../lib/security/ssrf-guard';
import { runWithTenantBypass } from '../../lib/tenant-context';

// tenant-isolation-ignore: Global cron job operating on all tenants
const log = logger.child({ component: 'PaymentSyncProcessor' });

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default async function paymentSyncProcessor(job: Job<SyncJobPayload>) {
  log.info('Starting pending payments synchronization...');

  await runWithTenantBypass('Global payment sync cron across all tenants', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. Auto-cancel stale non-YooKassa payments older than 24 hours
    const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
      const stalePayments = await db.payment.findMany({
        where: {
          status: 'PENDING',
          gateway: { notIn: ['yookassa'] },
          createdAt: { lt: staleThreshold }
        },
        select: { id: true, orderId: true },
        take: 50
      });

      for (const payment of stalePayments) {
        try {
          await db.$transaction(async (tx) => {
            const updated = await tx.payment.updateMany({
              where: { id: payment.id, status: 'PENDING' },
              data: { status: 'CANCELED' }
            });
            if (updated.count === 0) return;

            if (payment.orderId) {
              await tx.order.updateMany({
                where: { id: payment.orderId, status: 'AWAITING_PAYMENT' },
                data: { status: 'CANCELED', error: 'Оплата не поступила в течение 24ч (auto-expire)' }
              });
            }
            // WRK-01: basket orders (current architecture — Order.paymentId) must be expired too
            await tx.order.updateMany({
              where: { paymentId: payment.id, status: 'AWAITING_PAYMENT' },
              data: { status: 'CANCELED', error: 'Оплата не поступила в течение 24ч (auto-expire)' }
            });
          });
          log.info(`Stale non-YooKassa payment ${payment.id} expired successfully.`);
        } catch (err) {
          const errMsg = err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err);
          log.error(`Failed to expire stale payment ${payment.id}: ${errMsg}`);
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err);
      log.error(`Error during stale payments cleanup: ${errMsg}`);
    }

    // 2. Fetch pending YooKassa payments
    const pendingPayments = await db.payment.findMany({
      where: {
        status: 'PENDING',
        gateway: 'yookassa',
        createdAt: {
          lt: tenMinutesAgo,
          gt: twentyFourHoursAgo
        }
      },
      take: 50,
      orderBy: { createdAt: 'asc' }
    });

    if (pendingPayments.length === 0) {
      log.info('No pending YooKassa payments found for synchronization.');
      return;
    }

    log.info(`Found ${pendingPayments.length} pending YooKassa payments to check.`);

    const tenantSecretsCache = new Map<string, { authHeader: string | null; isTest: boolean }>();

    async function getTenantAuth(tenantId: string) {
      const tid = tenantId || 'smmplan';
      if (tenantSecretsCache.has(tid)) {
        return tenantSecretsCache.get(tid)!;
      }
      const isTest = await SettingsManager.isTestMode(tid);
      if (isTest) {
        const entry = { authHeader: null, isTest: true };
        tenantSecretsCache.set(tid, entry);
        return entry;
      }
      const secrets = await SettingsManager.getPaymentSecrets(tid);
      const shopId = secrets.yookassaShopId;
      const secretKey = secrets.yookassaSecretKey;
      if (!shopId || !secretKey) {
        const entry = { authHeader: null, isTest: false };
        tenantSecretsCache.set(tid, entry);
        return entry;
      }
      const authHeader = 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');
      const entry = { authHeader, isTest: false };
      tenantSecretsCache.set(tid, entry);
      return entry;
    }

    for (const payment of pendingPayments) {
      if (!payment.gatewayId) {
        log.warn(`Pending payment ${payment.id} has no remote gatewayId. Skipping.`);
        continue;
      }

      const { authHeader, isTest } = await getTenantAuth(payment.tenantId || 'smmplan');
      if (isTest) {
        log.info(`Payment ${payment.id} is in test mode for tenant ${payment.tenantId || 'smmplan'}. Skipping live check.`);
        continue;
      }
      if (!authHeader) {
        log.warn(`Payment ${payment.id} tenant ${payment.tenantId || 'smmplan'} missing YooKassa keys. Skipping.`);
        continue;
      }

      try {
        log.info(`Checking remote status for payment ${payment.id} (YooKassa ID: ${payment.gatewayId}, Tenant: ${payment.tenantId})...`);

        const response = await safeFetch(`https://api.yookassa.ru/v3/payments/${payment.gatewayId}`, {
          method: 'GET',
          headers: {
            'Authorization': authHeader
          },
          signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
          log.error(`Failed to fetch YooKassa payment ${payment.gatewayId}. Status code: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const remoteStatus = data.status; // succeeded, canceled, pending, waiting_for_capture

        log.info(`Payment ${payment.id} remote status is: ${remoteStatus}`);

        if (remoteStatus === 'succeeded') {
          const { ExactMath } = await import('@/lib/financial/exact-math');
          const realAmountCents = ExactMath.rublesToKopecks(data.amount.value);
          log.info(`Payment ${payment.id} succeeded remotely with amount: ${realAmountCents} cents. Confirming locally...`);
          
          const success = await paymentService.confirmPayment(
            payment.gatewayId,
            realAmountCents,
            payment.userId,
            false,
            'yookassa',
            payment.id
          );

          if (success) {
            log.info(`Successfully synced and confirmed payment ${payment.id}.`);
          } else {
            log.error(`Failed to confirm payment ${payment.id} locally during synchronization.`);
          }
        } else if (remoteStatus === 'canceled') {
          log.info(`Payment ${payment.id} has been canceled remotely. Updating local database...`);
          await db.payment.update({
            where: { id: payment.id },
            data: { status: 'CANCELED' }
          });
          // WRK-01: cascade cancellation to basket orders awaiting this payment
          await db.order.updateMany({
            where: { paymentId: payment.id, status: 'AWAITING_PAYMENT' },
            data: { status: 'CANCELED', error: 'Платёж отменён на стороне шлюза (auto-sync)' }
          });
          log.info(`Successfully marked payment ${payment.id} and linked orders as CANCELED.`);
        }
      } catch (err: unknown) {
        log.error(`Exception while syncing payment ${payment.id}: ${(err instanceof Error ? err.message : String(err))}`, { cause: err });
      }
    }
  });

  log.info('Finished pending payments synchronization.');
}
