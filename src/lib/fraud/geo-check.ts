import { logger } from '@/lib/logger';

const log = logger.child({ component: 'FraudGeoChecker' });

export interface GeoRiskInput {
  ip: string;
  ipCountry?: string | null;
  userCountry?: string | null;
  cardCountry?: string | null;
}

export interface GeoRiskResult {
  riskScore: number; // 0 to 100
  forceHold: boolean;
  mismatchDetected: boolean;
  reason?: string;
}

// Countries typically associated with high-risk payment fraud or sanctioned regions
const HIGH_RISK_COUNTRIES = new Set(['NG', 'PK', 'GH', 'BD', 'VN', 'IR', 'KP', 'CU', 'SY']);

/**
 * Checks geographic risk signals between request IP, user profile, and card issuing country.
 */
export async function checkGeoRisk(input: GeoRiskInput): Promise<GeoRiskResult> {
  const { ip, ipCountry, userCountry, cardCountry } = input;

  let riskScore = 0;
  let forceHold = false;
  let mismatchDetected = false;
  let reason: string | undefined;

  const normalizedIpCountry = ipCountry?.toUpperCase()?.trim();
  const normalizedUserCountry = userCountry?.toUpperCase()?.trim();
  const normalizedCardCountry = cardCountry?.toUpperCase()?.trim();

  // 1. High-risk country origin check
  if (normalizedIpCountry && HIGH_RISK_COUNTRIES.has(normalizedIpCountry)) {
    riskScore += 50;
    forceHold = true;
    reason = `IP country (${normalizedIpCountry}) is in high-risk fraud watchlist`;
    log.warn('High risk country detected', { ip, country: normalizedIpCountry });
  }

  // 2. IP vs Card country mismatch (Card issued in Country A, payment submitted from Country B)
  if (
    normalizedIpCountry &&
    normalizedCardCountry &&
    normalizedIpCountry !== normalizedCardCountry
  ) {
    mismatchDetected = true;
    riskScore += 30;

    // Cross-continental mismatch (e.g. RU card from US/NG IP)
    const isRuCard = normalizedCardCountry === 'RU' || normalizedCardCountry === 'RUS';
    const isRuIp = normalizedIpCountry === 'RU' || normalizedIpCountry === 'RUS';
    if (isRuCard !== isRuIp) {
      riskScore += 25;
      if (riskScore >= 60) {
        forceHold = true;
      }
    }
  }

  // 3. User profile country vs IP country mismatch
  if (
    normalizedUserCountry &&
    normalizedIpCountry &&
    normalizedUserCountry !== normalizedIpCountry
  ) {
    mismatchDetected = true;
    riskScore += 15;
  }

  return {
    riskScore: Math.min(100, riskScore),
    forceHold,
    mismatchDetected,
    reason,
  };
}
