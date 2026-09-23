import { describe, it, expect } from 'vitest';
import { 
  computeHeaderFingerprint, 
  checkClientHintsAnomaly,
  isWhitelistedGoodBot 
} from '@/lib/security/ddos-shield/fingerprint';

describe('DDoS Shield Fingerprint & Anomaly Detection (SPEC-2026-09-11)', () => {
  it('computes consistent deterministic fingerprint hash for identical headers', () => {
    const headersA = new Headers({
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
      'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8',
      'sec-ch-ua-platform': '"Windows"',
    });
    const headersB = new Headers({
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
      'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8',
      'sec-ch-ua-platform': '"Windows"',
    });

    const fpA = computeHeaderFingerprint(headersA);
    const fpB = computeHeaderFingerprint(headersB);

    expect(fpA).toBeDefined();
    expect(fpA.length).toBe(64); // SHA-256 hex
    expect(fpA).toBe(fpB);
  });

  it('detects platform mismatch anomaly (e.g. User-Agent Windows vs sec-ch-ua-platform Android)', () => {
    const forgedHeaders = new Headers({
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
      'sec-ch-ua-platform': '"Android"',
    });

    const anomaly = checkClientHintsAnomaly(forgedHeaders);
    expect(anomaly.isAnomalous).toBe(true);
    expect(anomaly.reason).toMatch(/platform mismatch/i);
  });

  it('identifies official search engine bots via verified patterns', () => {
    const yandexHeaders = new Headers({
      'user-agent': 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
    });
    const googleHeaders = new Headers({
      'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    });
    const attackerHeaders = new Headers({
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) python-requests/2.31.0',
    });

    expect(isWhitelistedGoodBot(yandexHeaders)).toBe(true);
    expect(isWhitelistedGoodBot(googleHeaders)).toBe(true);
    expect(isWhitelistedGoodBot(attackerHeaders)).toBe(false);
  });

  it('permits Android tablet UA without mobile keyword sending sec-ch-ua-mobile: ?0', () => {
    const tabletHeaders = new Headers({
      'user-agent': 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 Chrome/128 Safari/537.36',
      'sec-ch-ua-platform': '"Android"',
      'sec-ch-ua-mobile': '?0',
    });

    const anomaly = checkClientHintsAnomaly(tabletHeaders);
    expect(anomaly.isAnomalous).toBe(false);
  });

  it('flags Android phone UA with mobile keyword sending sec-ch-ua-mobile: ?0 as anomalous', () => {
    const phoneHeaders = new Headers({
      'user-agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Mobile) AppleWebKit/537.36 Chrome/128 Safari/537.36',
      'sec-ch-ua-platform': '"Android"',
      'sec-ch-ua-mobile': '?0',
    });

    const anomaly = checkClientHintsAnomaly(phoneHeaders);
    expect(anomaly.isAnomalous).toBe(true);
    expect(anomaly.reason).toMatch(/mobile hint mismatch/i);
  });

  it('differentiates fingerprints when clientIp is supplied', () => {
    const headers = new Headers({
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'accept-language': 'ru-RU',
    });

    const fp1 = computeHeaderFingerprint(headers, '1.2.3.4');
    const fp2 = computeHeaderFingerprint(headers, '5.6.7.8');
    expect(fp1).not.toBe(fp2);
  });
});
