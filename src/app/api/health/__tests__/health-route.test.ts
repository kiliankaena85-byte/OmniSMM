import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import * as sessionModule from '@/lib/session';

describe('Track 2: /api/health Endpoint', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.CRON_SECRET = 'super-secret-cron-token-12345';
  });

  it('provides fast cached public liveness probe on GET /api/health', async () => {
    const req = new Request('http://localhost:3000/api/health');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(typeof body.timestamp).toBe('string');
  });

  it('rejects unauthorized detailed request with 401', async () => {
    vi.spyOn(sessionModule, 'verifySession').mockResolvedValue(null);
    const req = new Request('http://localhost:3000/api/health?detailed=1');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('allows detailed probe with valid Bearer token and returns 200 when healthy', async () => {
    vi.spyOn(db, '$queryRaw').mockResolvedValue([{ '?column?': 1 }]);
    vi.spyOn(redis, 'ping').mockResolvedValue('PONG');

    const req = new Request('http://localhost:3000/api/health?detailed=1', {
      headers: {
        Authorization: 'Bearer super-secret-cron-token-12345',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.database.status).toBe('connected');
    expect(typeof body.database.latencyMs).toBe('number');
    expect(body.redis.status).toBe('connected');
    expect(typeof body.redis.latencyMs).toBe('number');
    expect(body.memory).toBeDefined();
    expect(body.uptimeSeconds).toBeDefined();
  });

  it('allows detailed probe with admin session', async () => {
    vi.spyOn(sessionModule, 'verifySession').mockResolvedValue({
      userId: 'admin-1',
      role: 'ADMIN',
      tenantId: 'smmplan',
    });
    vi.spyOn(db, '$queryRaw').mockResolvedValue([{ '?column?': 1 }]);
    vi.spyOn(redis, 'ping').mockResolvedValue('PONG');

    const req = new Request('http://localhost:3000/api/health?detailed=1');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
  });

  it('returns 503 if database ping fails in detailed mode', async () => {
    vi.spyOn(db, '$queryRaw').mockRejectedValue(new Error('Connection timeout'));
    vi.spyOn(redis, 'ping').mockResolvedValue('PONG');

    const req = new Request('http://localhost:3000/api/health?detailed=1', {
      headers: {
        Authorization: 'Bearer super-secret-cron-token-12345',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('unhealthy');
    expect(body.database.status).toBe('error');
    expect(body.redis.status).toBe('connected');
  });

  it('returns 503 if redis ping fails in detailed mode', async () => {
    vi.spyOn(db, '$queryRaw').mockResolvedValue([{ '?column?': 1 }]);
    vi.spyOn(redis, 'ping').mockRejectedValue(new Error('Redis connection refused'));

    const req = new Request('http://localhost:3000/api/health?detailed=1', {
      headers: {
        Authorization: 'Bearer super-secret-cron-token-12345',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe('unhealthy');
    expect(body.database.status).toBe('connected');
    expect(body.redis.status).toBe('error');
  });
});
