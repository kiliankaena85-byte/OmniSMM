import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';
import { revalidateTag } from 'next/cache';
import { db } from '@/lib/db';
import { SettingsProvider } from '@/lib/settings';

export async function GET(req: NextRequest) {
  // SD-04 SECURITY FIX: Completely disable in production and require ENABLE_DEV_ROUTES.
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEV_ROUTES !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const revalidate = searchParams.get('revalidate');
  
  if (revalidate) {
        revalidateTag(revalidate, "default");
    return NextResponse.json({ success: true, revalidated: revalidate });
  }

  const syncPrices = searchParams.get('syncPrices');
  if (syncPrices) {
    const usdToRub = parseFloat(syncPrices);
    if (!isNaN(usdToRub)) {
      const { adminCatalogService } = await import('@/services/admin/catalog.service');
      await adminCatalogService.syncDenormalizedPrices(usdToRub);
      return NextResponse.json({ success: true, syncedWithRate: usdToRub });
    }
  }

  // DEV ONLY: Test Telegram support reply delivery
  const testTelegram = searchParams.get('testTelegram');
  if (testTelegram) {
    const { supportBotService } = await import('@/services/support/support-bot.service');
    const tokenSet = !!process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'dummy_token';
    let tgResult: string | null = null;
    let tgError: string | null = null;
    try {
      tgResult = await supportBotService.sendSupportReply(
        testTelegram,
        '🔧 Debug test from Next.js process: ' + new Date().toISOString()
      );
    } catch (e: unknown) {
      tgError = e instanceof Error ? e.message : String(e);
    }
    return NextResponse.json({ tokenSet, tgResult, tgError });
  }

  return NextResponse.json({
    authenticated: true,
    userRole: user.role,
    tenantId: user.tenantId,
    verifiedSessionId: session.userId
  });
}
