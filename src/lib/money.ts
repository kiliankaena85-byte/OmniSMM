export type MoneyCents = number; // всегда ЦЕЛЫЕ копейки

/**
 * Converts rubles to integer cents with proper rounding.
 */
export const toCents = (rub: number | bigint | null | undefined): MoneyCents =>
  Math.round(Number(rub || 0) * 100);

/**
 * Converts integer cents to float rubles safely.
 */
export const centsToRub = (c: MoneyCents | bigint | null | undefined): number =>
  Number(c || 0) / 100;

/**
 * Formats money in cents as a Russian ruble string with 2 decimal places.
 */
export const formatRub = (c: MoneyCents | bigint | null | undefined): string =>
  (Number(c || 0) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Formats price per unit cleanly without trailing unnecessary zeroes (e.g. 0.26 ₽ / шт, 1.2 ₽ / шт).
 */
export const formatUnitRub = (priceRub: number | null | undefined): string => {
  if (priceRub === null || priceRub === undefined || isNaN(priceRub)) return '0 ₽';
  return priceRub.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
};


