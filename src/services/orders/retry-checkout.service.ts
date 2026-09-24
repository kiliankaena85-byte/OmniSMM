/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Order payment retry and YooKassa sync service.
 */
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { SettingsManager, SettingsProvider } from '@/lib/settings';
import { runSerializableTransaction } from '@/lib/transactions';
import { WalletOps } from '@/services/financial/wallet-ops';

export async function checkYookassaStatusSync(gatewayId: string, tenantId: string = 'smmplan'): Promise<boolean> {
  try {
    const secrets = await SettingsManager.getPaymentSecrets(tenantId);
    const shopId = secrets.yookassaShopId;
    const secretKey = secrets.yookassaSecretKey;
    if (!shopId || !secretKey) return false;

    const authHeader = 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');
    const resp = await fetch(`https://api.yookassa.ru/v3/payments/${gatewayId}`, {
      method: 'GET',
      headers: { 'Authorization': authHeader },
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) return false;
    const data = await resp.json();
    return data.status === 'succeeded' || data.status === 'waiting_for_capture';
  } catch (e) {
    console.error('[YookassaSync] Error checking status', e);
    return false;
  }
}

export interface RetryCheckoutInput {
  orderId: string;
  gateway: string;
  sessionUserId: string;
  currentTenantId: string;
  consentIp: string;
  consentUserAgent: string;
  reqHeaders: { get: (key: string) => string | null };
}

export class RetryCheckoutService {
  static async execute(input: RetryCheckoutInput) {
    const { orderId, gateway, sessionUserId, currentTenantId, consentIp, consentUserAgent, reqHeaders } = input;

    const order = await db.order.findUnique({
      where: { id: orderId, userId: sessionUserId },
      include: { user: true, payment: true, service: true }
    });

    if (!order) throw new Error("Заказ не найден");
    if (order.tenantId && order.tenantId !== currentTenantId) {
      throw new Error("Заказ недоступен для текущей площадки");
    }
    if (order.user.isDeleted === true || order.user.isActive === false) {
      throw new Error("Ваш аккаунт заблокирован или удален");
    }
    if (order.status !== 'AWAITING_PAYMENT') throw new Error("Этот заказ больше не ожидает оплаты");

    // YooKassa status sync guard
    if (order.payment?.gateway === 'yookassa' && order.payment.gatewayId) {
      const isActuallyPaid = await checkYookassaStatusSync(order.payment.gatewayId, currentTenantId);
      if (isActuallyPaid) {
        const { paymentService } = await import('@/services/financial/payment.service');
        const isTestMode = await SettingsManager.isTestMode(currentTenantId);
        await paymentService.confirmPayment(
          order.payment.gatewayId,
          Number(order.payment.amount),
          order.userId,
          isTestMode,
          'yookassa',
          order.payment.id,
          'order'
        );
        
        const fwdHost = reqHeaders.get("x-forwarded-host");
        const hostHeader = reqHeaders.get("host");
        let host = fwdHost || hostHeader || "localhost:3000";
        if (host.includes("0.0.0.0") || host.includes("host.docker.internal")) {
          host = process.env.NODE_ENV === "production" ? "test.smmplan.pro" : "localhost:3000";
        }
        const protocol = reqHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
        return { orderId: order.id, paymentId: order.payment.id, paymentUrl: `${protocol}://${host}/success` };
      }
    }

    const isTestMode = await SettingsManager.isTestMode();

    const result = await runSerializableTransaction<{ paymentId: string; totalPaymentAmount: number; linkedOrderIds: string[] }>(async (tx) => {
      const existingPayment = order.payment || await tx.payment.findUnique({ where: { orderId: order.id } });
      let ordersToProcess = [order];
      if (existingPayment) {
        const linkedOrders = await tx.order.findMany({
          where: { paymentId: existingPayment.id, status: 'AWAITING_PAYMENT', ...(order.tenantId ? { tenantId: order.tenantId } : {}) }
        });
        if (linkedOrders.length > 0) {
          const orderMap = new Map();
          orderMap.set(order.id, order);
          for (const lo of linkedOrders) orderMap.set(lo.id, lo);
          ordersToProcess = Array.from(orderMap.values());
        }
      }

      let totalChargeCents = 0;
      for (const o of ordersToProcess) totalChargeCents += Number(o.charge);

      let paymentAmount = totalChargeCents;
      if (gateway !== 'balance' && totalChargeCents < 1000) paymentAmount = 1000;

      if (gateway === 'balance') {
        await WalletOps.charge(tx, sessionUserId, totalChargeCents, `Повторная оплата заказа с баланса`, {
          idempotencyKey: `retry-balance-${order.id}-${existingPayment?.id || 'init'}`,
          tenantId: order.tenantId || 'smmplan'
        });
      }

      let paymentId = existingPayment?.id;
      if (existingPayment) {
        await tx.payment.update({
          where: { id: existingPayment.id },
          data: {
            gateway,
            amount: paymentAmount,
            status: gateway === 'balance' ? 'SUCCEEDED' : existingPayment.status,
            consentIp,
            consentUserAgent
          }
        });
      } else {
        const p = await tx.payment.create({
          data: {
            userId: sessionUserId,
            amount: paymentAmount,
            currency: 'RUB',
            status: gateway === 'balance' ? 'SUCCEEDED' : 'PENDING',
            gateway,
            consentIp,
            consentUserAgent,
            tenantId: order.tenantId || 'smmplan'
          }
        });
        paymentId = p.id;
      }

      for (const o of ordersToProcess) {
        await tx.order.update({
          where: { id: o.id },
          data: {
            paymentId: paymentId!,
            ...(gateway === 'balance' ? { status: 'PENDING' } : {})
          }
        });
      }

      return { paymentId: paymentId!, totalPaymentAmount: paymentAmount, linkedOrderIds: ordersToProcess.map(o => o.id) };
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (gateway === 'balance') {
      const { ordersQueue } = await import('@/lib/queue-manager');
      for (const linkedId of result.linkedOrderIds) {
        await ordersQueue.add(
          'order-dispatch',
          { orderId: linkedId, tenantId: order.tenantId || 'smmplan' },
          { jobId: `dispatch-${linkedId}-${Date.now()}`, delay: 3 * 60 * 1000 }
        );
      }

      try {
        revalidatePath('/dashboard', 'layout');
      } catch {
        /* ignore non-HTTP */
      }

      return {
        orderId: order.id,
        paymentId: result.paymentId,
        paymentUrl: `${baseUrl}/success?orderId=${order.id}`
      };
    }

    const isMockPayment = typeof SettingsProvider.isMockPaymentEnabled === 'function' ? await SettingsProvider.isMockPaymentEnabled(order.tenantId || 'smmplan') : false;
    const { PaymentGatewayFactory } = await import('@/services/financial/payment-gateway.service');
    const gatewaySvc = PaymentGatewayFactory.getGateway(gateway || 'yookassa', { isMockPayment });
    const gatewayResult = await gatewaySvc.createPayment({
      paymentId: result.paymentId,
      orderId: order.id,
      userId: sessionUserId,
      tenantId: order.tenantId || 'smmplan',
      amountRub: result.totalPaymentAmount / 100,
      email: order.user.email,
      successUrl: `${baseUrl}/success?orderId=${order.id}`,
      description: `Повторная оплата заказа #${order.numericId}`,
      isTestMode,
      metadata: { type: 'checkout', tenantId: order.tenantId }
    });

    if (gatewayResult.remoteGatewayId || gatewayResult.paymentUrl) {
      await db.payment.update({
        where: { id: result.paymentId },
        data: { gatewayId: gatewayResult.remoteGatewayId || undefined, checkoutUrl: gatewayResult.paymentUrl || undefined }
      });
    }

    try {
      revalidatePath('/dashboard', 'layout');
    } catch {
      /* ignore non-HTTP */
    }

    return {
      orderId: order.id,
      paymentId: result.paymentId,
      paymentUrl: gatewayResult.paymentUrl || `/payment-redirect?id=${result.paymentId}`
    };
  }
}
