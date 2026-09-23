export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getRedisConnection, catalogQueue } from '@/lib/queue-manager';
import crypto from 'crypto';

/**
 * P-D: Cron endpoint to reconcile and synchronize denormalized prices across all services.
 * Triggered by external cron or internal worker scheduler.
 */
export async function GET(req: NextRequest) {
  // SEC-FIX-02: Fail-Closed — CRON_SECRET must be configured; reject all if missing
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[ReconcilePricesCron] FATAL: CRON_SECRET is not configured. Rejecting all requests.');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  // Timing-safe Bearer authorization
  const authHeader = req.headers.get('authorization') || '';
  const expectedAuth = `Bearer ${cronSecret}`;

  const isAuthorized =
    authHeader.length === expectedAuth.length &&
    crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedAuth));

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const redis = getRedisConnection();
  const lockKey = 'cron:price-reconciler:lock';
  const lockToken = crypto.randomUUID();

  // Acquire distributed lock for 5 minutes (300s) with owner token
  const acquired = await redis.set(lockKey, lockToken, 'EX', 300, 'NX');
  if (!acquired) {
    return NextResponse.json({ success: false, reason: 'overlap_prevented' }, { status: 200 });
  }

  try {
    const job = await catalogQueue.add('reconcile-prices-job', {
      type: 'RECONCILE_PRICES',
    });

    const { auditAdmin } = await import('@/lib/admin-audit');
    auditAdmin({
      adminId: 'system-cron',
      adminEmail: 'cron@smmplan.pro',
      action: 'CRON_RECONCILE_PRICES_QUEUED',
      target: 'catalogQueue',
      targetType: 'SYSTEM_CRON',
      newValue: { jobId: job.id },
    });

    return NextResponse.json({
      success: true,
      queued: true,
      jobId: job.id,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  } finally {
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end`;
      await (redis as any).eval(script, 1, lockKey, lockToken);
    } catch (err) {
      console.error('[Cron Reconcile] Lock release error:', err);
    }
  }
}
