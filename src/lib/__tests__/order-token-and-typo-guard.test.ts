/**
 * src/lib/__tests__/order-token-and-typo-guard.test.ts
 *
 * Security & Reliability tests for Guest Order Capability Tokens and Email Typo Guard.
 * Grounded in OWASP ASVS v4.0.3 Level 2 and NN/g Usability Heuristics.
 */

import { describe, it, expect } from 'vitest';
import { generateGuestOrderToken, verifyGuestOrderToken } from '../order-token';
import { suggestEmailCorrection } from '../email-typo-guard';

describe('Guest Order Capability Token (OWASP ASVS Level 2)', () => {
  it('generates a deterministic HMAC token for a given orderId and numericId', () => {
    const orderId = 'ord_test_123456';
    const numericId = 9876;

    const token1 = generateGuestOrderToken(orderId, numericId);
    const token2 = generateGuestOrderToken(orderId, numericId);

    expect(token1).toBeTruthy();
    expect(token1).toBe(token2);
    expect(typeof token1).toBe('string');
    expect(token1.length).toBe(64); // SHA-256 hex
  });

  it('verifies a valid token successfully', () => {
    const orderId = 'ord_valid_abc';
    const numericId = 101;
    const token = generateGuestOrderToken(orderId, numericId);

    expect(verifyGuestOrderToken(orderId, numericId, token)).toBe(true);
  });

  it('rejects tampered tokens or wrong order IDs (IDOR Immunity)', () => {
    const orderId = 'ord_victim_target';
    const attackerOrderId = 'ord_attacker_order';
    const numericId = 555;

    const attackerToken = generateGuestOrderToken(attackerOrderId, numericId);

    // Attacker tries to use their token to view victim order
    expect(verifyGuestOrderToken(orderId, numericId, attackerToken)).toBe(false);

    // Attacker tampers with the token string
    const tampered = attackerToken.substring(0, 60) + '0000';
    expect(verifyGuestOrderToken(orderId, numericId, tampered)).toBe(false);

    // Empty or malformed tokens
    expect(verifyGuestOrderToken(orderId, numericId, '')).toBe(false);
    expect(verifyGuestOrderToken(orderId, numericId, 'invalid-hex-non-sha')).toBe(false);
  });
});

describe('Email Typo Guard (NN/g Error Prevention)', () => {
  it('detects and suggests corrections for common Gmail typos', () => {
    expect(suggestEmailCorrection('client@gmai.com')).toBe('client@gmail.com');
    expect(suggestEmailCorrection('test@gmial.com')).toBe('test@gmail.com');
    expect(suggestEmailCorrection('alex@gmaill.com')).toBe('alex@gmail.com');
    expect(suggestEmailCorrection('user@gamil.com')).toBe('user@gmail.com');
    expect(suggestEmailCorrection('user@gmail.ru')).toBe('user@gmail.com');
  });

  it('detects and suggests corrections for common Yandex and Mail.ru typos', () => {
    expect(suggestEmailCorrection('admin@yandx.ru')).toBe('admin@yandex.ru');
    expect(suggestEmailCorrection('user@yadnex.ru')).toBe('user@yandex.ru');
    expect(suggestEmailCorrection('client@mil.ru')).toBe('client@mail.ru');
    expect(suggestEmailCorrection('test@inboxx.ru')).toBe('test@inbox.ru');
  });

  it('returns null for already valid or unrecognized domains', () => {
    expect(suggestEmailCorrection('correct@gmail.com')).toBeNull();
    expect(suggestEmailCorrection('valid@yandex.ru')).toBeNull();
    expect(suggestEmailCorrection('custom@mycompany.org')).toBeNull();
    expect(suggestEmailCorrection('not-an-email')).toBeNull();
    expect(suggestEmailCorrection('')).toBeNull();
  });
});
