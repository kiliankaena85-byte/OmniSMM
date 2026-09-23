/**
 * src/lib/order-token.ts
 *
 * Cryptographic Capability Tokens for Secure Guest Order Tracking (OWASP ASVS v4.0.3 Level 2).
 * Allows customers to track their paid order without exposing the full user account,
 * preventing Account Takeover (ATO) exploits via cross-account payment.
 */

import crypto from 'crypto';

function getOrderTokenSalt(): string {
  const secret = process.env.ORDER_TOKEN_SECRET || process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production' && process.env.APP_ENV !== 'test') {
    throw new Error('[SECURITY FATAL] ORDER_TOKEN_SECRET or JWT_SECRET must be configured in production!');
  }
  return secret || 'smmplan-guest-order-token-salt-2026';
}

/**
 * Generates a tamper-proof capability token for a specific order.
 */
export function generateGuestOrderToken(orderId: string, numericId: number): string {
  const payload = `order:${orderId}:${numericId}`;
  return crypto
    .createHmac('sha256', getOrderTokenSalt())
    .update(payload)
    .digest('hex');
}

/**
 * Verifies that the provided token matches the expected HMAC for this order.
 * Uses timingSafeEqual to prevent side-channel timing attacks.
 */
export function verifyGuestOrderToken(orderId: string, numericId: number, token: string): boolean {
  if (!token || typeof token !== 'string') return false;

  try {
    const expected = generateGuestOrderToken(orderId, numericId);
    const tokenBuf = Buffer.from(token, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');

    if (tokenBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(tokenBuf, expectedBuf);
  } catch {
    return false;
  }
}
