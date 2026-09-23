import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET as devLoginGet } from '@/app/api/auth/dev-login/route';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    session: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('AUTH-01: Dev-Login Security Gate & Host Restriction', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('REPRODUCTION: rejects attacker sending Host: evil.com:3005 when ALLOW_DEV_LOGIN is true', async () => {
    (process.env as any).NODE_ENV = 'development';
    process.env.ALLOW_DEV_LOGIN = 'true';

    const req = new Request('http://evil.com:3005/api/auth/dev-login?role=OWNER', {
      headers: {
        host: 'evil.com:3005',
        'x-forwarded-for': '198.51.100.24',
        'user-agent': 'EvilBot/1.0',
      },
    });

    const res = await devLoginGet(req);
    expect(res.status).toBe(404);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[AUTH-01 Security Gate]'),
      expect.objectContaining({
        ip: '198.51.100.24',
        userAgent: 'EvilBot/1.0',
        rawHostname: 'evil.com',
      })
    );
  });

  it('rejects dev-login if ALLOW_DEV_LOGIN is not explicitly true even on localhost', async () => {
    (process.env as any).NODE_ENV = 'development';
    delete process.env.ALLOW_DEV_LOGIN;

    const req = new Request('http://localhost:3005/api/auth/dev-login?role=OWNER', {
      headers: {
        host: 'localhost:3005',
        'user-agent': 'Browser',
      },
    });

    const res = await devLoginGet(req);
    expect(res.status).toBe(404);
  });

  it('strictly rejects dev-login in production even if ALLOW_DEV_LOGIN=true and host is localhost', async () => {
    (process.env as any).NODE_ENV = 'production';
    process.env.ALLOW_DEV_LOGIN = 'true';

    const req = new Request('http://localhost:3005/api/auth/dev-login?role=OWNER', {
      headers: {
        host: 'localhost:3005',
        'user-agent': 'Browser',
      },
    });

    const res = await devLoginGet(req);
    expect(res.status).toBe(404);
  });

  it('allows dev-login when ALLOW_DEV_LOGIN=true, NODE_ENV!=production, and host is localhost:3005', async () => {
    (process.env as any).NODE_ENV = 'development';
    process.env.ALLOW_DEV_LOGIN = 'true';

    vi.mocked(db.user.findFirst).mockResolvedValue({
      id: 'usr_test_dev',
      email: 'owner@smmplan.pro',
      role: 'OWNER',
      tenantId: 'smmplan',
    } as any);

    vi.mocked(db.session.create).mockResolvedValue({
      id: 'sess_test_dev',
      userId: 'usr_test_dev',
      expiresAt: new Date(Date.now() + 86400000),
    } as any);

    const req = new Request('http://localhost:3005/api/auth/dev-login?role=OWNER', {
      headers: {
        host: 'localhost:3005',
        'user-agent': 'Stage-Puppeteer',
      },
    });

    const res = await devLoginGet(req);
    expect(res.status).toBe(307);
    const setCookie = res.headers.get('set-cookie') || '';
    expect(setCookie).toContain('session_token=');
  });
});
