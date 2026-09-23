import { db } from '@/lib/db';
import { sendAdminAlert } from '@/lib/notifications';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'RateChangeDetector' });

export interface RateCheckParams {
  providerServiceId: string;
  expectedRate: number;
  customerPriceRub?: number;
}

export interface RateCheckResult {
  ok: boolean;
  currentRate?: number;
  expectedRate: number;
  deltaPct?: number;
  reason?: string;
}

/**
 * Pre-flight check before submitting an order to an external provider.
 * Prevents financial loss from unexpected upstream price surges or negative margins.
 */
export async function preFlightRateCheck(params: RateCheckParams): Promise<RateCheckResult> {
  const { providerServiceId, expectedRate, customerPriceRub } = params;

  try {
    const current = await db.service.findUnique({
      where: { id: providerServiceId },
      select: {
        id: true,
        providerId: true,
        rate: true,
        markup: true,
        pricePer1000Cents: true,
      },
    });

    if (!current) {
      return { ok: false, expectedRate, reason: 'Service record not found' };
    }

    const currentRate = current.rate;
    const deltaPct = expectedRate > 0 ? ((currentRate - expectedRate) / expectedRate) * 100 : 0;

    // 1. Check for rate surge (> 20% price increase)
    if (deltaPct > 20) {
      log.error('Provider rate surge detected', { providerServiceId, expectedRate, currentRate, deltaPct });

      sendAdminAlert(
        `🚨 <b>Внимание: Скачок тарифа поставщика (+${deltaPct.toFixed(1)}%)!</b>\nУслуга поставщика: <code>${providerServiceId}</code>\nОжидаемый тариф: ${expectedRate} ₽, Текущий тариф: ${currentRate} ₽.\nЗаказ заблокирован в очереди во избежание убытков.`,
        'CRITICAL'
      );

      return {
        ok: false,
        currentRate,
        expectedRate,
        deltaPct,
        reason: `Тариф поставщика вырос на ${deltaPct.toFixed(1)}% (с ${expectedRate} до ${currentRate} ₽)`,
      };
    }

    // 2. Check for negative margin (provider rate > retail customer price)
    const retailPrice = customerPriceRub ?? (current.rate * (current.markup || 1));
    if (retailPrice > 0 && currentRate > retailPrice) {
      log.error('Negative margin detected', { currentRate, retailPrice });

      sendAdminAlert(
        `🚨 <b>CRITICAL: Отрицательная маржа по услуге!</b>\nСебестоимость поставщика: <b>${currentRate} ₽</b> > Розничная цена клиента: <b>${retailPrice} ₽</b>.\nИсполнение заблокировано.`,
        'CRITICAL'
      );

      return {
        ok: false,
        currentRate,
        expectedRate,
        deltaPct,
        reason: `Отрицательная маржа: себестоимость (${currentRate} ₽) превышает розничную цену (${retailPrice} ₽)`,
      };
    }

    return {
      ok: true,
      currentRate,
      expectedRate,
      deltaPct,
    };
  } catch (err) {
    log.error('Failed to perform pre-flight rate check', { error: err });
    return { ok: true, expectedRate }; // Fail-open for transient DB errors if needed
  }
}
