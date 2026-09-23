import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { verifySession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface CachedHealth {
  status: 'healthy' | 'ok';
  service?: string;
  timestamp: string;
}

let cachedPublicProbe: CachedHealth | null = null;
let lastCacheTime = 0;
const PUBLIC_CACHE_TTL_MS = 5000;

function verifyBearerToken(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret || !authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(secret);
  if (tokenBuf.length !== secretBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(tokenBuf, secretBuf);
}

async function isAuthorizedCaller(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (verifyBearerToken(authHeader, cronSecret)) {
    return true;
  }

  try {
    const session = await verifySession();
    if (session && (session.role === 'ADMIN' || session.role === 'OWNER')) {
      return true;
    }
  } catch {
    // Session verification failed or outside request context
  }

  return false;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const isDetailed = searchParams.get('detailed') === '1';

  // 1. Fast Public Liveness Probe (Zero DB/Redis queries, 5s in-memory cache)
  if (!isDetailed) {
    const now = Date.now();
    if (!cachedPublicProbe || now - lastCacheTime >= PUBLIC_CACHE_TTL_MS) {
      cachedPublicProbe = {
        status: 'healthy',
        timestamp: new Date(now).toISOString(),
      };
      lastCacheTime = now;
    }

    return NextResponse.json(cachedPublicProbe, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=5, s-maxage=5',
      },
    });
  }

  // 2. Protected Readiness Probe (Auth required)
  const isAuthorized = await isAuthorizedCaller(req);
  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Unauthorized: Admin session or valid Bearer token required' },
      { status: 401 }
    );
  }

  // Database Check
  let dbStatus: 'connected' | 'error' = 'error';
  let dbLatencyMs = 0;
  try {
    const dbStart = performance.now();
    await db.$queryRaw`SELECT 1`;
    dbLatencyMs = Math.round(performance.now() - dbStart);
    dbStatus = 'connected';
  } catch {
    dbStatus = 'error';
  }

  // Redis Check
  let redisStatus: 'connected' | 'error' = 'error';
  let redisLatencyMs = 0;
  try {
    const redisStart = performance.now();
    await redis.ping();
    redisLatencyMs = Math.round(performance.now() - redisStart);
    redisStatus = 'connected';
  } catch {
    redisStatus = 'error';
  }

  // Process Memory Usage
  const mem = process.memoryUsage();
  const memoryUsage = {
    rssBytes: mem.rss,
    heapTotalBytes: mem.heapTotal,
    heapUsedBytes: mem.heapUsed,
    externalBytes: mem.external,
    heapUsedMB: Math.round((mem.heapUsed / (1024 * 1024)) * 100) / 100,
    rssMB: Math.round((mem.rss / (1024 * 1024)) * 100) / 100,
  };

  const isHealthy = dbStatus === 'connected' && redisStatus === 'connected';
  const httpStatus = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      redis: {
        status: redisStatus,
        latencyMs: redisLatencyMs,
      },
      memory: memoryUsage,
      uptimeSeconds: Math.round(process.uptime()),
    },
    { status: httpStatus }
  );
}
