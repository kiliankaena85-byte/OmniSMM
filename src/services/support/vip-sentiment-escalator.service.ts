import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'VipSentimentEscalatorService' });

export interface EscalationVerdict {
  shouldEscalate: boolean;
  priorityLevel: 'CRITICAL_P0' | 'HIGH_P1' | 'STANDARD';
  assignedQueue: 'SENIOR_SUPPORT' | 'VIP_DESK' | 'STANDARD_QUEUE';
  slaTargetSeconds: number;
  reason: string;
}

export class VipSentimentEscalatorService {
  private static readonly VIP_SPEND_THRESHOLD_RUB = 50000;

  /**
   * Evaluates support ticket or angry client query for immediate VIP / Senior Operator escalation.
   */
  public static async evaluateEscalation(
    userId: string,
    messageText: string
  ): Promise<EscalationVerdict> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        orders: {
          where: { status: { in: ['COMPLETED', 'PARTIAL'] } },
          select: { charge: true },
        },
      },
    });

    const totalSpendRub = user
      ? user.orders.reduce((sum, o) => sum + Number(o.charge || 0) / 100, 0)
      : 0;

    const lowerText = messageText.toLowerCase();
    const isAngry =
      lowerText.includes('мошенники') ||
      lowerText.includes('верните деньги') ||
      lowerText.includes('суд') ||
      lowerText.includes('роспотребнадзор') ||
      lowerText.includes('обман') ||
      lowerText.includes('где заказ') ||
      lowerText.includes('отвратительно');

    const isVip = totalSpendRub >= this.VIP_SPEND_THRESHOLD_RUB;

    if (isVip && isAngry) {
      return {
        shouldEscalate: true,
        priorityLevel: 'CRITICAL_P0',
        assignedQueue: 'VIP_DESK',
        slaTargetSeconds: 60, // 1 minute response SLA
        reason: `VIP клиент (${Math.round(totalSpendRub).toLocaleString('ru-RU')} ₽ GMV) с признаками высокого оттока`,
      };
    }

    if (isVip) {
      return {
        shouldEscalate: true,
        priorityLevel: 'HIGH_P1',
        assignedQueue: 'VIP_DESK',
        slaTargetSeconds: 180, // 3 minutes response SLA
        reason: `VIP клиент (${Math.round(totalSpendRub).toLocaleString('ru-RU')} ₽ GMV)`,
      };
    }

    if (isAngry) {
      return {
        shouldEscalate: true,
        priorityLevel: 'HIGH_P1',
        assignedQueue: 'SENIOR_SUPPORT',
        slaTargetSeconds: 300, // 5 minutes response SLA
        reason: 'Обнаружен высокий уровень негатива/риск чарджбэка',
      };
    }

    return {
      shouldEscalate: false,
      priorityLevel: 'STANDARD',
      assignedQueue: 'STANDARD_QUEUE',
      slaTargetSeconds: 900,
      reason: 'Стандартный запрос',
    };
  }
}
