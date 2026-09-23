/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Financial precision math & 54-FZ VAT calculation utilities with BigInt arithmetic.
 */

/**
 * Calculates VAT (НДС) with integer BigInt precision to prevent rounding and sub-kopeck leakage.
 * 
 * Formula: Amount * Rate / (100 + Rate)
 * In 2026:
 * - VAT base rate is 22% (or 20% for legacy periods / 5% for special thresholds).
 * - Exemption threshold is 20,000,000 RUB (2,000,000,000 kopecks).
 * 
 * Rounding: Rounds upwards to nearest kopeck (conservative ceiling for tax compliance).
 */
export function calculateVat(amountCents: bigint | number, vatRatePercent: number = 22): bigint {
  const cents = typeof amountCents === 'bigint' ? amountCents : BigInt(amountCents);
  if (cents <= BigInt(0)) return BigInt(0);
  if (vatRatePercent <= 0) return BigInt(0);

  const rate = BigInt(Math.round(vatRatePercent));
  const numerator = cents * rate;
  const denominator = BigInt(100) + rate;

  // Round up to nearest kopeck (conservative ceiling)
  return (numerator + denominator - BigInt(1)) / denominator;
}

/**
 * Converts BigInt or number cents into a decimal RUB string (e.g. 12345n -> "123.45").
 */
export function formatMoneyCents(cents: bigint | number): string {
  const raw = typeof cents === 'bigint' ? cents : BigInt(cents);
  const isNegative = raw < BigInt(0);
  const abs = isNegative ? -raw : raw;
  const rubles = abs / BigInt(100);
  const kopecks = abs % BigInt(100);
  const kopecksStr = kopecks < BigInt(10) ? `0${kopecks.toString()}` : `${kopecks.toString()}`;
  return `${isNegative ? '-' : ''}${rubles.toString()}.${kopecksStr}`;
}

/**
 * Converts ruble string or float to exact BigInt kopecks safely.
 */
export function parseRublesToCents(amount: string | number): bigint {
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount) || isNaN(amount)) {
      throw new Error('INVALID_AMOUNT');
    }
    return BigInt(Math.round(amount * 100));
  }

  const str = String(amount).trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(str);
  if (!match) {
    throw new Error('INVALID_AMOUNT_FORMAT');
  }

  const rubles = BigInt(match[1]);
  const kopecks = match[2] ? BigInt(match[2].padEnd(2, '0')) : BigInt(0);
  return rubles * BigInt(100) + kopecks;
}
