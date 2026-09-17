'use server';

import { db } from '@/lib/db';
import { paymentService } from '@/services/financial/payment.service';
import { SettingsManager } from '@/lib/settings';
import { safeFetch } from '@/lib/security/ssrf-guard';
import { logger } from '@/lib/logger';
import { verifySession } from '@/lib/session';

const log = logger.child({ component: 'CustomerPaymentIssue' });

export interface ReportPaymentIssueResult {
  success: boolean;
  message: string;
  ticketId?: string;
  resolvedNow?: boolean;
}

/**
 * Customer Self-Service action: "Не вижу оплату / Проверить платёж".
 * Performs immediate real-time sync with the payment gateway, and if still unresolved,
 * opens a support ticket with complete transaction context.
 */
export async function reportPaymentIssueAction(paymentId: string): Promise<ReportPaymentIssueResult> {
  if (!paymentId || typeof paymentId !== 'string') {
    return { success: false, message: 'Некорректный идентификатор платежа' };
  }

  try {
    let sessionUser: { userId: string } | null = null;
    try {
      sessionUser = await verifySession();
    } catch {
      // Guest context or non-session caller
    }

    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: {
        orders: { select: { id: true, numericId: true } },
      },
    });

    if (!payment) {
      return { success: false, message: 'Платёж не найден в системе' };
    }

    // Security check: if payment belongs to a user account, require caller to be that authenticated user
    if (payment.userId && (!sessionUser || payment.userId !== sessionUser.userId)) {
      return { success: false, message: 'Доступ ограничен' };
    }

    if (payment.status === 'SUCCEEDED') {
      return {
        success: true,
        resolvedNow: true,
        message: 'Платёж уже успешно зачислен на ваш баланс / заказ активен.',
      };
    }

    // 1. Immediate sync check with gateway
    if (payment.gatewayId && payment.gateway === 'yookassa') {
      const secrets = await SettingsManager.getPaymentSecrets(payment.tenantId || 'smmplan').catch(() => null);
      const authHeader = (secrets?.yookassaShopId && secrets?.yookassaSecretKey)
        ? 'Basic ' + Buffer.from(`${secrets.yookassaShopId}:${secrets.yookassaSecretKey}`).toString('base64')
        : 'Basic mock';

      try {
        const res = await safeFetch(`https://api.yookassa.ru/v3/payments/${payment.gatewayId}`, {
          headers: { Authorization: authHeader },
          signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
          const data = await res.json() as { status: string; amount?: { value: string } };
          if (data.status === 'succeeded') {
            const realAmount = data.amount?.value ? Math.round(parseFloat(data.amount.value) * 100) : Number(payment.amount);
            await paymentService.confirmPayment(
              payment.gatewayId,
              realAmount,
              payment.userId,
              false,
              'yookassa',
              payment.id
            );

            return {
              success: true,
              resolvedNow: true,
              message: 'Оплата успешно подтверждена шлюзом и зачислена!',
            };
          }
        }
      } catch (err) {
        log.warn('Live gateway check during customer report failed', { error: err });
      }
    }

    // 2. If payment is still pending, automatically create a support ticket
    const linkedOrderId = payment.orders[0]?.id || payment.orderId || null;
    const ticket = await db.ticket.create({
      data: {
        userId: payment.userId,
        subject: `[Авто-проверка оплаты] Платёж #${payment.id.slice(0, 8)}`,
        status: 'OPEN',
        tags: ['PAYMENT', 'AUTO_CHECK', 'URGENT'],
        paymentId: payment.id,
        orderId: linkedOrderId,
        messages: {
          create: {
            sender: 'INTERNAL',
            text: `Клиент сообщил о проблеме с зачислением платежа.\nСумма: ${(Number(payment.amount) / 100).toFixed(2)} ₽\nШлюз: ${payment.gateway}\nGateway ID: ${payment.gatewayId || 'отсутствует'}\nТекущий статус в БД: ${payment.status}`,
          },
        },
      },
    });

    return {
      success: true,
      ticketId: ticket.id,
      message: 'Мы создали обращение в службу поддержки (Тикет #' + ticket.id.slice(0, 8) + '). Оператор проверит выписку платежа в течение 10 минут.',
    };
  } catch (err) {
    log.error('Customer payment issue action failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      message: 'Произошла ошибка при проверке платежа. Пожалуйста, напишите нам в онлайн-чат.',
    };
  }
}
