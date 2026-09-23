/**
 * e2e/10-proxy-pool-and-resilience.spec.ts
 * BLOCK 10: Proxy Pool Management (Vault-Encrypted) & Provider Resilience (Circuit Breaker, Failover)
 *
 * Invariants & Contract (AGENTS.md & Zero-Defect):
 * 1. Proxy passwords encrypted via VaultService (AES-256-GCM) in ProviderProxy.passwordEncrypted.
 * 2. VaultService never returns plaintext from malformed payloads (throws on non-3-part format).
 * 3. Circuit breaker trips after FAILURE_THRESHOLD (5) failures within FAILURE_WINDOW.
 * 4. Provider API keys stored encrypted; VaultService.decrypt() used at runtime.
 * 5. Admin proxy test action validates connectivity and updates health metrics.
 * 6. HTTP/SOCKS5 proxy protocols supported.
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { VaultService } from '../src/lib/vault';
import { CircuitBreaker } from '../src/lib/circuit-breaker';

const db = new PrismaClient();
const TENANT = 'smmplan';

test.describe.serial('BLOCK 10: Proxy Pool & Resilience E2E', () => {
  let providerId: string;
  let proxyId: string;
  let adminUserId: string;

  test.beforeAll(async () => {
    // Create admin user
    const admin = await db.user.create({
      data: {
        email: `proxy-admin-${Date.now()}@smmplan.local`, tenantId: TENANT,
        role: 'OWNER', isActive: true, isDeleted: false,
      },
    });
    adminUserId = admin.id;

    await db.employeeResponsibilityConsent.create({
      data: {
        userId: adminUserId, tenantId: TENANT,
        documentHash: 'e2e-proxy-consent', documentVersionText: '1.0',
        status: 'ACTIVE', acceptedIp: '127.0.0.1', acceptedUserAgent: 'Playwright E2E',
      },
    });

    // Create provider
    providerId = `e2e-proxy-provider-${Date.now()}`;
    await db.provider.create({
      data: {
        id: providerId, name: 'E2E Proxy Test Provider',
        apiUrl: 'https://api.proxy-test.local/v2',
        apiKey: VaultService.encrypt('secret_provider_key_block10'),
        isActive: true,
      },
    });

    // Create HTTP proxy with encrypted password
    const plainPassword = 'proxy_pass_12345';
    const encryptedPassword = VaultService.encrypt(plainPassword);

    const proxy = await db.providerProxy.create({
      data: {
        label: 'HTTP Proxy 1',
        host: '192.168.1.100',
        port: 8080,
        protocol: 'HTTP',
        username: 'proxyuser',
        passwordEncrypted: encryptedPassword,
        isActive: true,
              },
    });
    proxyId = proxy.id;
  });

  test.afterAll(async () => {
    await db.providerProxy.deleteMany({ where: { providerId } }).catch(() => {});
    await db.provider.deleteMany({ where: { id: providerId } }).catch(() => {});
    await db.adminAuditLog.deleteMany({ where: { adminId: adminUserId } }).catch(() => {});
    await db.employeeResponsibilityConsent.deleteMany({ where: { userId: adminUserId } }).catch(() => {});
    await db.user.delete({ where: { id: adminUserId } }).catch(() => {});
    await db.$disconnect();
  });

  test('Scenario 1: VaultService Encrypt/Decrypt Roundtrip for Proxy Password', () => {
    const plainPassword = 'secure_proxy_password_xyz!';

    // Encrypt
    const encrypted = VaultService.encrypt(plainPassword);
    expect(encrypted).not.toBe(plainPassword);

    // Verify format: iv:authTag:ciphertext (3 parts separated by colons)
    const parts = encrypted.split(':');
    expect(parts.length).toBe(3);
    expect(parts[0].length).toBe(32); // 16-byte IV = 32 hex chars
    expect(parts[1].length).toBe(32); // 16-byte AuthTag = 32 hex chars

    // Decrypt back to original
    const decrypted = VaultService.decrypt(encrypted);
    expect(decrypted).toBe(plainPassword);
  });

  test('Scenario 2: VaultService Rejects Malformed Payload', () => {
    // Non-3-part format should throw
    expect(() => VaultService.decrypt('not_encrypted')).toThrow();
    expect(() => VaultService.decrypt('only:two:parts:extra')).toThrow();
    expect(VaultService.decrypt('')).toBe('');
    expect(() => VaultService.decrypt(null as any)).not.toThrow(); // returns ''
    expect(() => VaultService.decrypt(undefined as any)).not.toThrow(); // returns ''
  });

  test('Scenario 3: Proxy Password Stored Encrypted in DB', async () => {
    const proxy = await db.providerProxy.findUnique({ where: { id: proxyId } });
    expect(proxy).not.toBeNull();
    expect(proxy?.passwordEncrypted).not.toBe('proxy_pass_12345');

    // Should be in iv:authTag:ciphertext format
    const parts = proxy!.passwordEncrypted.split(':');
    expect(parts.length).toBe(3);

    // Decrypting should give back the original password
    const decrypted = VaultService.decrypt(proxy!.passwordEncrypted);
    expect(decrypted).toBe('proxy_pass_12345');
  });

  test('Scenario 4: Provider API Key Stored Encrypted', async () => {
    const provider = await db.provider.findUnique({ where: { id: providerId } });
    expect(provider).not.toBeNull();
    expect(provider?.apiKey).not.toBe('secret_provider_key_block10');

    // Should be in encrypted format
    const parts = provider!.apiKey!.split(':');
    expect(parts.length).toBe(3);

    const decrypted = VaultService.decrypt(provider!.apiKey!);
    expect(decrypted).toBe('secret_provider_key_block10');
  });

  test('Scenario 5: Proxy CRUD — Create SOCKS5 Proxy', async () => {
    const plainPwd = 'socks5_secret';
    const socksProxy = await db.providerProxy.create({
      data: {
        label: 'SOCKS5 Proxy Test',
        host: '10.0.0.50',
        port: 1080,
        protocol: 'SOCKS5',
        username: 'socksuser',
        passwordEncrypted: VaultService.encrypt(plainPwd),
        isActive: true,
              },
    });

    expect(socksProxy.id).toBeTruthy();
    expect(socksProxy.protocol).toBe('SOCKS5');
    expect(socksProxy.port).toBe(1080);

    // Decrypt and verify
    expect(VaultService.decrypt(socksProxy.passwordEncrypted)).toBe(plainPwd);

    // Update proxy
    await db.providerProxy.update({
      where: { id: socksProxy.id },
      data: { port: 1081, isActive: false },
    });
    const updated = await db.providerProxy.findUnique({ where: { id: socksProxy.id } });
    expect(updated?.port).toBe(1081);
    expect(updated?.isActive).toBe(false);

    // Cleanup
    await db.providerProxy.delete({ where: { id: socksProxy.id } });
  });

  test('Scenario 6: Proxy Health Metrics Update', async () => {
    // Initial state
    const before = await db.providerProxy.findUnique({ where: { id: proxyId } });
    expect(before?.consecutiveFailures).toBe(0);
    expect(before?.lastTestAt).toBeNull();

    // Simulate health check update (as admin action would do)
    await db.providerProxy.update({
      where: { id: proxyId },
      data: {
        consecutiveFailures: 2,
        lastTestAt: new Date(),
        lastTestLatencyMs: 150,
      },
    });

    const after = await db.providerProxy.findUnique({ where: { id: proxyId } });
    expect(after?.consecutiveFailures).toBe(2);
    expect(after?.lastTestAt).not.toBeNull();
    expect(after?.lastTestLatencyMs).toBe(150);

    // Reset for clean state
    await db.providerProxy.update({
      where: { id: proxyId },
      data: { consecutiveFailures: 0, lastTestLatencyMs: null },
    });
  });

  test('Scenario 7: Provider with Proxy Assignment', async () => {
    // Assign proxy to provider
    await db.provider.update({
      where: { id: providerId },
      data: { proxyId },
    });

    const provider = await db.provider.findUnique({
      where: { id: providerId },
      include: { proxy: true },
    });
    expect(provider?.proxyId).toBe(proxyId);
    expect(provider?.proxy).not.toBeNull();
    expect(provider?.proxy?.protocol).toBe('HTTP');

    // Unassign
    await db.provider.update({
      where: { id: providerId },
      data: { proxyId: null },
    });
  });

  test('Scenario 8: Circuit Breaker State Transitions', async () => {
    const testUrl = `https://e2e-test-host-${Date.now()}.example.com`;

    // Initial check should pass
    await expect(CircuitBreaker.check(testUrl)).resolves.not.toThrow();

    // Record failures up to threshold (5)
    for (let i = 0; i < 5; i++) {
      await CircuitBreaker.recordFailure(testUrl);
    }

    // Should throw now because circuit is OPEN
    await expect(CircuitBreaker.check(testUrl)).rejects.toThrow(/Circuit breaker is OPEN/);

    // Record success resets the circuit
    await CircuitBreaker.recordSuccess(testUrl);
    await expect(CircuitBreaker.check(testUrl)).resolves.not.toThrow();
  });

  test('Scenario 9: Multiple Proxies Cannot Share Same Provider (One-to-One)', async () => {
    // Create second proxy for same provider
    const proxy2 = await db.providerProxy.create({
      data: {
        label: 'Second HTTP Proxy',
        host: '10.0.0.99', port: 3128, protocol: 'HTTP',
        username: 'user2',
        passwordEncrypted: VaultService.encrypt('pass2'),
        isActive: true,       },
    });

    // Both proxies exist in the pool
    const proxyCount = await db.providerProxy.count({ where: { id: { in: [proxyId, proxy2.id] } } });
    expect(proxyCount).toBe(2);

    // But provider.proxyId is a single relation
    await db.provider.update({ where: { id: providerId }, data: { proxyId: proxy2.id } });
    const provider = await db.provider.findUnique({
      where: { id: providerId },
      include: { proxy: true },
    });
    expect(provider?.proxy?.id).toBe(proxy2.id);

    // Cleanup
    await db.provider.update({ where: { id: providerId }, data: { proxyId: null } });
    await db.providerProxy.delete({ where: { id: proxy2.id } });
  });

  test('Scenario 10: VaultService Hash for Non-Reversible Data', () => {
    const input = 'sensitive_data_to_hash';
    const hash1 = VaultService.hash(input);
    const hash2 = VaultService.hash(input);

    // Deterministic
    expect(hash1).toBe(hash2);

    // SHA-256 hex output (64 chars)
    expect(hash1.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(hash1)).toBe(true);

    // Different input produces different hash
    const hash3 = VaultService.hash('different_input');
    expect(hash1).not.toBe(hash3);
  });
});
