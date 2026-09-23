import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

describe('🔒 SEC-WEBHOOKS: Cryptography & Webhook Access Guards', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  describe('YooKassa Webhook (/api/webhooks/yookassa)', () => {
    it('SEC-YOO-001: Returns 403 Forbidden when request comes from an untrusted IP address', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.doMock('@/utils/ip', () => ({
        getClientIp: vi.fn().mockResolvedValue('203.0.113.199'),
      }));
      vi.doMock('@/lib/settings', () => ({
        SettingsProvider: { isTestMode: vi.fn().mockResolvedValue(false) },
      }));
      vi.doMock('@/lib/db', () => ({
        db: { securityEvent: { create: vi.fn().mockResolvedValue({}) } },
      }));

      const { POST } = await import('@/app/api/webhooks/yookassa/route');
      const req = new NextRequest('https://smmplan.pro/api/webhooks/yookassa', {
        method: 'POST',
        body: JSON.stringify({ event: 'payment.succeeded' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized IP');
    });

    it('SEC-YOO-002: Returns 403 Forbidden when x-sha256-signature is missing and secret is configured', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('YOOKASSA_WEBHOOK_SECRET', 'test-yookassa-secret-key-12345');
      vi.doMock('@/utils/ip', () => ({
        getClientIp: vi.fn().mockResolvedValue('185.75.120.15'), // Trusted YooKassa IP prefix
      }));
      vi.doMock('@/lib/settings', () => ({
        SettingsProvider: { isTestMode: vi.fn().mockResolvedValue(false) },
      }));
      vi.doMock('@/lib/db', () => ({
        db: { securityEvent: { create: vi.fn().mockResolvedValue({}) } },
      }));

      const { POST } = await import('@/app/api/webhooks/yookassa/route');
      const req = new NextRequest('https://smmplan.pro/api/webhooks/yookassa', {
        method: 'POST',
        body: JSON.stringify({ event: 'payment.succeeded' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Missing webhook signature');
    });

    it('SEC-YOO-003: Returns 403 Forbidden when HMAC signature does not match payload', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const secret = 'test-yookassa-secret-key-12345';
      vi.stubEnv('YOOKASSA_WEBHOOK_SECRET', secret);
      vi.doMock('@/utils/ip', () => ({
        getClientIp: vi.fn().mockResolvedValue('185.75.120.15'),
      }));
      vi.doMock('@/lib/settings', () => ({
        SettingsProvider: { isTestMode: vi.fn().mockResolvedValue(false) },
      }));
      vi.doMock('@/lib/db', () => ({
        db: { securityEvent: { create: vi.fn().mockResolvedValue({}) } },
      }));

      const { POST } = await import('@/app/api/webhooks/yookassa/route');
      const rawBody = JSON.stringify({ event: 'payment.succeeded' });
      const req = new NextRequest('https://smmplan.pro/api/webhooks/yookassa', {
        method: 'POST',
        body: rawBody,
        headers: {
          'Content-Type': 'application/json',
          'x-sha256-signature': '0000000000000000000000000000000000000000000000000000000000000000',
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Invalid signature');
    });
  });

  describe('Provider Webhook (/api/webhooks/provider/[providerName])', () => {
    it('SEC-PROV-001: Returns 403 Forbidden when x-timestamp header is missing', async () => {
      const { POST } = await import('@/app/api/webhooks/provider/[providerName]/route');
      const req = new NextRequest('https://smmplan.pro/api/webhooks/provider/vexboost', {
        method: 'POST',
        body: JSON.stringify({ orderId: '123', status: 'COMPLETED' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await POST(req, { params: Promise.resolve({ providerName: 'vexboost' }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Missing x-timestamp header');
    });

    it('SEC-PROV-002: Returns 403 Forbidden when timestamp is older than 5 minutes (replay defense)', async () => {
      const { POST } = await import('@/app/api/webhooks/provider/[providerName]/route');
      const staleTimestamp = String(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      const req = new NextRequest('https://smmplan.pro/api/webhooks/provider/vexboost', {
        method: 'POST',
        body: JSON.stringify({ orderId: '123', status: 'COMPLETED' }),
        headers: {
          'Content-Type': 'application/json',
          'x-timestamp': staleTimestamp,
        },
      });

      const res = await POST(req, { params: Promise.resolve({ providerName: 'vexboost' }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Webhook timestamp expired or invalid');
    });

    it('SEC-PROV-003: Returns 403 Forbidden when x-signature header is missing', async () => {
      vi.stubEnv('PROVIDER_WEBHOOK_SECRET', 'test-provider-secret-2026');
      vi.doMock('@/lib/db', () => ({
        db: {
          provider: {
            findUnique: vi.fn().mockResolvedValue({
              name: 'vexboost',
              isActive: true,
              apiKey: 'test-provider-key',
            }),
          },
        },
      }));

      const { POST } = await import('@/app/api/webhooks/provider/[providerName]/route');
      const freshTimestamp = String(Date.now());
      const req = new NextRequest('https://smmplan.pro/api/webhooks/provider/vexboost', {
        method: 'POST',
        body: JSON.stringify({ orderId: '123', status: 'COMPLETED' }),
        headers: {
          'Content-Type': 'application/json',
          'x-timestamp': freshTimestamp,
        },
      });

      const res = await POST(req, { params: Promise.resolve({ providerName: 'vexboost' }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Missing x-signature header');
    });

    it('SEC-PROV-004: Returns 403 Forbidden when HMAC signature is invalid', async () => {
      vi.stubEnv('PROVIDER_WEBHOOK_SECRET', 'test-provider-secret-2026');
      vi.doMock('@/lib/db', () => ({
        db: {
          provider: {
            findUnique: vi.fn().mockResolvedValue({
              name: 'vexboost',
              isActive: true,
              apiKey: 'test-provider-key',
            }),
          },
        },
      }));

      const { POST } = await import('@/app/api/webhooks/provider/[providerName]/route');
      const freshTimestamp = String(Date.now());
      const req = new NextRequest('https://smmplan.pro/api/webhooks/provider/vexboost', {
        method: 'POST',
        body: JSON.stringify({ orderId: '123', status: 'COMPLETED' }),
        headers: {
          'Content-Type': 'application/json',
          'x-timestamp': freshTimestamp,
          'x-signature': '0000000000000000000000000000000000000000000000000000000000000000',
        },
      });

      const res = await POST(req, { params: Promise.resolve({ providerName: 'vexboost' }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Invalid HMAC signature');
    });

    it('SEC-PROV-005: Returns 503 Service Unavailable when PROVIDER_WEBHOOK_SECRET is not configured', async () => {
      vi.doMock('@/lib/db', () => ({
        db: {
          provider: {
            findUnique: vi.fn().mockResolvedValue({
              name: 'vexboost',
              isActive: true,
              apiKey: 'test-provider-key',
            }),
          },
        },
      }));

      const { POST } = await import('@/app/api/webhooks/provider/[providerName]/route');
      const freshTimestamp = String(Date.now());
      const req = new NextRequest('https://smmplan.pro/api/webhooks/provider/vexboost', {
        method: 'POST',
        body: JSON.stringify({ orderId: '123', status: 'COMPLETED' }),
        headers: {
          'Content-Type': 'application/json',
          'x-timestamp': freshTimestamp,
          'x-signature': 'test-signature',
        },
      });

      const res = await POST(req, { params: Promise.resolve({ providerName: 'vexboost' }) });
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toBe('Provider webhook secret not configured');
    });
  });

  describe('Cryptography Invariants (src/lib/crypto/encryption.ts)', () => {
    it('SEC-CRYPTO-001: Encrypts and decrypts with authenticated AES-256-GCM', async () => {
      vi.stubEnv('DATA_ENCRYPTION_KEY', 'master-encryption-key-for-test-32b');
      const { encrypt, decrypt } = await import('@/lib/crypto/encryption');

      const plain = 'secret-api-token-value-2026';
      const cipher = encrypt(plain);
      expect(cipher).not.toBe(plain);
      expect(cipher.split(':').length).toBe(3);

      const decrypted = decrypt(cipher);
      expect(decrypted).toBe(plain);
    });

    it('SEC-CRYPTO-002: Throws on corrupted ciphertext / auth tag failure', async () => {
      vi.stubEnv('DATA_ENCRYPTION_KEY', 'master-encryption-key-for-test-32b');
      const { encrypt, decrypt } = await import('@/lib/crypto/encryption');

      const cipher = encrypt('sensitive-info');
      const parts = cipher.split(':');
      parts[2] = parts[2].slice(0, -2) + '00';
      const corrupted = parts.join(':');

      expect(() => decrypt(corrupted)).toThrow(/Decryption failed/);
    });

    it('SEC-CRYPTO-003: maskEmail safely obfuscates user email for logs and UI', async () => {
      const { maskEmail } = await import('@/lib/crypto/encryption');
      expect(maskEmail('john.doe@example.com')).toBe('j*****e@example.com');
      expect(maskEmail('a@b.com')).toBe('a*@b.com');
      expect(maskEmail('')).toBe('••••••••');
    });

    it('SEC-CRYPTO-004: encryptProviderSecret and decryptProviderSecret fail-fast on empty inputs', async () => {
      vi.stubEnv('VAULT_MASTER_KEY', 'master-encryption-key-for-test-32b');
      const { encryptProviderSecret, decryptProviderSecret } = await import('@/lib/crypto/provider-secrets');

      expect(() => encryptProviderSecret('')).toThrow(/plainSecret must be a non-empty string/);
      expect(() => encryptProviderSecret('   ')).toThrow(/plainSecret must be a non-empty string/);
      expect(() => decryptProviderSecret('')).toThrow(/cipherText must be a non-empty string/);

      const secret = 'valid-provider-token-12345';
      const encrypted = encryptProviderSecret(secret);
      expect(encrypted).not.toBe(secret);
      expect(decryptProviderSecret(encrypted)).toBe(secret);
    });

    it('SEC-CRYPTO-005: Provider Webhook (/api/webhooks/provider) rejects secret from query string', async () => {
      vi.stubEnv('WEBHOOK_SECRET', 'test-webhook-secret-2026');
      const { POST } = await import('@/app/api/webhooks/provider/route');
      const req = new Request('https://smmplan.pro/api/webhooks/provider?secret=test-webhook-secret-2026&order=123', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: '123' })
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('SEC-CRYPTO-006: Provider Webhook (/api/webhooks/provider) accepts valid x-webhook-secret header', async () => {
      vi.stubEnv('WEBHOOK_SECRET', 'test-webhook-secret-2026');
      vi.doMock('@/lib/db', () => ({
        db: {
          order: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      }));
      const { POST } = await import('@/app/api/webhooks/provider/route');
      const req = new Request('https://smmplan.pro/api/webhooks/provider', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-webhook-secret': 'test-webhook-secret-2026'
        },
        body: JSON.stringify({ id: 'non-existent-order-id-test' })
      });

      const res = await POST(req);
      // Order not found returns 200 with message (authorized)
      expect(res.status).toBe(200);
    });

    it('SEC-IP-001: getClientIp safely parses IPv4, IPv6, IPv4-mapped IPv6, and X-Forwarded-For', async () => {
      const { getClientIp } = await vi.importActual<typeof import('@/utils/ip')>('@/utils/ip');

      // 1. x-real-ip precedence
      const h1 = new Headers({ 'x-real-ip': '185.75.120.10', 'x-forwarded-for': '203.0.113.1' });
      expect(await getClientIp(h1)).toBe('185.75.120.10');

      // 2. IPv4-mapped IPv6 normalization
      const h2 = new Headers({ 'x-real-ip': '::ffff:185.75.120.10' });
      expect(await getClientIp(h2)).toBe('185.75.120.10');

      // 3. Rightmost valid hop from X-Forwarded-For
      const h3 = new Headers({ 'x-forwarded-for': '203.0.113.1, 198.51.100.2, 185.75.120.5' });
      expect(await getClientIp(h3)).toBe('185.75.120.5');

      // 4. Invalid IP fallback
      const h4 = new Headers({ 'x-real-ip': '999.999.999.999' });
      expect(await getClientIp(h4, '0.0.0.0')).toBe('0.0.0.0');
    });

    it('SEC-LOCK-001: MutexManager.extendLock verifies token ownership before extending TTL', async () => {
      const { MutexManager } = await import('@/lib/redis-lock');
      // When token is empty, immediately returns false
      expect(await MutexManager.extendLock('test-key', '', 5000)).toBe(false);
    });

    it('SEC-LOCK-002: MutexManager.withLock executes task and cleans up heartbeat timer and lock', async () => {
      const { MutexManager } = await import('@/lib/redis-lock');
      let executed = false;
      const res = await MutexManager.withLock('unit-test-lock-key', 500, 1000, async () => {
        executed = true;
        return 'success';
      });
      expect(res).toBe('success');
      expect(executed).toBe(true);
    });
  });

  describe('VexBoost Webhook (/api/webhooks/vexboost)', () => {
    it('SEC-VEX-001: Returns 403 Forbidden when x-timestamp header is missing (fail-closed replay defense)', async () => {
      vi.stubEnv('VEXBOOST_WEBHOOK_SECRET', 'test-vexboost-secret-2026');
      const { POST } = await import('@/app/api/webhooks/vexboost/route');
      const req = new NextRequest('https://smmplan.pro/api/webhooks/vexboost', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': 'test-vexboost-secret-2026',
        },
        body: JSON.stringify({ id: '123' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Missing x-timestamp header');
    });

    it('SEC-VEX-002: Returns 403 Forbidden when x-timestamp is expired (> 5 minutes)', async () => {
      vi.stubEnv('VEXBOOST_WEBHOOK_SECRET', 'test-vexboost-secret-2026');
      const { POST } = await import('@/app/api/webhooks/vexboost/route');
      const staleTimestamp = String(Date.now() - 10 * 60 * 1000);
      const req = new NextRequest('https://smmplan.pro/api/webhooks/vexboost', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': 'test-vexboost-secret-2026',
          'x-timestamp': staleTimestamp,
        },
        body: JSON.stringify({ id: '123' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Webhook timestamp expired or invalid');
    });

    it('SEC-VEX-003: Returns 401 Unauthorized when secret is missing', async () => {
      vi.stubEnv('VEXBOOST_WEBHOOK_SECRET', 'test-vexboost-secret-2026');
      const { POST } = await import('@/app/api/webhooks/vexboost/route');
      const freshTimestamp = String(Date.now());
      const req = new NextRequest('https://smmplan.pro/api/webhooks/vexboost', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-timestamp': freshTimestamp,
        },
        body: JSON.stringify({ id: '123' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('SEC-VEX-004: Returns 401 Unauthorized when secret does not match', async () => {
      vi.stubEnv('VEXBOOST_WEBHOOK_SECRET', 'test-vexboost-secret-2026');
      const { POST } = await import('@/app/api/webhooks/vexboost/route');
      const freshTimestamp = String(Date.now());
      const req = new NextRequest('https://smmplan.pro/api/webhooks/vexboost', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': 'wrong-secret-value-attempt',
          'x-timestamp': freshTimestamp,
        },
        body: JSON.stringify({ id: '123' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Wallet Integrity (src/services/financial/wallet-ops.ts)', () => {
    it('SEC-REFUND-001: Throws and aborts transaction if refund would cause totalSpent to become negative', async () => {
      const { WalletOps } = await import('@/services/financial/wallet-ops');
      
      const mockTx = {
        user: {
          update: vi.fn().mockResolvedValue({
            balance: BigInt(2000),
            totalSpent: BigInt(-100), // Negative totalSpent
            tenantId: 'smmplan',
          }),
        },
        ledgerEntry: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'ledger-test' }),
        },
      } as any;

      await expect(
        WalletOps.refund(mockTx, 'user-123', 500, 'Refund reason', {
          idempotencyKey: 'idemp-refund-test-negative',
        })
      ).rejects.toThrow(/Accounting integrity violation: totalSpent went negative/);
    });
  });
});
