// SC09 Negative Fixture: Safe integer cents parsing
export function parseAmount(str: string) {
  const cents = BigInt(Math.round(Number(str) * 100));
  return cents;
}
