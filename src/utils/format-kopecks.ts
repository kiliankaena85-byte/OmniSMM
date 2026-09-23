/**
 * Formats integer kopecks (cents) into human-readable Ruble string with currency symbol.
 * Adheres to Russian Consumer Psychology:
 * - Whole rubles: "1 234 ₽" (no trailing ",00")
 * - With kopecks: "1 234,50 ₽"
 * Handles BigInt, number, and string inputs safely.
 */
export function formatKopecks(kopecks: bigint | number | string | null | undefined): string {
  if (kopecks === null || kopecks === undefined) return '0 ₽';
  
  let totalKopecks: bigint;
  try {
    totalKopecks = typeof kopecks === 'bigint' ? kopecks : BigInt(Math.round(Number(kopecks)));
  } catch {
    return '0 ₽';
  }

  const isNegative = totalKopecks < BigInt(0);
  const absKopecks = isNegative ? -totalKopecks : totalKopecks;

  const rubles = absKopecks / BigInt(100);
  const cents = absKopecks % BigInt(100);

  const rublesFormatted = rubles.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  if (cents === BigInt(0)) {
    return `${isNegative ? '-' : ''}${rublesFormatted} ₽`;
  }

  const centsFormatted = cents.toString().padStart(2, '0');
  return `${isNegative ? '-' : ''}${rublesFormatted},${centsFormatted} ₽`;
}
