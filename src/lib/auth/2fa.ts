/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Two-Factor Authentication (TOTP - RFC 6238 / RFC 4226 & Backup Codes)
 */

import crypto from 'crypto';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encodes a buffer into Base32 string (RFC 4648).
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decodes a Base32 string into a Buffer.
 */
export function base32Decode(base32: string): Buffer {
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_CHARS.indexOf(clean[i]);
    if (val === -1) continue;

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generates an RFC 6238 TOTP code for a given timestamp and secret.
 */
export function generateTotpCode(secretBase32: string, timeMs: number = Date.now(), stepSeconds: number = 30): string {
  const secretBytes = base32Decode(secretBase32);
  const epochStep = Math.floor(timeMs / 1000 / stepSeconds);

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(epochStep), 0);

  const hmac = crypto.createHmac('sha1', secretBytes).update(counterBuffer).digest();

  // Dynamic truncation (RFC 4226)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const token = (code % 1_000_000).toString().padStart(6, '0');
  return token;
}

/**
 * Generates a new random Base32 secret for TOTP setup.
 */
export function generateTotpSecret(email: string, issuer: string = 'SMMplan') {
  const randomBytes = crypto.randomBytes(20); // 160 bits entropy
  const secret = base32Encode(randomBytes);
  const cleanEmail = encodeURIComponent(email.trim());
  const cleanIssuer = encodeURIComponent(issuer.trim());
  const otpauthUrl = `otpauth://totp/${cleanIssuer}:${cleanEmail}?secret=${secret}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;

  return {
    secret,
    otpauthUrl,
  };
}

/**
 * Verifies a 6-digit TOTP token against a secret with time drift window.
 * @param secretBase32 Base32 secret key
 * @param token 6-digit user token
 * @param window Number of periods to check before/after (default 1 = +/- 30s)
 */
export function verifyTotpToken(
  secretBase32: string,
  token: string,
  window: number = 1,
  timeMs: number = Date.now()
): boolean {
  if (!token || typeof token !== 'string') return false;
  const normalizedToken = token.trim();
  if (!/^\d{6}$/.test(normalizedToken)) return false;

  const stepSeconds = 30;

  for (let i = -window; i <= window; i++) {
    const checkTime = timeMs + i * stepSeconds * 1000;
    const expected = generateTotpCode(secretBase32, checkTime, stepSeconds);
    if (crypto.timingSafeEqual(Buffer.from(normalizedToken), Buffer.from(expected))) {
      return true;
    }
  }

  return false;
}

/**
 * Generates single-use backup recovery codes.
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const part1 = crypto.randomBytes(3).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(3).toString('hex').toUpperCase();
    codes.push(`${part1}-${part2}`); // e.g. 4F8A1B-9C2E3D
  }
  return codes;
}

/**
 * Hashes a backup code with SHA-256 for safe storage.
 */
export function hashBackupCode(code: string): string {
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(clean).digest('hex');
}

/**
 * Verifies and consumes a backup recovery code.
 */
export function verifyAndConsumeBackupCode(
  providedCode: string,
  hashedCodes: string[]
): { valid: boolean; remainingHashedCodes: string[] } {
  const providedHash = hashBackupCode(providedCode);
  const index = hashedCodes.findIndex((h) => crypto.timingSafeEqual(Buffer.from(h), Buffer.from(providedHash)));

  if (index === -1) {
    return { valid: false, remainingHashedCodes: hashedCodes };
  }

  const remaining = [...hashedCodes];
  remaining.splice(index, 1);
  return { valid: true, remainingHashedCodes: remaining };
}
