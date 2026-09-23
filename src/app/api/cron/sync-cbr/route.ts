export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { CBRRateService } from '@/services/system/cbr-rate.service';
import { getRedisConnection } from '@/lib/queue-manager';
import { catalogQueue } from '@/lib/queue-manager';
import { db } from '@/lib/db';

/**
 * T-007: Cron endpoint to sync CBR Exchange Rate.
 * Triggered by external cron job (e.g., Vercel Cron, GitHub Actions, or local crontab).
 */
export async function GET(req: NextRequest) {
  // SEC-FIX-02: Fail-Closed — CRON_SECRET must be configured; reject all if missing
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[SyncCBRCron] FATAL: CRON_SECRET is not configured. Rejecting all requests.');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  // Basic security: require CRON_SECRET token (timing-safe)
  const authHeader = req.headers.get('authorization') || '';
  const expectedAuth = `Bearer ${cronSecret}`;

  const crypto = await import('crypto');
  const isAuthorized =
    authHeader.length === expectedAuth.length &&
    crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedAuth));

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { SettingsProvider } = await import('@/lib/settings');
    // Check if the system is in manual mode (i.e. exchangeRateUpdatedAt is null, and rate is not 0)
    const settings = await SettingsProvider.getDirect();
    if (settings && settings.exchangeRateUpdatedAt === null && settings.exchangeRateUSD !== 0) {
      console.info('[SyncCBRCron] Skipped. System is in manual exchange rate mode.');
      return NextResponse.json({ success: false, reason: 'manual_mode_prevented' }, { status: 200 });
    }

    const redis = getRedisConnection();
    const lockKey = 'cron:sync-cbr:lock';
    
    // Acquire lock for 2 hours (CBR syncs infrequently, no need to overlap)
    const acquired = await redis.set(lockKey, '1', 'EX', 7200, 'NX');
    if (!acquired) {
      console.warn('[SyncCBRCron] Skipped. Another CBR sync process is already running.');
      return NextResponse.json({ success: false, reason: 'overlap_prevented' }, { status: 200 });
    }
    
    let result;
    try {
      result = await CBRRateService.syncCBRExchangeRate();
      
      // 🌊 WAVE 1.4: Background Sync Fix
      // If the rate was updated successfully, trigger the background price denormalization
      if (result.updated && result.systemRate) {
         await catalogQueue.add('sync-prices-bg', { 
            type: 'SYNC_PRICES', 
            usdToRub: result.systemRate 
         });
      }
    } finally {
      await redis.del(lockKey);
    }
    
    return NextResponse.json({
      success: true,
      nominalRate: result.nominalRate,
      systemRateWithSpread: result.systemRate,
      updated: result.updated,
      message: result.updated 
        ? `Exchange rate updated successfully. Built-in 3% spread applied.` 
        : `Exchange rate unchanged (CBR API issue or rate already current).`
    });
  } catch (error: unknown) {
    console.error('[Cron] CBR Sync API error:', (error instanceof Error ? error.message : String(error)));
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
