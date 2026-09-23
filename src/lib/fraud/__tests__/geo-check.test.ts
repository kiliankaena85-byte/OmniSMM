import { describe, it, expect } from 'vitest';
import { checkGeoRisk } from '../geo-check';

describe('PREM-04: Geo Risk & Country Mismatch Engine', () => {
  it('passes when IP country matches card and user country', async () => {
    const res = await checkGeoRisk({
      ip: '93.184.216.34',
      ipCountry: 'RU',
      userCountry: 'RU',
      cardCountry: 'RU',
    });

    expect(res.riskScore).toBe(0);
    expect(res.forceHold).toBe(false);
    expect(res.mismatchDetected).toBe(false);
  });

  it('triggers forceHold when IP is from high-risk watchlist country', async () => {
    const res = await checkGeoRisk({
      ip: '198.51.100.10',
      ipCountry: 'NG',
      userCountry: 'RU',
      cardCountry: 'RU',
    });

    expect(res.riskScore).toBeGreaterThanOrEqual(50);
    expect(res.forceHold).toBe(true);
    expect(res.reason).toContain('high-risk');
  });

  it('detects mismatch between Russian card and foreign IP', async () => {
    const res = await checkGeoRisk({
      ip: '203.0.113.88',
      ipCountry: 'US',
      userCountry: 'RU',
      cardCountry: 'RU',
    });

    expect(res.mismatchDetected).toBe(true);
    expect(res.riskScore).toBeGreaterThanOrEqual(45);
  });
});
