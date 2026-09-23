/**
 * Exact Financial Math Utility for SMMplan.
 * Provides deterministic BigInt arithmetic with Banker's Rounding (Half-Even)
 * and zero float drift for micro-pricing and margin calculations.
 */

export class ExactMath {
  public static readonly MICRO_SCALE = BigInt(10000); // 10^4 precision factor for sub-kopecks
  public static readonly BPS_BASE = BigInt(10000); // 100.00% = 10,000 basis points
  public static readonly KOPECK_TO_RUB = BigInt(100); // 100 kopecks = 1 RUB

  /**
   * Converts floating rubles to BigInt kopecks safely.
   * e.g., 12.34 RUB -> 1234n kopecks.
   */
  public static rublesToKopecks(rub: number | string): bigint {
    if (typeof rub === 'string') {
      const trimmed = rub.trim();
      const num = parseFloat(trimmed);
      if (!Number.isFinite(num)) {
        throw new Error(`Invalid monetary amount: ${rub}`);
      }
      if (num < 0) {
        throw new Error(`Negative monetary amounts are forbidden: ${rub}`);
      }
      if (num > Number.MAX_SAFE_INTEGER) {
        throw new Error(`Monetary amount exceeds safe calculation limits: ${rub}`);
      }
      const fixed = num.toFixed(2);
      const [whole, frac = '00'] = fixed.split('.');
      return BigInt(whole) * BigInt(100) + BigInt(frac);
    }
    if (!Number.isFinite(rub)) {
      throw new Error(`Invalid monetary amount: ${rub}`);
    }
    if (rub < 0) {
      throw new Error(`Negative monetary amounts are forbidden: ${rub}`);
    }
    if (rub > Number.MAX_SAFE_INTEGER) {
      throw new Error(`Monetary amount exceeds safe calculation limits: ${rub}`);
    }
    // String-fixed decomposition eliminates IEEE-754 floating-point drift
    const fixed = rub.toFixed(2);
    const [whole, frac = '00'] = fixed.split('.');
    return BigInt(whole) * BigInt(100) + BigInt(frac);
  }

  /**
   * Converts BigInt kopecks to floating rubles for UI display.
   * e.g., 1234n kopecks -> 12.34 RUB.
   */
  public static kopecksToRubles(kopecks: bigint): number {
    return Number(kopecks) / 100;
  }

  /**
   * Converts BigInt kopecks to exact 2-decimal rubles string without IEEE-754 loss.
   * e.g., 123456n kopecks -> "1234.56" RUB.
   */
  public static kopecksToRublesString(kopecks: bigint): string {
    const isNegative = kopecks < BigInt(0);
    const absKop = isNegative ? -kopecks : kopecks;
    const whole = absKop / BigInt(100);
    const frac = absKop % BigInt(100);
    const fracStr = frac < BigInt(10) ? `0${frac}` : `${frac}`;
    return `${isNegative ? '-' : ''}${whole}.${fracStr}`;
  }

  /**
   * Multiplies quantity by rate per 1,000 items and applies margin basis points,
   * returning exact integer kopecks using Banker's Rounding (Half-Even).
   *
   * @param quantity Number of units ordered (e.g., 1500)
   * @param ratePer1kKopecks Base cost per 1,000 units in integer kopecks (e.g., 120n = 1.20 RUB)
   * @param marginBps Margin in basis points (e.g., 1550n = +15.5%)
   * @param minChargeKopecks Minimum charge floor (e.g., 1n = 1 kopeck, prevents 0 charge)
   */
  public static calculateOrderCostKopecks(
    quantity: number | bigint,
    ratePer1kKopecks: bigint,
    marginBps: bigint = BigInt(0),
    minChargeKopecks: bigint = BigInt(1)
  ): bigint {
    const qty = BigInt(quantity);
    if (qty <= BigInt(0)) {
      throw new Error(`Order quantity must be positive, received: ${quantity}`);
    }
    if (ratePer1kKopecks < BigInt(0)) {
      throw new Error(`Rate cannot be negative: ${ratePer1kKopecks}`);
    }
    if (marginBps < BigInt(0)) {
      throw new Error(`Margin bps cannot be negative: ${marginBps}`);
    }

    // Step 1: Base total in micro-kopecks = (qty * ratePer1kKopecks * MICRO_SCALE) / 1000
    const numerator = qty * ratePer1kKopecks * this.MICRO_SCALE;
    const baseMicroKopecks = numerator / BigInt(1000);

    // Step 2: Apply margin = baseMicroKopecks * (10000 + marginBps) / 10000
    const effectiveMicroKopecks = (baseMicroKopecks * (this.BPS_BASE + marginBps)) / this.BPS_BASE;

    // Step 3: Banker's Round (Half-Even) from micro-kopecks to integer kopecks
    const finalKopecks = this.roundHalfEven(effectiveMicroKopecks, this.MICRO_SCALE);

    // Step 4: Floor enforcement (must charge at least minChargeKopecks if quantity > 0)
    return finalKopecks > minChargeKopecks ? finalKopecks : minChargeKopecks;
  }

  /**
   * Applies Banker's Rounding (Round Half to Even) to a scaled BigInt.
   *
   * @param value Scaled value in micro-units
   * @param divisor Scale factor (e.g. 10000)
   */
  public static roundHalfEven(value: bigint, divisor: bigint): bigint {
    if (divisor <= BigInt(0)) throw new Error('Divisor must be positive');
    
    const isNegative = value < BigInt(0);
    const absVal = isNegative ? -value : value;

    const quotient = absVal / divisor;
    const remainder = absVal % divisor;
    const halfDivisor = divisor / BigInt(2);

    let result = quotient;

    if (remainder > halfDivisor) {
      result += BigInt(1);
    } else if (remainder === halfDivisor) {
      // Exactly halfway -> round to nearest even number
      if (quotient % BigInt(2) !== BigInt(0)) {
        result += BigInt(1);
      }
    }

    return isNegative ? -result : result;
  }

  /**
   * Calculates partial refund kopecks for an order with remains.
   *
   * @param totalChargeKopecks Total amount user paid
   * @param initialQuantity Total units ordered
   * @param remains Remaining units unfulfilled
   */
  public static calculatePartialRefund(
    totalChargeKopecks: bigint,
    initialQuantity: number | bigint,
    remains: number | bigint
  ): bigint {
    const initQty = BigInt(initialQuantity);
    const rem = BigInt(remains);

    if (initQty <= BigInt(0)) throw new Error('Initial quantity must be > 0');
    if (rem <= BigInt(0)) return BigInt(0);
    if (rem >= initQty) return totalChargeKopecks;

    // Pro-rata refund = (totalChargeKopecks * rem) / initQty with round half-even
    const scaledNumerator = totalChargeKopecks * rem * this.MICRO_SCALE;
    const scaledQuotient = scaledNumerator / initQty;

    return this.roundHalfEven(scaledQuotient, this.MICRO_SCALE);
  }
}
