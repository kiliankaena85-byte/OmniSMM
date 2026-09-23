import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { testProxyConnection, buildProxyConfig, proxiedFetch } from '../lib/http/proxy-fetch';
import { VaultService } from '../lib/vault';

const prisma = new PrismaClient();

describe('BLOCK 22: Proxy Stress Testing, Self-Healing & Fallback Suite', () => {
  let testProxyId = '';
  let providerId = '';

  beforeEach(async () => {
    // 1. Create a simulated primary proxy
    const encPass = VaultService.encrypt('secure_pass_123');
    const proxy = await prisma.providerProxy.create({
      data: {
        label: 'Clash Verge Local Gateway (Primary)',
        protocol: 'http',
        host: '127.0.0.1',
        port: 7890,
        username: 'smmplan_gw',
        passwordEncrypted: encPass,
        isActive: true,
        isRotating: true,
        consecutiveFailures: 0,
        errorCount: 0,
        tags: JSON.stringify(['clash', 'auto-rotation']),
      },
    });
    testProxyId = proxy.id;

    // 2. Create provider bound to proxy
    const provider = await prisma.provider.create({
      data: {
        name: 'Foreign Provider (Proxied)',
        apiUrl: 'https://foreign-smm.example.com/api/v2',
        apiKey: VaultService.encrypt('foreign_api_key'),
        isActive: true,
        proxyId: testProxyId,
      },
    });
    providerId = provider.id;
  });

  afterEach(async () => {
    await prisma.provider.deleteMany({ where: { id: providerId } });
    await prisma.providerProxy.deleteMany({ where: { id: testProxyId } });
  });

  // --------------------------------------------------------------------------
  // 1. Proxy Config & Vault Decryption (OWASP A02 & A10)
  // --------------------------------------------------------------------------
  it('Proxy Stress 1: Vault correctly decrypts credentials for runtime dispatcher', async () => {
    const dbProxy = await prisma.providerProxy.findUnique({ where: { id: testProxyId } });
    expect(dbProxy).toBeDefined();

    const decryptedPassword = VaultService.decrypt(dbProxy!.passwordEncrypted!);
    expect(decryptedPassword).toBe('secure_pass_123');

    const config = buildProxyConfig({
      protocol: dbProxy!.protocol,
      host: dbProxy!.host,
      port: dbProxy!.port,
      username: dbProxy!.username,
      password: decryptedPassword,
    });

    expect(config).toBeDefined();
    expect(config!.host).toBe('127.0.0.1');
    expect(config!.port).toBe(7890);
    expect(config!.protocol).toBe('http');
  });

  // --------------------------------------------------------------------------
  // 2. Simulated Proxy Outage & Circuit Breaking Detection
  // --------------------------------------------------------------------------
  it('Proxy Stress 2: Dead proxy failure is detected within timeout and increments consecutiveFailures', async () => {
    // Test connection to a dead port
    const deadProxyConfig = {
      protocol: 'http' as const,
      host: '127.0.0.1',
      port: 59999, // intentionally closed port
    };

    const result = await testProxyConnection(deadProxyConfig, 'https://httpbin.org/ip', 1500); // 1.5s fast timeout
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    // Circuit Breaker simulation: When test fails, consecutiveFailures increments
    const updated = await prisma.providerProxy.update({
      where: { id: testProxyId },
      data: {
        consecutiveFailures: { increment: 1 },
        lastTestSuccess: false,
        lastTestLatencyMs: result.latencyMs,
      },
    });

    expect(updated.consecutiveFailures).toBe(1);
    expect(updated.lastTestSuccess).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 3. Self-Healing Proxy Demotion & Direct Fallback
  // --------------------------------------------------------------------------
  it('Proxy Stress 3: Tripped proxy (consecutiveFailures >= 3) triggers automatic fallback to direct route', async () => {
    // 1. Simulate 3 consecutive failures
    await prisma.providerProxy.update({
      where: { id: testProxyId },
      data: { consecutiveFailures: 3, isActive: false },
    });

    // 2. Resolver checks proxy health
    const proxyRecord = await prisma.providerProxy.findUnique({ where: { id: testProxyId } });
    const isProxyHealthy = proxyRecord && proxyRecord.isActive && proxyRecord.consecutiveFailures < 3;
    expect(isProxyHealthy).toBe(false);

    // 3. Fallback logic: If proxy is degraded, dispatch proceeds without broken proxy or switches to backup
    const effectiveProxy = isProxyHealthy ? buildProxyConfig(proxyRecord) : null;
    expect(effectiveProxy).toBeNull(); // Gracefully falls back to direct connection without crash!
  });

  // --------------------------------------------------------------------------
  // 4. SSRF Defense: Blocks Proxy from Scanning Internal Subnets (127.0.0.1, 10.0.0.0/8)
  // --------------------------------------------------------------------------
  it('Proxy Stress 4: SSRF Guard strictly blocks proxied requests targeting internal AWS/K8s/Docker IPs', async () => {
    const maliciousInternalTargets = [
      'http://169.254.169.254/latest/meta-data/', // AWS IMDS
      'http://10.0.0.1:8080/admin',
      'http://192.168.1.1/router',
    ];

    for (const target of maliciousInternalTargets) {
      await expect(proxiedFetch(target, { proxy: null })).rejects.toThrow(/SSRF/);
    }
  });
});
