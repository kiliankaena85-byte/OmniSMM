import { NextResponse } from 'next/server';
import syncProcessor from '@/workers/processors/sync.processor';
import { getRedisConnection } from '@/lib/queue-manager';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  // SEC-FIX-02: Fail-Closed — CRON_SECRET must be configured; reject all if missing
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[SyncOrdersCron] FATAL: CRON_SECRET is not configured. Rejecting all requests.');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const expectedAuth = `Bearer ${cronSecret}`;

  const crypto = await import('crypto');
  const isAuthorized =
    authHeader.length === expectedAuth.length &&
    crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedAuth));

  if (!isAuthorized) {
    console.warn('[SyncOrdersCron] Unauthorized access attempt blocked');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.info('[SyncOrdersCron] Starting inline synchronous order sync...');
    const redis = getRedisConnection();
    const lockKey = 'cron:sync-orders:lock';
    
    // Acquire lock for 2 minutes (prevent overlap starvation)
    const acquired = await redis.set(lockKey, '1', 'EX', 120, 'NX');
    if (!acquired) {
      console.warn('[SyncOrdersCron] Skipped. Another sync process is already running.');
      return NextResponse.json({ success: false, reason: 'overlap_prevented' }, { status: 200 });
    }
    
    try {
      const dummyJob = {
        id: `cron-${Date.now()}`,
        data: { timestamp: Date.now() }
            } as unknown as Parameters<typeof syncProcessor>[0];
  
      await syncProcessor(dummyJob);
    } finally {
      // Release lock
      await redis.del(lockKey);
    }

    console.info('[SyncOrdersCron] Synchronization completed successfully.');
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error: unknown) {
    console.error('[SyncOrdersCron] Error during execution:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

