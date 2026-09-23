// tenant-isolation-ignore: Unit test for dynamic domain session verification
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainRegistryService } from '@/services/tenant/domain-registry.service';

const { mockDeleteCookie, mockCookieStore, mockHeaders, mockDb } = vi.hoisted(() => {
  const mockDeleteCookie = vi.fn();
  const mockCookieStore = {
    get: vi.fn(),
    set: vi.fn(),
    delete: mockDeleteCookie,
  };
  const mockHeaders = new Map<string, string>();
  const mockDb = {
    session: {
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    securityEvent: {
      create: vi.fn(),
    },
  };
  return { mockDeleteCookie, mockCookieStore, mockHeaders, mockDb };
});

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockImplementation(async () => mockCookieStore),
  headers: vi.fn().mockImplementation(async () => ({
    get: (key: string) => mockHeaders.get(key.toLowerCase()) || null,
  })),
}));

vi.mock('@/lib/db', () => ({
  db: mockDb,
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    hget: vi.fn().mockResolvedValue(null),
    pipeline: vi.fn(() => ({
      hset: vi.fn(),
      exec: vi.fn().mockResolvedValue([]),
    })),
  },
}));

vi.mock('@/lib/session-edge', () => ({
  SESSION_COOKIE_NAME: 'session',
  LEGACY_SESSION_COOKIE_NAME: 'auth_token',
  readSessionTokenFromCookies: vi.fn().mockReturnValue('mock-jwt-token'),
  decryptSessionToken: vi.fn(),
  getEncodedKey: vi.fn().mockReturnValue(new Uint8Array(32)),
}));

import { verifySession } from '@/lib/session';
import { decryptSessionToken } from '@/lib/session-edge';

describe('Dynamic Domain Session Invariants Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.clear();
    DomainRegistryService.invalidateCache();
  });

  it('preserves user session on registered dynamic domain when tenant matches', async () => {
    // 1. Register domain in L1 cache
    await DomainRegistryService.registerDomain({
      slug: 'alpha-smm',
      domain: 'alpha-smm.com',
      isActive: true,
    });

    // 2. Setup incoming request headers for alpha-smm.com
    mockHeaders.set('host', 'alpha-smm.com');
    mockHeaders.set('x-tenant-id', 'alpha-smm');
    mockHeaders.set('x-pathname', '/dashboard');

    // 3. Mock decrypted JWT payload
    vi.mocked(decryptSessionToken).mockResolvedValue({
      sessionId: 'sess-alpha-123',
      userId: 'user-alpha-456',
      tenantId: 'alpha-smm',
      contour: 'test',
    } as any);

    // 4. Mock DB session lookup
    vi.mocked(mockDb.session.findUnique).mockResolvedValue({
      id: 'sess-alpha-123',
      userId: 'user-alpha-456',
      expiresAt: new Date(Date.now() + 3600 * 1000),
      user: {
        id: 'user-alpha-456',
        email: 'client@alpha-smm.com',
        role: 'USER',
        tenantId: 'alpha-smm',
        isActive: true,
        isDeleted: false,
      }
    } as any);

    const session = await verifySession();

    expect(session).not.toBeNull();
    expect(session?.userId).toBe('user-alpha-456');
    // Crucial: Cookies must NOT have been cleared!
    expect(mockDeleteCookie).not.toHaveBeenCalled();
  });

  it('strictly clears cookies when cross-tenant user accesses another dynamic domain', async () => {
    // 1. Register domain for beta-brand
    await DomainRegistryService.registerDomain({
      slug: 'beta-brand',
      domain: 'beta-brand.com',
      isActive: true,
    });

    // 2. User from smmplan visits beta-brand.com
    mockHeaders.set('host', 'beta-brand.com');
    mockHeaders.set('x-tenant-id', 'beta-brand');
    mockHeaders.set('x-pathname', '/dashboard');

    vi.mocked(decryptSessionToken).mockResolvedValue({
      sessionId: 'sess-wrong-1',
      userId: 'user-smmplan-1',
      tenantId: 'smmplan',
      contour: 'prod',
    } as any);

    vi.mocked(mockDb.session.findUnique).mockResolvedValue({
      id: 'sess-wrong-1',
      userId: 'user-smmplan-1',
      expiresAt: new Date(Date.now() + 3600 * 1000),
      user: {
        id: 'user-smmplan-1',
        email: 'user@smmplan.pro',
        role: 'USER',
        tenantId: 'smmplan', // Mismatch!
        isActive: true,
        isDeleted: false,
      }
    } as any);

    const session = await verifySession();

    expect(session).toBeNull();
    // Security Guard: Cross-tenant mismatch MUST clear session cookies
    expect(mockDeleteCookie).toHaveBeenCalledWith('session');
    expect(mockDeleteCookie).toHaveBeenCalledWith('auth_token');
  });

  it('does NOT trigger false contour mismatch for verified custom domains', async () => {
    // Domain registered in dynamic registry
    await DomainRegistryService.registerDomain({
      slug: 'vip-agency',
      domain: 'vip-agency.com',
      isActive: true,
    });

    mockHeaders.set('host', 'vip-agency.com');
    mockHeaders.set('x-tenant-id', 'vip-agency');
    mockHeaders.set('x-pathname', '/dashboard');

    // Token has contour 'prod', but host resolveContourFromHost would default to 'test'
    vi.mocked(decryptSessionToken).mockResolvedValue({
      sessionId: 'sess-vip-1',
      userId: 'user-vip-1',
      tenantId: 'vip-agency',
      contour: 'prod',
    } as any);

    vi.mocked(mockDb.session.findUnique).mockResolvedValue({
      id: 'sess-vip-1',
      userId: 'user-vip-1',
      expiresAt: new Date(Date.now() + 3600 * 1000),
      user: {
        id: 'user-vip-1',
        email: 'ceo@vip-agency.com',
        role: 'USER',
        tenantId: 'vip-agency',
        isActive: true,
        isDeleted: false,
      }
    } as any);

    const session = await verifySession();

    expect(session).not.toBeNull();
    expect(session?.userId).toBe('user-vip-1');
    expect(mockDeleteCookie).not.toHaveBeenCalled();
  });

  it('preserves session on custom domain even when L1 in-memory cache is cold by resolving dynamically', async () => {
    // L1 cache is cold (not registered in memory)
    DomainRegistryService.invalidateCache();

    // Mock DB tenant lookup returning the active tenant
    (mockDb as any).tenant = {
      findFirst: vi.fn().mockResolvedValue({
        id: 'cold-vip',
        slug: 'cold-vip',
        domain: 'cold-vip.agency',
        isActive: true,
      }),
    };

    mockHeaders.set('host', 'cold-vip.agency');
    mockHeaders.set('x-tenant-id', 'cold-vip');
    mockHeaders.set('x-pathname', '/dashboard');

    vi.mocked(decryptSessionToken).mockResolvedValue({
      sessionId: 'sess-cold-1',
      userId: 'user-cold-1',
      tenantId: 'cold-vip',
      contour: 'prod',
    } as any);

    vi.mocked(mockDb.session.findUnique).mockResolvedValue({
      id: 'sess-cold-1',
      userId: 'user-cold-1',
      expiresAt: new Date(Date.now() + 3600 * 1000),
      user: {
        id: 'user-cold-1',
        email: 'founder@cold-vip.agency',
        role: 'USER',
        tenantId: 'cold-vip',
        isActive: true,
        isDeleted: false,
      }
    } as any);

    const session = await verifySession();

    expect(session).not.toBeNull();
    expect(session?.userId).toBe('user-cold-1');
    // Session cookies MUST NOT be cleared even when L1 was completely cold
    expect(mockDeleteCookie).not.toHaveBeenCalled();
  });
});

