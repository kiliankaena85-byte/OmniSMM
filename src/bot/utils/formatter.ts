/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Created by Artem (http://artmspektr.ru)
 * Unauthorized copying of this file is strictly prohibited.
 */
/**
 * Экранирует спецсимволы HTML для безопасной отправки в Telegram с parse_mode: HTML.
 */

export function escapeHtml(text: unknown): string {
    if (text === null || text === undefined) return '';
    const str = String(text);
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

import { applyBeautifulRounding } from '@/lib/financial-constants';
export { formatPricePerUnit, formatRubles } from '@/utils/format-price';

/**
 * Calculates the price per unit in RUB for a service.
 */
export function calculatePricePerUnit(
  service: { rate: number; markup: number; providerCurrency: string },
  usdToRub: number
): number {
  const isRub = service.providerCurrency === 'RUB';
  const exchangeRate = isRub ? 1.0 : usdToRub;
  const pricePer1kRub = applyBeautifulRounding(service.rate * service.markup * exchangeRate);
  return pricePer1kRub / 1000;
}



