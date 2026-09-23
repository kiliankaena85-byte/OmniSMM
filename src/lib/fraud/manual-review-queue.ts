import { db } from '@/lib/db';
import { sendAdminAlert } from '@/lib/notifications';
import { SecurityAlertService } from '@/services/security/security-alert.service';
import { logger } from '@/lib/logger';
import { paymentService } from '@/services/financial/payment.service';

const log = logger.child({ component: 'FraudManualReview' });

export interface FraudEvaluationParams {
  paymentId: string;
  orderId?: string | null;
  riskScore: number;
  reason: string;
}

export interface FraudHoldResult {
  held: boolean;
  status: string;
  riskScore: number;
}

/**
 * Places suspicious transactions into manual fraud review hold.
 */
export async function evaluateAndEnforceFraudHold(
  params: FraudEvaluationParams
): Promise<FraudHoldResult> {
  const { paymentId, orderId, riskScore, reason } = params;

  if (riskScore >= 70) {
    log.warn('Transaction placed on FRAUD_HOLD', { paymentId, riskScore, reason });

    await db.payment.update({
      where: { id: paymentId },
      data: { status: 'FRAUD_HOLD' },
    });

    if (orderId) {
      await db.order.update({
        where: { id: orderId },
        data: { status: 'PENDING_CHECK' },
      }).catch(() => {});
    }

    await SecurityAlertService.record({
      event: 'PAYMENT_FRAUD_HOLD',
      severity: 'HIGH',
      details: { paymentId, orderId, riskScore, reason },
    });

    sendAdminAlert(
      `🛡️ <b>Внимание: Платёж помещён в очередь ручной проверки (FRAUD_HOLD)!</b>\nПлатёж: <code>#${paymentId.slice(0, 8)}</code>\nRisk Score: <b>${riskScore}/100</b>\nПричина: <i>${reason}</i>`,
      'WARNING'
    );

    return { held: true, status: 'FRAUD_HOLD', riskScore };
  }

  return { held: false, status: 'PENDING', riskScore };
}

/**
 * Approves a transaction from manual fraud review, releasing it for processing.
 */
export async function approveFraudHoldAction(
  paymentId: string,
  staffId: string,
  note?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: { user: true },
    });

    if (!payment) {
      return { success: false, message: 'Платёж не найден' };
    }

    if (payment.status !== 'FRAUD_HOLD') {
      return { success: false, message: `Платёж находится в статусе ${payment.status}, а не FRAUD_HOLD` };
    }

    // Confirm payment and activate
    await paymentService.confirmPayment(
      payment.gatewayId || payment.id,
      payment.amount,
      payment.userId,
      false,
      (payment.gateway as any) || 'yookassa',
      payment.id
    );

    await SecurityAlertService.record({
      event: 'FRAUD_HOLD_APPROVED',
      severity: 'INFO',
      details: { paymentId, approvedBy: staffId, note },
    });

    return { success: true, message: 'Платёж успешно одобрен и зачислен' };
  } catch (err) {
    log.error('Failed to approve fraud hold payment', { error: err });
    return { success: false, message: 'Ошибка при одобрении платежа' };
  }
}

/**
 * Rejects a transaction from manual fraud review, cancelling it.
 */
export async function rejectFraudHoldAction(
  paymentId: string,
  staffId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  try {
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return { success: false, message: 'Платёж не найден' };
    }

    await db.payment.update({
      where: { id: paymentId },
      data: { status: 'CANCELED' },
    });

    await SecurityAlertService.record({
      event: 'FRAUD_HOLD_REJECTED',
      severity: 'HIGH',
      details: { paymentId, rejectedBy: staffId, reason },
    });

    sendAdminAlert(
      `🚫 <b>Платёж отклонён антифрод-оператором</b>\nПлатёж: <code>#${paymentId.slice(0, 8)}</code>\nОператор: <code>${staffId}</code>\nПричина: <i>${reason}</i>`,
      'WARNING'
    );

    return { success: true, message: 'Платёж отклонён' };
  } catch (err) {
    log.error('Failed to reject fraud hold payment', { error: err });
    return { success: false, message: 'Ошибка при отклонении платежа' };
  }
}
