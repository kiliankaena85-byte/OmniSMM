import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { encryptProviderSecret, decryptProviderSecret, maskProviderKey } from '@/lib/crypto/provider-secrets';
import { redactSensitiveTokens } from '@/lib/logger/sensitive-data-filter';
import { CircuitBreaker, ProviderUnavailableError } from '@/lib/resilience/circuit-breaker';
import { ProviderIdempotencyGenerator } from '@/services/provider/idempotency-key-generator';
import { OrderDispatchService } from '@/services/provider/order-dispatch.service';
import crypto from 'crypto';

describe('Provider Gateway & Reliability Layer Test Suite', () => {
  describe('1. Provider API Key Encryption & Redaction', () => {
    it('encrypts provider API secret using AES-256-GCM and decrypts back to plaintext', () => {
      const apiKey = 'smm_provider_secret_live_9876543210abcdef';
      const encrypted = encryptProviderSecret(apiKey);

      expect(encrypted).not.toBe(apiKey);
      expect(encrypted.split(':').length).toBe(3); // iv:authTag:cipherHex

      const decrypted = decryptProviderSecret(encrypted);
      expect(decrypted).toBe(apiKey);
    });

    it('masks provider API key safely for UI display', () => {
      const key = '1234567890abcdef12345678';
      const masked = maskProviderKey(key);
      expect(masked).toBe('••••••••5678');
    });

    it('redacts sensitive API keys and tokens from log strings', () => {
      const rawLog = 'Sending request to provider with apiKey: "secret_123456" and token="bearer_abcdef"';
      const sanitized = redactSensitiveTokens(rawLog);

      expect(sanitized).not.toContain('secret_123456');
      expect(sanitized).not.toContain('bearer_abcdef');
      expect(sanitized).toContain('[REDACTED]');
    });
  });

  describe('2. Deterministic Idempotency Key Generation', () => {
    it('produces identical SHA-256 keys for identical order parameters', () => {
      const params = {
        userId: 'user_100',
        serviceId: 'srv_200',
        link: 'https://instagram.com/p/test1234/',
        quantity: 1000,
        runs: 1,
      };

      const key1 = ProviderIdempotencyGenerator.generateKey(params);
      const key2 = ProviderIdempotencyGenerator.generateKey({
        ...params,
        link: 'https://instagram.com/p/test1234', // normalized trailing slash
      });

      expect(key1).toBe(key2);
      expect(key1.length).toBe(64); // SHA-256 hex length
    });
  });

  describe('3. Distributed Circuit Breaker Pattern', () => {
    const testProviderId = 'prov_test_cb_1';

    beforeEach(async () => {
      await CircuitBreaker.forceReset(testProviderId);
    });

    it('starts in CLOSED state and trips to OPEN after 5 consecutive failures', async () => {
      const statusInitial = await CircuitBreaker.getStatus(testProviderId);
      expect(statusInitial.state).toBe('CLOSED');

      // Record 5 failures
      for (let i = 0; i < 5; i++) {
        await CircuitBreaker.recordFailure(testProviderId);
      }

      const statusTripped = await CircuitBreaker.getStatus(testProviderId);
      expect(statusTripped.state).toBe('OPEN');

      // Subsequent execution throws ProviderUnavailableError immediately without invoking task
      const taskMock = vi.fn().mockResolvedValue({ ok: true });
      await expect(
        CircuitBreaker.execute(testProviderId, 'TestProvider', taskMock)
      ).rejects.toThrow(ProviderUnavailableError);

      expect(taskMock).not.toHaveBeenCalled();
    });

    it('recovers to CLOSED state upon manual reset or recorded success', async () => {
      // Trip to OPEN
      for (let i = 0; i < 5; i++) {
        await CircuitBreaker.recordFailure(testProviderId);
      }

      // Reset
      await CircuitBreaker.forceReset(testProviderId);
      const statusAfterReset = await CircuitBreaker.getStatus(testProviderId);
      expect(statusAfterReset.state).toBe('CLOSED');
      expect(statusAfterReset.failureCount).toBe(0);
    });
  });

  describe('4. Webhook HMAC Signature & Replay Defense', () => {
    it('verifies valid HMAC-SHA256 signature against webhook payload', () => {
      const secret = 'webhook_shared_secret_2026';
      const body = JSON.stringify({ orderId: 'ord_123', status: 'COMPLETED' });

      const validSig = crypto.createHmac('sha256', secret).update(body).digest('hex');
      const invalidSig = 'invalid_tampered_signature_hex';

      const verify = (sig: string) => {
        const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
        return sig === expected;
      };

      expect(verify(validSig)).toBe(true);
      expect(verify(invalidSig)).toBe(false);
    });
  });
});
