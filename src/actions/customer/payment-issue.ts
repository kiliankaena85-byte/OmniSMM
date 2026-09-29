'use server';

import { db } from '@/lib/db';
import { paymentService } from '@/services/financial/payment.service';
import { SettingsManager } from '@/lib/settings';
import { ExactMath } from '@/lib/financial/exact-math';
import { safeFetch } from '@/lib/security/ssrf-guard';
import { logger } from '@/lib/logger';
import { verifySession } from '@/lib/session';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { ticketService } from '@/services/support/ticket.service';

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
 * opens a support ticket with complete transaction context (idempotent deduplication).
 */
export async function reportPaymentIssueAction(paymentId: string): Promise<ReportPaymentIssueResult> {
  if (!paymentId || typeof paymentId !== 'string') {
    return { success: false, message: 'Некорректный идентификатор платежа' };
  }

  try {
    // 0. Anti-Spam Rate Limiting per payment identifier
    const isAllowed = await RateLimitService.checkCustomKey(`payment_issue:${paymentId}`, 5, 60, true);
    if (!isAllowed) {
      return { success: false, message: 'Слишком частые запросы на проверку. Пожалуйста, подождите минуту.' };
    }

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
            const realAmount = data.amount?.value ? ExactMath.rublesToKopecks(data.amount.value) : payment.amount;
            const isTestMode = await SettingsManager.isTestMode(payment.tenantId || 'smmplan');
            await paymentService.confirmPayment(
              payment.gatewayId,
              realAmount,
              payment.userId,
              isTestMode,
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

    // 2. Deduplication Invariant: Check if an active ticket already exists for this payment
    const existingTicket = await db.ticket.findFirst({
      where: {
        paymentId: payment.id,
        status: { in: ['OPEN', 'PENDING'] },
      },
      select: { id: true },
    });

    if (existingTicket) {
      return {
        success: true,
        ticketId: existingTicket.id,
        message: `Обращение по этому платежу уже находится в обработке (Тикет #${existingTicket.id.slice(0, 8)}). Оператор ответит в ближайшее время.`,
      };
    }

    // 3. OmniChat Invariant: Use the customer's unified chat thread instead of creating an isolated split ticket
    const targetUserId = payment.userId || sessionUser?.userId;
    if (!targetUserId) {
      return {
        success: false,
        message: 'Для проверки гостевого платежа, пожалуйста, напишите нам в онлайн-чат и укажите ID: ' + payment.id,
      };
    }

    const linkedOrderId = payment.orders[0]?.id || payment.orderId || null;
    const formattedAmount = `${ExactMath.kopecksToRubles(payment.amount)} ₽`;

    // Retrieve or reuse customer's active chat room
    const ticket = await ticketService.getOrCreateTicket(
      targetUserId,
      'Чат с поддержкой',
      'WEB',
      payment.tenantId || 'smmplan'
    );

    // Attach payment context to ticket if not already set
    await db.ticket.update({
      where: { id: ticket.id },
      data: {
        paymentId: payment.id,
        orderId: linkedOrderId || undefined,
        tags: { set: Array.from(new Set([...(ticket.tags || []), 'PAYMENT', 'AUTO_CHECK', 'URGENT'])) },
      },
    });

    // Append internal system event card into the user's unified chat
    await ticketService.addMessage({
      ticketId: ticket.id,
      sender: 'INTERNAL',
      text: `Клиент сообщил о проблеме с зачислением платежа.\nСумма: ${formattedAmount}\nШлюз: ${payment.gateway}\nGateway ID: ${payment.gatewayId || 'отсутствует'}\nТекущий статус в БД: ${payment.status}`,
      orderId: linkedOrderId || undefined,
    });

    return {
      success: true,
      ticketId: ticket.id,
      message: 'Мы создали обращение в вашем едином чате с поддержкой. Оператор проверит выписку платежа в течение 10 минут.',
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
