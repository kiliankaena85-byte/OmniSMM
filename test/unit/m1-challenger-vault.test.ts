/**
 * CHALLENGER M1-2: Empirical Stress Test Suite for ISO 27001 Vault Encryption
 * Strict Verification of VaultService AES-256-GCM rejection invariants:
 * - Plaintext inputs (with/without colons, URLs, tokens)
 * - Malformed payloads (wrong part count, invalid hex, invalid IV length, invalid tag length)
 * - Wrong encryption keys (cross-key decryption)
 * - Corrupted authTags, ciphertexts, and IVs (bit flips, truncation, zeroing)
 * - Missing or invalid APP_ENCRYPTION_KEY configurations
 * - Null/empty inputs
 * - Large payload and Unicode roundtrips
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { VaultService } from '@/lib/vault';

describe('🔒 CHALLENGER M1-2: ISO 27001 Vault Encryption Empirical Stress Test', () => {
  const ORIGINAL_ENV = process.env.APP_ENCRYPTION_KEY;
  const VALID_KEY_HEX_1 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const VALID_KEY_HEX_2 = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEY = VALID_KEY_HEX_1;
  });

  afterEach(() => {
    process.env.APP_ENCRYPTION_KEY = ORIGINAL_ENV;
  });

  describe('1. Happy Path & Unicode / Edge Payload Roundtrips', () => {
    const testCases = [
      { name: 'Standard alphanumeric secret', value: 'mock_vault_secret_token_12345_sample' },
      { name: 'Cyrillic and emoji text', value: 'СекретныйТокен_2026_🔥_ПлатежныйШлюз' },
      { name: 'Special symbols & SQL injection attempt', value: "' OR '1'='1'; DROP TABLE users; --" },
      { name: 'JSON serialized secret object', value: JSON.stringify({ shopId: 12345, secret: 'sec_key_xyz', active: true }) },
      { name: 'Colon-separated tokens', value: 'user:pass:token:extra:meta' },
      { name: 'Single character string', value: 'x' },
      { name: 'Large 64KB payload', value: 'A'.repeat(65536) },
    ];

    testCases.forEach(({ name, value }) => {
      it(`successfully encrypts and decrypts: ${name}`, () => {
        const encrypted = VaultService.encrypt(value);
        expect(encrypted).not.toBe(value);
        expect(encrypted.split(':').length).toBe(3);

        const decrypted = VaultService.decrypt(encrypted);
        expect(decrypted).toBe(value);
      });
    });

    it('produces unique IV and ciphertext for identical inputs (IND-CPA semantic security)', () => {
      const payload = 'identical-secret-payload';
      const enc1 = VaultService.encrypt(payload);
      const enc2 = VaultService.encrypt(payload);
      const enc3 = VaultService.encrypt(payload);

      expect(enc1).not.toBe(enc2);
      expect(enc2).not.toBe(enc3);
      expect(enc1).not.toBe(enc3);

      expect(VaultService.decrypt(enc1)).toBe(payload);
      expect(VaultService.decrypt(enc2)).toBe(payload);
      expect(VaultService.decrypt(enc3)).toBe(payload);
    });

    it('returns empty string for null, undefined, and empty string', () => {
      expect(VaultService.decrypt('')).toBe('');
      expect(VaultService.decrypt(null as any)).toBe('');
      expect(VaultService.decrypt(undefined as any)).toBe('');
      expect(VaultService.encrypt('')).toBe('');
    });
  });

  describe('2. Strict Rejection of Plaintext Inputs', () => {
    const plaintextAttacks = [
      { name: 'Plain API key', input: 'mock_api_key_sample_12345678' },
      { name: 'Single colon string (2 parts)', input: 'username:password' },
      { name: 'Four parts string (3 colons)', input: 'part1:part2:part3:part4' },
      { name: 'Five parts string (4 colons)', input: 'a:b:c:d:e' },
      { name: 'URL string', input: 'https://api.yookassa.ru/v3/payments' },
      { name: 'Bearer token', input: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' },
      { name: 'UUID format', input: 'c4a8d09f-6e82-4f3b-9e2a-1a8c3d5e7f90' },
    ];

    plaintextAttacks.forEach(({ name, input }) => {
      it(`strictly rejects plaintext (${name}) with Access Denied error`, () => {
        expect(() => VaultService.decrypt(input)).toThrow(
          '[VaultService] Plaintext or malformed secret payload detected. Access denied.'
        );
      });
    });
  });

  describe('3. Strict Rejection of Malformed & Corrupted Tokens', () => {
    it('rejects 3-part string where IV is invalid non-hex characters', () => {
      const invalidIv = 'not_a_hex_iv_val:0123456789abcdef0123456789abcdef:aabbccddeeff';
      expect(() => VaultService.decrypt(invalidIv)).toThrow(/Decryption failed/);
    });

    it('rejects 3-part string where IV length is incorrect (not 16 bytes / 32 hex chars)', () => {
      const shortIv = '01234567:0123456789abcdef0123456789abcdef:aabbccddeeff';
      expect(() => VaultService.decrypt(shortIv)).toThrow(/Decryption failed/);
    });

    it('rejects 3-part string where authTag is non-hex', () => {
      const validIv = crypto.randomBytes(16).toString('hex');
      const invalidTag = 'this_is_not_hex_auth_tag_at_all!!';
      const payload = `${validIv}:${invalidTag}:aabbcc`;
      expect(() => VaultService.decrypt(payload)).toThrow(/Decryption failed/);
    });

    it('rejects 3-part string where ciphertext is non-hex', () => {
      const validIv = crypto.randomBytes(16).toString('hex');
      const validTag = crypto.randomBytes(16).toString('hex');
      const invalidCiphertext = 'ZZZZ_NOT_HEX_CIPHERTEXT_ZZZZ';
      const payload = `${validIv}:${validTag}:${invalidCiphertext}`;
      expect(() => VaultService.decrypt(payload)).toThrow(/Decryption failed/);
    });
  });

  describe('4. Cryptographic Authentication & Tampering Stress Tests', () => {
    it('strictly rejects payload when AuthTag is modified (1 bit flipped)', () => {
      const secret = 'sensitive_payment_gateway_api_secret_key';
      const encrypted = VaultService.encrypt(secret);
      const [iv, tag, cipher] = encrypted.split(':');

      // Tamper 1 character in the authTag
      const lastChar = tag.slice(-1);
      const flippedChar = lastChar === 'a' ? 'b' : 'a';
      const tamperedTag = tag.slice(0, -1) + flippedChar;

      const tamperedPayload = `${iv}:${tamperedTag}:${cipher}`;
      expect(() => VaultService.decrypt(tamperedPayload)).toThrow(/Decryption failed.*possible key rotation or data corruption/);
    });

    it('strictly rejects payload when AuthTag is zeroed out', () => {
      const secret = 'sensitive_payment_gateway_api_secret_key';
      const encrypted = VaultService.encrypt(secret);
      const [iv, , cipher] = encrypted.split(':');
      const zeroedTag = '0'.repeat(32);

      const tamperedPayload = `${iv}:${zeroedTag}:${cipher}`;
      expect(() => VaultService.decrypt(tamperedPayload)).toThrow(/Decryption failed/);
    });

    it('strictly rejects payload when AuthTag is corrupted or mismatched', () => {
      const secret = 'sensitive_payment_gateway_api_secret_key';
      const encrypted = VaultService.encrypt(secret);
      const [iv, tag, cipher] = encrypted.split(':');
      // Truncated with mismatched bytes
      const corruptedTag = 'abcdef0123456789';

      const tamperedPayload = `${iv}:${corruptedTag}:${cipher}`;
      expect(() => VaultService.decrypt(tamperedPayload)).toThrow(/Decryption failed/);
    });

    it('strictly rejects payload when Ciphertext is altered (bit flip)', () => {
      const secret = 'sensitive_payment_gateway_api_secret_key';
      const encrypted = VaultService.encrypt(secret);
      const [iv, tag, cipher] = encrypted.split(':');

      const lastChar = cipher.slice(-1);
      const flippedChar = lastChar === '0' ? '1' : '0';
      const tamperedCipher = cipher.slice(0, -1) + flippedChar;

      const tamperedPayload = `${iv}:${tag}:${tamperedCipher}`;
      expect(() => VaultService.decrypt(tamperedPayload)).toThrow(/Decryption failed/);
    });

    it('strictly rejects payload when Ciphertext is truncated', () => {
      const secret = 'sensitive_payment_gateway_api_secret_key';
      const encrypted = VaultService.encrypt(secret);
      const [iv, tag, cipher] = encrypted.split(':');
      const truncatedCipher = cipher.slice(0, Math.max(2, cipher.length - 4));

      const tamperedPayload = `${iv}:${tag}:${truncatedCipher}`;
      expect(() => VaultService.decrypt(tamperedPayload)).toThrow(/Decryption failed/);
    });

    it('strictly rejects payload when IV is altered', () => {
      const secret = 'sensitive_payment_gateway_api_secret_key';
      const encrypted = VaultService.encrypt(secret);
      const [iv, tag, cipher] = encrypted.split(':');

      const lastChar = iv.slice(-1);
      const flippedChar = lastChar === 'f' ? 'e' : 'f';
      const tamperedIv = iv.slice(0, -1) + flippedChar;

      const tamperedPayload = `${tamperedIv}:${tag}:${cipher}`;
      expect(() => VaultService.decrypt(tamperedPayload)).toThrow(/Decryption failed/);
    });
  });

  describe('5. Cross-Key Decryption & Key Rotation Failure Simulation', () => {
    it('strictly fails when attempting to decrypt with wrong encryption key', () => {
      const secret = 'crypto_bot_live_api_token_value_987654';

      // Encrypt with Key 1
      process.env.APP_ENCRYPTION_KEY = VALID_KEY_HEX_1;
      const encrypted = VaultService.encrypt(secret);

      // Switch to Key 2 (simulating mismatched key or compromised ciphertext from another environment)
      process.env.APP_ENCRYPTION_KEY = VALID_KEY_HEX_2;
      expect(() => VaultService.decrypt(encrypted)).toThrow(/Decryption failed — possible key rotation or data corruption/);
    });
  });

  describe('6. Environment Variable Misconfiguration Rejection', () => {
    it('throws when APP_ENCRYPTION_KEY is undefined', () => {
      delete process.env.APP_ENCRYPTION_KEY;
      expect(() => VaultService.encrypt('test')).toThrow('APP_ENCRYPTION_KEY is not defined');
      expect(() => VaultService.decrypt('01:02:03')).toThrow();
    });

    it('throws when APP_ENCRYPTION_KEY is not 64 hex characters (e.g. 62 chars)', () => {
      process.env.APP_ENCRYPTION_KEY = VALID_KEY_HEX_1.slice(0, 62);
      expect(() => VaultService.encrypt('test')).toThrow('APP_ENCRYPTION_KEY must be exactly 64 hex characters');
    });

    it('throws when APP_ENCRYPTION_KEY is not 64 hex characters (e.g. 66 chars)', () => {
      process.env.APP_ENCRYPTION_KEY = VALID_KEY_HEX_1 + 'aa';
      expect(() => VaultService.encrypt('test')).toThrow('APP_ENCRYPTION_KEY must be exactly 64 hex characters');
    });

    it('throws when APP_ENCRYPTION_KEY contains non-hex characters', () => {
      process.env.APP_ENCRYPTION_KEY = 'Z'.repeat(64);
      expect(() => VaultService.encrypt('test')).toThrow('APP_ENCRYPTION_KEY must be exactly 64 hex characters');
    });
  });
});
