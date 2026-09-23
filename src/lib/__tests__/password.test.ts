import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../auth/password';
import crypto from 'crypto';

describe('Password Hashing & Verification (P-1)', () => {
  it('hashes password using scrypt N=65536 and verifies correctly', async () => {
    const password = 'SuperSecretPassword123!';
    const hash = await hashPassword(password);

    expect(hash).toContain('$s2$65536$');
    
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword('WrongPassword', hash);
    expect(isInvalid).toBe(false);
  });

  it('verifies legacy hashes (salt:key with N=16384) for backward compatibility', async () => {
    const password = 'LegacyPassword123';
    const salt = crypto.randomBytes(16).toString('hex');
    const legacyDerivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
    const legacyHash = `${salt}:${legacyDerivedKey.toString('hex')}`;

    const isValid = await verifyPassword(password, legacyHash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword('WrongLegacyPassword', legacyHash);
    expect(isInvalid).toBe(false);
  });

  it('returns false for malformed or empty hashes', async () => {
    expect(await verifyPassword('pass', '')).toBe(false);
    expect(await verifyPassword('pass', 'badhash')).toBe(false);
    expect(await verifyPassword('pass', '$s2$65536$invalid')).toBe(false);
  });
});
