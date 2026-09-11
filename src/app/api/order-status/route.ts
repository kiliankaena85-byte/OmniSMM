export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { SettingsManager } from '@/lib/settings';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { getClientIp } from '@/utils/ip';
import { verifyGuestOrderToken } from '@/lib/order-token';

/**
 * GET /api/order-status?orderId=xxx
 * Returns the current status of an order for the authenticated user.
 * Used by the success page to poll for webhook confirmation.
 */
export async function GET(req: NextRequest) {
  try {
    const ip = await getClientIp(req);
    const isAllowed = await RateLimitService.check(`order_status:${ip}`, 30, 60);
    if (!isAllowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const session = await verifySession();
    const orderId = req.nextUrl.searchParams.get('orderId');
    const paymentId = req.nextUrl.searchParams.get('paymentId');
    const token = req.nextUrl.searchParams.get('token');

    if (!orderId && !paymentId) {
      return NextResponse.json({ error: 'Missing orderId or paymentId' }, { status: 400 });
    }

    // [Phase 3 Surgeon] Validate capability token to handle sessionless payment redirects
    let isTokenValid = false;
    if (token) {
      try {
        const { jwtVerify } = await import('jose');
        const { getEncodedKey } = await import('@/lib/session');
        const { payload } = await jwtVerify(token, getEncodedKey());
        if (payload.purpose === 'payment_return' && (payload.orderId === orderId || payload.paymentId === paymentId)) {
          isTokenValid = true;
        }
      } catch {
        // Token verification failed, proceed without token authorization
      }
    }

    if (orderId) {
      let order = await db.order.findUnique({
        where: session ? { id: orderId, userId: session.userId } : { id: orderId },
        include: {
          payment: true,
          service: { select: { name: true } },
        },
      });

      if (!order) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      if (token && !isTokenValid && verifyGuestOrderToken(order.id, order.numericId, token)) {
        isTokenValid = true;
      }

      if (!session && !isTokenValid) {
        const isAwaiting = order.status === 'AWAITING_PAYMENT';
        const isRecentlyUpdated = order.updatedAt && (Date.now() - new Date(order.updatedAt).getTime() < 15 * 60 * 1000);
        if (!isAwaiting && !isRecentlyUpdated) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
      }

      // Synchronous status check fallback
      if (order.status === 'AWAITING_PAYMENT' && order.payment && order.payment.gatewayId) {
        const gateway = order.payment.gateway;
        const gatewayId = order.payment.gatewayId;
        const pId = order.payment.id;
        
        let isActuallyPaid = false;
        let checkAmount = Number(order.payment.amount);

        if (gatewayId.startsWith('yoo_test_mock_') || gatewayId.startsWith('crypto_test_mock_') || gatewayId.startsWith('robo_test_mock_') || gatewayId.startsWith('mock_')) {
          isActuallyPaid = true;
        } else if (gateway === 'yookassa') {
          const secrets = await SettingsManager.getPaymentSecrets();
          if (secrets.yookassaShopId && secrets.yookassaSecretKey) {
            const authHeader = 'Basic ' + Buffer.from(`${secrets.yookassaShopId}:${secrets.yookassaSecretKey}`).toString('base64');
            try {
              const response = await fetch(`https://api.yookassa.ru/v3/payments/${gatewayId}`, {
                headers: { 'Authorization': authHeader },
                signal: AbortSignal.timeout(5000),
              });
              if (response.ok) {
                const data = await response.json();
                if (data.status === 'succeeded' || data.status === 'waiting_for_capture') {
                  isActuallyPaid = true;
                  checkAmount = Math.round(parseFloat(data.amount.value) * 100);
                }
              }
            } catch (e: unknown) {
              console.error('[order-status] YooKassa sync fallback failed:', (e instanceof Error ? e.message : String(e)));
            }
          }
        } else if (gateway === 'cryptobot' || gateway === 'robokassa') {
          try {
            const { PaymentGatewayFactory } = await import('@/services/financial/payment-gateway.service');
            const gatewaySvc = PaymentGatewayFactory.getGateway(gateway);
            if (gatewaySvc.checkStatusSync) {
              isActuallyPaid = await gatewaySvc.checkStatusSync(gatewayId);
            }
          } catch (e: unknown) {
            console.error(`[order-status] ${gateway} sync fallback failed:`, (e instanceof Error ? e.message : String(e)));
          }
        }

        if (isActuallyPaid) {
          const isTestMode = await SettingsManager.isTestMode();
          const { paymentService } = await import('@/services/financial/payment.service');
          await paymentService.confirmPayment(
            gatewayId,
            checkAmount,
            order.userId,
            isTestMode,
            gateway as 'yookassa' | 'cryptobot' | 'robokassa',
            pId,
            'order'
          );

          const updatedOrder = await db.order.findUnique({
            where: session ? { id: orderId, userId: session.userId } : { id: orderId },
            include: {
              payment: true,
              service: { select: { name: true } },
            },
          });
          if (updatedOrder) order = updatedOrder;
        }
      }

      if (!session && !isTokenValid) {
        return NextResponse.json({
          orderId: order.id,
          numericId: order.numericId,
          status: order.status,
        });
      }

      return NextResponse.json({
        orderId: order.id,
        numericId: order.numericId,
        status: order.status,
        charge: Number(order.charge),
        quantity: order.quantity,
        serviceName: order.service.name,
      });

    } else if (paymentId) {
      let payment = await db.payment.findUnique({
        where: session ? { id: paymentId, userId: session.userId } : { id: paymentId },
      });

      if (!payment) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      if (!session && !isTokenValid) {
        const isAwaiting = payment.status === 'PENDING';
        const isRecentlyUpdated = payment.updatedAt && (Date.now() - new Date(payment.updatedAt).getTime() < 15 * 60 * 1000);
        if (!isAwaiting && !isRecentlyUpdated) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
      }

      // Synchronous status check fallback
      if (payment.status === 'PENDING' && payment.gatewayId) {
        const gateway = payment.gateway;
        const gatewayId = payment.gatewayId;
        
        let isActuallyPaid = false;
        let checkAmount = Number(payment.amount);

        if (gatewayId.startsWith('yoo_test_mock_') || gatewayId.startsWith('crypto_test_mock_') || gatewayId.startsWith('robo_test_mock_') || gatewayId.startsWith('mock_')) {
          isActuallyPaid = true;
        } else if (gateway === 'yookassa') {
          const secrets = await SettingsManager.getPaymentSecrets();
          if (secrets.yookassaShopId && secrets.yookassaSecretKey) {
            const authHeader = 'Basic ' + Buffer.from(`${secrets.yookassaShopId}:${secrets.yookassaSecretKey}`).toString('base64');
            try {
              const response = await fetch(`https://api.yookassa.ru/v3/payments/${gatewayId}`, {
                headers: { 'Authorization': authHeader },
                signal: AbortSignal.timeout(5000),
              });
              if (response.ok) {
                const data = await response.json();
                if (data.status === 'succeeded' || data.status === 'waiting_for_capture') {
                  isActuallyPaid = true;
                  checkAmount = Math.round(parseFloat(data.amount.value) * 100);
                }
              }
            } catch (e: unknown) {
              console.error('[order-status] YooKassa sync fallback failed:', (e instanceof Error ? e.message : String(e)));
            }
          }
        } else if (gateway === 'cryptobot' || gateway === 'robokassa') {
          try {
            const { PaymentGatewayFactory } = await import('@/services/financial/payment-gateway.service');
            const gatewaySvc = PaymentGatewayFactory.getGateway(gateway);
            if (gatewaySvc.checkStatusSync) {
              isActuallyPaid = await gatewaySvc.checkStatusSync(gatewayId);
            }
          } catch (e: unknown) {
            console.error(`[order-status] ${gateway} sync fallback failed:`, (e instanceof Error ? e.message : String(e)));
          }
        }

        if (isActuallyPaid) {
          const isTestMode = await SettingsManager.isTestMode();
          const { paymentService } = await import('@/services/financial/payment.service');
          await paymentService.confirmPayment(
            gatewayId,
            checkAmount,
            payment.userId,
            isTestMode,
            gateway as 'yookassa' | 'cryptobot' | 'robokassa',
            paymentId,
            'order'
          );

          const updatedPayment = await db.payment.findUnique({
            where: session ? { id: paymentId, userId: session.userId } : { id: paymentId },
          });
          if (updatedPayment) payment = updatedPayment;
        }
      }

      return NextResponse.json({
        orderId: payment.id,
        numericId: 0,
        status: payment.status === 'COMPLETED' ? 'COMPLETED' : (payment.status === 'PENDING' ? 'AWAITING_PAYMENT' : payment.status),
        charge: Number(payment.amount),
        quantity: 0,
        serviceName: 'Массовый заказ',
      });
    }

    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[order-status] Error:', (error instanceof Error ? error.message : String(error)));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
