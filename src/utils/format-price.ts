/**
 * (c) 2026 SMMplan.
 * Russian Consumer Psychology & Clean Typography Price Formatter.
 *
 * Rules:
 * 1. Never show trailing zeroes for whole rubles (e.g. "1 000 ₽", NOT "1 000,00 ₽" or "1.000").
 * 2. For unit prices (₽ / шт):
 *    - 0 -> "0"
 *    - 2 -> "2" (NOT "2.00")
 *    - 0.5 -> "0.5" (NOT "0.50")
 *    - 0.15 -> "0.15" (NOT "0.150")
 *    - 0.005 -> "0.005"
 * 3. Use Russian thousands separator (non-breaking space / space).
 */

/**
 * Formats a unit price per 1 piece (₽ / шт) without confusing trailing zeroes.
 * Examples:
 *   formatPricePerUnit(0) => "0"
 *   formatPricePerUnit(2.0) => "2"
 *   formatPricePerUnit(0.50) => "0.5"
 *   formatPricePerUnit(0.15) => "0.15"
 *   formatPricePerUnit(0.005) => "0.005"
 */
export function formatPricePerUnit(price: number): string {
  if (price === 0 || !Number.isFinite(price)) return '0';
  
  // Format with adequate precision, then strip trailing zeroes
  let str: string;
  if (price < 0.001) {
    str = price.toFixed(5);
  } else if (price < 0.01) {
    str = price.toFixed(4);
  } else if (price < 0.1) {
    str = price.toFixed(3);
  } else {
    str = price.toFixed(2);
  }

  // Remove trailing zeros and trailing decimal point
  if (str.includes('.')) {
    str = str.replace(/\.?0+$/, '');
  }

  return str || '0';
}

/**
 * Formats Ruble amounts cleanly for Russian users.
 * If whole rubles, omits kopecks (e.g. "1 000 ₽", "450 ₽").
 * If has kopecks, formats cleanly (e.g. "1 250,50 ₽" or "1 250,5 ₽").
 */
export function formatRubles(rubles: number): string {
  if (!Number.isFinite(rubles) || rubles === 0) return '0 ₽';
  
  const isNegative = rubles < 0;
  const abs = Math.abs(rubles);
  const isInt = Number.isInteger(abs);

  let formattedNum: string;
  if (isInt) {
    formattedNum = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  } else {
    const parts = abs.toFixed(2).split('.');
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const decPart = parts[1].replace(/0+$/, '');
    formattedNum = decPart.length > 0 ? `${intPart},${decPart}` : intPart;
  }

  return `${isNegative ? '-' : ''}${formattedNum} ₽`;
}
