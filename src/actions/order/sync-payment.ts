'use server';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { SettingsManager } from '@/lib/settings';
import { paymentService } from '@/services/financial/payment.service';

/**
 * Проверяет неоплаченные заказы (и пополнения), 
 * совершая прямой REST-запрос к ЮKassa для обхода задержек вебхуков.
 * Возвращает true, если хотя бы один платеж был успешно синхронизирован.
 */
export async function forceSyncMyPaymentsAction(): Promise<boolean> {
  const session = await verifySession();
  if (!session) return false;

  let anySynced = false;

  try {
    // Найти все платежи пользователя в статусе PENDING
    const pendingPayments = await db.payment.findMany({
      where: {
        userId: session.userId,
        status: 'PENDING',
        gateway: 'yookassa',
        gatewayId: { not: null },
        ...(session.tenantId ? { tenantId: session.tenantId } : {})
      },
      take: 5 // Ограничим чтобы не повесить API ЮKassa
    });

    if (pendingPayments.length === 0) return false;

    const tenantId = session.tenantId || 'smmplan';
    const secrets = await SettingsManager.getPaymentSecrets(tenantId);
    const shopId = secrets.yookassaShopId;
    const secretKey = secrets.yookassaSecretKey;
    if (!shopId || !secretKey) return false;

    const authHeader = 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');
    const isTestMode = await SettingsManager.isTestMode(tenantId);

    for (const payment of pendingPayments) {
      if (!payment.gatewayId) continue;

      try {
        const resp = await fetch(`https://api.yookassa.ru/v3/payments/${payment.gatewayId}`, {
          method: 'GET',
          headers: { 'Authorization': authHeader },
          signal: AbortSignal.timeout(5000),
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data.status === 'succeeded' || data.status === 'waiting_for_capture') {
            // Платеж успешно завершен
            await paymentService.confirmPayment(
              payment.gatewayId,
              Number(payment.amount),
              session.userId,
              isTestMode,
              'yookassa',
              payment.id,
              payment.orderId ? 'order' : 'topup'
            );
            anySynced = true;
          }
        }
      } catch (err) {
        console.error(`[AutoSync] Ошибка проверки платежа ${payment.id}:`, err);
      }
    }

    return anySynced;
  } catch (error) {
    console.error(`[AutoSync] Фатальная ошибка:`, error);
    return false;
  }
}
