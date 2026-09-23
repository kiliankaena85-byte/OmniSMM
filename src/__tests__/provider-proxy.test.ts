import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db';
import {
  createProviderProxyAction,
  deleteProviderProxyAction,
  assignProxyToProviderAction,
  batchAssignProxiesAction,
  listProviderProxiesAction,
  getProxyHealthSummaryAction,
} from '@/actions/admin/provider-proxy';
import { VaultService } from '@/lib/vault';
import { assertSafeOutboundUrl } from '@/lib/security/ssrf-guard';

vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn((_section, _action, callback) =>
    callback({ id: 'test-admin-id', email: 'admin@smmplan.pro', role: 'SUPERADMIN' }),
  ),
  requireOwnerPermission: vi.fn((callback) =>
    callback({ id: 'test-admin-id', email: 'admin@smmplan.pro', role: 'SUPERADMIN' }),
  ),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: Function) => fn,
}));

describe('Provider Proxy Management System (Enterprise & OWASP Top 10 2025)', () => {
  let createdProxyIds: string[] = [];
  let createdProviderIds: string[] = [];

  beforeEach(async () => {
    createdProxyIds = [];
    createdProviderIds = [];
  });

  afterEach(async () => {
    // Cleanup providers first due to FK constraints
    if (createdProviderIds.length > 0) {
      await db.provider.deleteMany({
        where: { id: { in: createdProviderIds } },
      });
    }
    if (createdProxyIds.length > 0) {
      await db.providerProxy.deleteMany({
        where: { id: { in: createdProxyIds } },
      });
    }
  });

  it('1. should create a proxy with AES-256 encrypted password and validate inputs', async () => {
    const payload = {
      label: 'Test Proxy NL',
      description: 'Amsterdam Data Center',
      protocol: 'socks5',
      host: 'proxy-nl.example.com',
      port: 1080,
      username: 'proxy_user',
      password: 'super_secret_proxy_password',
      geoCountry: 'NL',
      tags: ['fast', 'eu'],
      isRotating: true,
    };

    const res = await createProviderProxyAction(payload);
    expect(res.success).toBe(true);
    if (!res.success) throw new Error('Create failed');
    expect(res.data).toBeDefined();

    const proxyId = res.data.id;
    createdProxyIds.push(proxyId);

    // Verify in DB directly
    const dbRecord = await db.providerProxy.findUnique({
      where: { id: proxyId },
    });
    expect(dbRecord).toBeDefined();
    expect(dbRecord!.label).toBe('Test Proxy NL');
    expect(dbRecord!.protocol).toBe('socks5');
    expect(dbRecord!.passwordEncrypted).not.toBeNull();
    expect(dbRecord!.passwordEncrypted).not.toBe('super_secret_proxy_password');

    // Verify decryption matches original password (OWASP A02)
    const decrypted = VaultService.decrypt(dbRecord!.passwordEncrypted!);
    expect(decrypted).toBe('super_secret_proxy_password');
  });

  it('2. should reject invalid host format or port range (OWASP A03)', async () => {
    // Invalid port
    const invalidPortRes = await createProviderProxyAction({
      label: 'Bad Port Proxy',
      protocol: 'https',
      host: 'valid-host.com',
      port: 70000,
    });
    expect(invalidPortRes.success).toBe(false);

    // Invalid host
    const invalidHostRes = await createProviderProxyAction({
      label: 'Bad Host Proxy',
      protocol: 'https',
      host: 'not a valid host @@@',
      port: 8080,
    });
    expect(invalidHostRes.success).toBe(false);
  });

  it('3. should assign and unassign proxy to provider', async () => {
    // Create proxy
    const proxyRes = await createProviderProxyAction({
      label: 'Dedicated Provider Proxy',
      protocol: 'https',
      host: '1.2.3.4',
      port: 8080,
    });
    expect(proxyRes.success).toBe(true);
    if (!proxyRes.success) throw new Error('Create proxy failed');
    const proxyId = proxyRes.data.id;
    createdProxyIds.push(proxyId);

    // Create provider
    const provider = await db.provider.create({
      data: {
        name: `Test Panel ${Date.now()}`,
        apiUrl: 'https://api.testpanel.com',
        apiKey: 'encrypted_key_123',
        isActive: true,
      },
    });
    createdProviderIds.push(provider.id);

    // Assign proxy
    const assignRes = await assignProxyToProviderAction({
      providerId: provider.id,
      proxyId,
    });
    expect(assignRes.success).toBe(true);

    const updatedProvider = await db.provider.findUnique({
      where: { id: provider.id },
    });
    expect(updatedProvider!.proxyId).toBe(proxyId);

    // Unassign proxy (direct connection)
    const unassignRes = await assignProxyToProviderAction({
      providerId: provider.id,
      proxyId: null,
    });
    expect(unassignRes.success).toBe(true);

    const directProvider = await db.provider.findUnique({
      where: { id: provider.id },
    });
    expect(directProvider!.proxyId).toBeNull();
  });

  it('4. should batch assign proxies across multiple providers', async () => {
    const proxyRes = await createProviderProxyAction({
      label: 'Batch Proxy',
      protocol: 'socks5',
      host: '5.6.7.8',
      port: 1080,
    });
    if (!proxyRes.success) throw new Error('Create proxy failed');
    const proxyId = proxyRes.data.id;
    createdProxyIds.push(proxyId);

    const p1 = await db.provider.create({
      data: { name: `Batch P1 ${Date.now()}`, apiUrl: 'https://p1.com', apiKey: 'k1', isActive: true },
    });
    const p2 = await db.provider.create({
      data: { name: `Batch P2 ${Date.now()}`, apiUrl: 'https://p2.com', apiKey: 'k2', isActive: true },
    });
    createdProviderIds.push(p1.id, p2.id);

    const batchRes = await batchAssignProxiesAction({
      assignments: [
        { providerId: p1.id, proxyId },
        { providerId: p2.id, proxyId: null },
      ],
    });
    expect(batchRes.success).toBe(true);

    const checkP1 = await db.provider.findUnique({ where: { id: p1.id } });
    const checkP2 = await db.provider.findUnique({ where: { id: p2.id } });
    expect(checkP1!.proxyId).toBe(proxyId);
    expect(checkP2!.proxyId).toBeNull();
  });

  it('5. should unbind providers when deleting a proxy', async () => {
    const proxyRes = await createProviderProxyAction({
      label: 'Proxy To Delete',
      protocol: 'https',
      host: '9.10.11.12',
      port: 3128,
    });
    if (!proxyRes.success) throw new Error('Create proxy failed');
    const proxyId = proxyRes.data.id;

    const provider = await db.provider.create({
      data: {
        name: `Bound Provider ${Date.now()}`,
        apiUrl: 'https://bound.com',
        apiKey: 'k',
        proxyId,
        isActive: true,
      },
    });
    createdProviderIds.push(provider.id);

    const deleteRes = await deleteProviderProxyAction(proxyId);
    expect(deleteRes.success).toBe(true);

    // Verify proxy was deleted and provider was unlinked (proxyId = null)
    const checkProxy = await db.providerProxy.findUnique({ where: { id: proxyId } });
    expect(checkProxy).toBeNull();

    const checkProvider = await db.provider.findUnique({ where: { id: provider.id } });
    expect(checkProvider!.proxyId).toBeNull();
  });

  it('6. should list proxies with usage stats and health summary', async () => {
    const proxyRes = await createProviderProxyAction({
      label: 'Summary Proxy',
      protocol: 'https',
      host: '13.14.15.16',
      port: 8080,
    });
    if (!proxyRes.success) throw new Error('Create proxy failed');
    createdProxyIds.push(proxyRes.data.id);

    const listRes = await listProviderProxiesAction();
    expect(listRes.success).toBe(true);
    if (!listRes.success) throw new Error('List failed');
    expect(Array.isArray(listRes.data)).toBe(true);
    expect(listRes.data.some((p) => p.id === proxyRes.data.id)).toBe(true);

    const summaryRes = await getProxyHealthSummaryAction();
    expect(summaryRes.success).toBe(true);
    if (!summaryRes.success) throw new Error('Summary failed');
    expect(summaryRes.data.total).toBeGreaterThanOrEqual(1);
    expect(summaryRes.data.active).toBeGreaterThanOrEqual(1);
  });

  it('7. should block SSRF outbound attacks on private/cloud metadata ranges (OWASP A10)', async () => {
    const awsMetadataCheck = await assertSafeOutboundUrl('http://169.254.169.254/latest/meta-data/');
    expect(awsMetadataCheck.ok).toBe(false);

    const localhostCheck = await assertSafeOutboundUrl('http://localhost:3000/api/admin');
    expect(localhostCheck.ok).toBe(false);

    const loopbackCheck = await assertSafeOutboundUrl('http://127.0.0.1:8100/api/search');
    expect(loopbackCheck.ok).toBe(false);

    const publicCheck = await assertSafeOutboundUrl('https://httpbin.org/ip');
    expect(publicCheck.ok).toBe(true);
  });
});
