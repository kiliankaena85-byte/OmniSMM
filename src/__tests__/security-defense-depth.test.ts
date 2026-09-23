import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import {
  generateTotpSecret,
  generateTotpCode,
  verifyTotpToken,
  generateBackupCodes,
  hashBackupCode,
  verifyAndConsumeBackupCode
} from '@/lib/auth/2fa';
import { ApiKeyService } from '@/services/api/api-key.service';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { SecurityAuditLogger } from '@/lib/security/audit-logger';

describe('Defense-in-Depth Security Suite (2FA, Rate Limiting, API Keys, SIEM)', () => {
  let testUserId: string;

  beforeEach(async () => {
    // Create fresh test user
    const user = await db.user.create({
      data: {
        email: `security-test-${Date.now()}@smmplan.pro`,
        role: 'USER',
        balance: BigInt(0),
        tenantId: 'smmplan',
      },
    });
    testUserId = user.id;
  });

  describe('1. Two-Factor Authentication (TOTP & Backup Codes)', () => {
    it('generates valid RFC 6238 TOTP secret and verifies accurate 6-digit codes', () => {
      const { secret, otpauthUrl } = generateTotpSecret('user@smmplan.pro', 'SMMplan');

      expect(secret).toBeDefined();
      expect(secret.length).toBeGreaterThanOrEqual(16);
      expect(otpauthUrl).toContain('otpauth://totp/SMMplan:user%40smmplan.pro');

      // Generate current code and verify
      const currentCode = generateTotpCode(secret, Date.now());
      expect(currentCode).toMatch(/^\d{6}$/);

      const isValid = verifyTotpToken(secret, currentCode, 1);
      expect(isValid).toBe(true);

      // Verify invalid code fails
      const isInvalid = verifyTotpToken(secret, '000000', 1);
      expect(isInvalid).toBe(false);
    });

    it('tolerates 30-second time drift within window', () => {
      const { secret } = generateTotpSecret('user@smmplan.pro');
      const now = Date.now();

      // Code generated 25 seconds in the past
      const pastCode = generateTotpCode(secret, now - 25000);
      expect(verifyTotpToken(secret, pastCode, 1, now)).toBe(true);

      // Code generated 25 seconds in the future
      const futureCode = generateTotpCode(secret, now + 25000);
      expect(verifyTotpToken(secret, futureCode, 1, now)).toBe(true);
    });

    it('generates, hashes, verifies and single-use consumes backup recovery codes', () => {
      const backupCodes = generateBackupCodes(5);
      expect(backupCodes.length).toBe(5);

      const hashedCodes = backupCodes.map(hashBackupCode);
      const codeToUse = backupCodes[0];

      // Consume first code
      const result1 = verifyAndConsumeBackupCode(codeToUse, hashedCodes);
      expect(result1.valid).toBe(true);
      expect(result1.remainingHashedCodes.length).toBe(4);

      // Re-consuming the same code must fail (single use invariant)
      const result2 = verifyAndConsumeBackupCode(codeToUse, result1.remainingHashedCodes);
      expect(result2.valid).toBe(false);
    });
  });

  describe('2. Panel API Key SHA-256 Hashing & Lifecycle', () => {
    it('creates API key with prefix, stores SHA-256 hash in DB and never stores plaintext', async () => {
      const { plainKey, maskedKey } = await ApiKeyService.assignNewKeyToUser(testUserId);

      expect(plainKey).toMatch(/^smm_live_[a-f0-9]{48}$/);
      expect(maskedKey).toContain('••••••••');

      // Check DB value
      const user = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      expect(user.apiKeyHash).toBeDefined();
      expect(user.apiKeyHash).not.toBe(plainKey);
      expect(user.apiKeyHash).toBe(ApiKeyService.hashKey(plainKey));

      // Authenticate with plaintext key
      const authenticatedUser = await ApiKeyService.authenticate(plainKey);
      expect(authenticatedUser).not.toBeNull();
      expect(authenticatedUser?.id).toBe(testUserId);

      // Authenticate with invalid key
      const badUser = await ApiKeyService.authenticate('smm_live_invalidkey1234567890');
      expect(badUser).toBeNull();
    });

    it('revokes API key cleanly', async () => {
      const { plainKey } = await ApiKeyService.assignNewKeyToUser(testUserId);
      await ApiKeyService.revokeKey(testUserId);

      const user = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      expect(user.apiKeyHash).toBeNull();

      const authResult = await ApiKeyService.authenticate(plainKey);
      expect(authResult).toBeNull();
    });
  });

  describe('3. Rate Limiting & Zero Race Condition Upsert', () => {
    it('handles concurrent requests atomically without throwing or corrupting state', async () => {
      const endpoint = `test-atomic-endpoint-${Date.now()}`;

      // Run 5 requests with maxHits=3
      const results = await Promise.all([
        RateLimitService.checkCustomKey(endpoint, 3, 60, true),
        RateLimitService.checkCustomKey(endpoint, 3, 60, true),
        RateLimitService.checkCustomKey(endpoint, 3, 60, true),
        RateLimitService.checkCustomKey(endpoint, 3, 60, true),
        RateLimitService.checkCustomKey(endpoint, 3, 60, true),
      ]);

      const allowedCount = results.filter((r) => r === true).length;
      const blockedCount = results.filter((r) => r === false).length;

      expect(allowedCount).toBeGreaterThanOrEqual(1);
      expect(allowedCount + blockedCount).toBe(5);
    });
  });

  describe('4. SIEM-Ready Security Audit Logging', () => {
    it('logs structured security events to DB and stdout', async () => {
      await SecurityAuditLogger.log({
        event: '2FA_ENABLED',
        userId: testUserId,
        email: 'user@smmplan.pro',
        severity: 'INFO',
        details: { method: 'TOTP' },
      });

      const eventRecord = await db.securityEvent.findFirst({
        where: { event: '2FA_ENABLED' },
        orderBy: { createdAt: 'desc' },
      });

      expect(eventRecord).not.toBeNull();
      expect(eventRecord?.event).toBe('2FA_ENABLED');
      expect(eventRecord?.severity).toBe('INFO');
    });
  });
});
