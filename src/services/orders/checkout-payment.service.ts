/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Payment fulfillment and gateway dispatch for checkout pipeline.
 */
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { SettingsProvider } from '@/lib/settings';
import { createSession } from '@/lib/session';
import { sendOrderBalanceDebitMail } from "@/lib/smtp";
import { generateGuestOrderToken } from '@/lib/order-token';
import { getBaseUrlSync } from "@/utils/get-base-url";
import type { User } from '@prisma/client';
import type { DbServiceWithCategory } from './checkout-preflight-guard.service';

export interface CheckoutPaymentInput {
  result: {
    orderId: string;
    paymentId: string;
    numericId: number;
    secondOrderId?: string;
    remainingBalanceCents: number | null;
  };
  user: User;
  service: DbServiceWithCategory;
  gateway: string;
  isNewUser: boolean;
  isTestMode: boolean;
  finalTotalCents: number;
  paymentAmount: number;
  email: string;
  normalizedPromo?: string;
  isLinkOverridden?: boolean;
  link: string;
  tenantId: string;
  currentSessionUserId?: string;
}

export class CheckoutPaymentService {
  static async dispatch(input: CheckoutPaymentInput) {
    const {
      result, user, service, gateway, isNewUser, isTestMode,
      finalTotalCents, paymentAmount, email, normalizedPromo,
      isLinkOverridden, link, tenantId, currentSessionUserId
    } = input;

    let paymentUrl: string | null = null;
    const baseUrl = getBaseUrlSync();
    const successUrl = `${baseUrl}/success?orderId=${result.orderId}`;

    if (gateway === 'balance') {
      const { ordersQueue } = await import('@/lib/queue-manager');
      await ordersQueue.add('order-dispatch', { orderId: result.orderId, tenantId }, { jobId: `dispatch-${result.orderId}`, delay: 3 * 60 * 1000 });
      if (result.secondOrderId) {
        await ordersQueue.add('order-dispatch', { orderId: result.secondOrderId, tenantId }, { jobId: `dispatch-${result.secondOrderId}`, delay: 3 * 60 * 1000 });
      }

      void sendOrderBalanceDebitMail({
        email: user.email || email,
        orderId: result.numericId.toString(),
        serviceName: service.name,
        chargedCents: finalTotalCents,
        remainingBalanceCents: result.remainingBalanceCents,
        tenantId
      }).catch((err: unknown) => console.error('[Checkout] sendOrderBalanceDebitMail balance failed', err));

      try {
        revalidatePath('/dashboard', 'layout');
      } catch {
        /* Ignore in non-HTTP context */
      }

      if (isNewUser || (currentSessionUserId && currentSessionUserId === user.id)) {
        await createSession(user.id);
      }

      return {
        orderId: result.orderId,
        numericId: result.numericId,
        paymentId: result.paymentId,
        paymentUrl: null,
        redirectUrl: `/dashboard/orders?success=1&orderId=${result.orderId}&payment=balance`,
        remainingBalanceRub: result.remainingBalanceCents !== null && result.remainingBalanceCents !== undefined
          ? result.remainingBalanceCents / 100
          : undefined,
        totalKopecks: finalTotalCents,
      };
    }

    try {
      const isMockPayment = typeof SettingsProvider.isMockPaymentEnabled === 'function' ? await SettingsProvider.isMockPaymentEnabled(tenantId) : false;
      const { PaymentGatewayFactory } = await import('@/services/financial/payment-gateway.service');
      const gatewaySvc = PaymentGatewayFactory.getGateway(gateway || 'yookassa', { isMockPayment });
      const gatewayResult = await gatewaySvc.createPayment({
        paymentId: result.paymentId,
        orderId: result.orderId,
        userId: user.id || '',
        tenantId,
        amountRub: paymentAmount / 100,
        email: email,
        successUrl,
        description: `Оплата заказа #${result.numericId} (сдача зачисляется на баланс)`,
        isTestMode: isTestMode,
        metadata: { type: 'checkout', tenantId }
      });

      if (gatewayResult.remoteGatewayId || gatewayResult.paymentUrl) {
        await db.payment.update({
          where: { id: result.paymentId },
          data: {
            gatewayId: gatewayResult.remoteGatewayId || undefined,
            checkoutUrl: gatewayResult.paymentUrl || undefined
          }
        });
      }

      paymentUrl = gatewayResult.paymentUrl || `/payment-redirect?id=${result.paymentId}`;
    } catch (gatewayErr: unknown) {
      console.error('[Checkout] Gateway sequence failed, rolling back sequence', gatewayErr);
      const rollbackPromises: Promise<unknown>[] = [
        Promise.resolve(db.payment.update({
          where: { id: result.paymentId },
          data: { status: 'CANCELED' }
        })).catch(e => console.error('[Checkout] Failed to cancel payment:', e)),
        Promise.resolve(db.order.updateMany({
          where: { paymentId: result.paymentId, tenantId },
          data: { status: 'ERROR', error: (gatewayErr instanceof Error ? gatewayErr.message : String(gatewayErr)) || 'Ошибка генерации платежа' }
        })).catch(e => console.error('[Checkout] Failed to error orders:', e))
      ];

      if (normalizedPromo) {
        rollbackPromises.push(
          db.promoCode.updateMany({
            where: { code: normalizedPromo, uses: { gt: 0 } },
            data: { uses: { decrement: 1 } }
          }).catch(e => console.error('[Checkout] Failed to rollback promo:', e))
        );
      }
      await Promise.allSettled(rollbackPromises);
      throw gatewayErr;
    }

    if (isNewUser || (currentSessionUserId && currentSessionUserId === user.id)) {
      await createSession(user.id);
    }

    if (isLinkOverridden) {
      try {
        const { sendAdminAlert } = await import('@/lib/notifications');
        sendAdminAlert(
          `⚠️ [BYPASS-VALIDATION] Пользователь обошел валидацию ссылки!\nЗаказ: #${result.numericId}\nУслуга: ${service.name} (ID: ${service.id})\nEmail: ${email}\nСсылка: ${link}`,
          'WARNING'
        );
      } catch (err) {
        console.error('[Checkout] Failed to send bypass admin alert:', err);
      }
    }

    try {
      revalidatePath('/dashboard', 'layout');
    } catch {
      /* Ignore in non-HTTP context */
    }

    const guestOrderToken = generateGuestOrderToken(result.orderId, result.numericId);
    return {
      orderId: result.orderId,
      paymentId: result.paymentId,
      paymentUrl,
      redirectUrl: undefined,
      guestOrderToken,
      numericId: result.numericId,
      totalKopecks: finalTotalCents
    };
  }
}
