import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { YooKassaStatusChecker } from '@/services/financial/yookassa-status-checker';
import { paymentService } from '@/services/financial/payment.service';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'PaymentStatusAPI' });

// Minimum age (ms) before attempting Active Pull (avoids racing with instant webhooks)
const ACTIVE_PULL_MIN_AGE_MS = 15_000; // 15 seconds

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Get the authenticated session (optional for guest payments)
    const session = await verifySession();

    const { id: paymentId } = await params;

    // 2. Fetch the payment
    const payment = await db.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // 3. Guest-Proof IDOR Check: If payment belongs to a user, strictly require matching session or staff
    const isStaff = Boolean(session?.role && ['ADMIN', 'OWNER', 'MANAGER', 'SUPPORT'].includes(session.role));
    if (payment.userId && (!session || payment.userId !== session.userId) && !isStaff) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 4. If payment is still PENDING and old enough, attempt Active Pull from YooKassa
    if (payment.status === 'PENDING' && payment.gatewayId) {
      if (payment.gatewayId.startsWith('yoo_test_mock_') || payment.gatewayId.startsWith('mock_') || payment.gatewayId.startsWith('crypto_test_mock_') || payment.gatewayId.startsWith('robo_test_mock_')) {
        await paymentService.confirmPayment(
          payment.gatewayId,
          payment.amount,
          payment.userId,
          true,
          (payment.gateway || 'yookassa') as any,
          payment.id
        );
        return NextResponse.json({
          status: 'SUCCEEDED',
          checkoutUrl: payment.checkoutUrl || null,
          activePull: true,
        });
      }

      const paymentAgeMs = Date.now() - new Date(payment.createdAt).getTime();

      if (paymentAgeMs >= ACTIVE_PULL_MIN_AGE_MS) {
        try {
          const { SettingsManager } = await import('@/lib/settings');
          const secrets = await SettingsManager.getPaymentSecrets();

          // Determine gateway type from payment.gateway field
          const isYooKassa = payment.gateway === 'yookassa' ||
            (payment.gateway === 'test' && payment.gatewayId && payment.gatewayId.includes('-') && payment.gatewayId.length > 30);

          if (isYooKassa && secrets.yookassaShopId && secrets.yookassaSecretKey) {
            const liveStatus = await YooKassaStatusChecker.checkPaymentStatus(
              payment.gatewayId,
              secrets.yookassaShopId,
              secrets.yookassaSecretKey
            );

            if (liveStatus && liveStatus.status === 'succeeded') {
              log.info(`[ActivePull] YooKassa confirmed payment ${paymentId} as succeeded. Activating...`);

              const amountCents = Math.round(parseFloat(liveStatus.amount.value) * 100);

              // Fire confirmPayment (idempotent — will no-op if already SUCCEEDED)
              await paymentService.confirmPayment(
                payment.gatewayId,
                BigInt(amountCents),
                payment.userId,
                false,
                'yookassa',
                payment.id
              );

              return NextResponse.json({
                status: 'SUCCEEDED',
                checkoutUrl: payment.checkoutUrl || null,
                activePull: true,
              });
            }

            if (liveStatus && liveStatus.status === 'canceled') {
              log.info(`[ActivePull] YooKassa reports payment ${paymentId} as canceled.`);
              // Update local status to match gateway
              await db.payment.updateMany({
                where: { id: payment.id, tenantId: payment.tenantId, status: 'PENDING' },
                data: { status: 'CANCELED' }
              });

              return NextResponse.json({
                status: 'CANCELED',
                checkoutUrl: payment.checkoutUrl || null,
                activePull: true,
              });
            }
          }
        } catch (pullErr) {
          // Active Pull is non-blocking: if it fails, we return the current DB status
          log.warn('[ActivePull] Non-critical error during YooKassa status check', { error: pullErr });
        }
      }
    }

    // 5. Return current DB status
    return NextResponse.json({
      status: payment.status,
      checkoutUrl: payment.checkoutUrl || null,
    });
  } catch (error) {
    log.error('[PaymentStatusAPI] Error:', { cause: error });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
