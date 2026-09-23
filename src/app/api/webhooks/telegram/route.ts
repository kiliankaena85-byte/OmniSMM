import { NextRequest, NextResponse } from 'next/server';
import { bot } from '@/bot';
import { db } from '@/lib/db';
import { logTelegramError } from '@/actions/admin/telegram-bot';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const settings = await db.systemSettings.findFirst({
      select: {
        telegramWebhookSecret: true,
        telegramAllowedIps: true,
        telegramMaintenanceMode: true,
      },
    });

    if (settings?.telegramMaintenanceMode) {
      return NextResponse.json({ ok: false, error: 'Maintenance mode' }, { status: 503 });
    }

    // OWASP A07: Secret token verification (via .env or encrypted SystemSettings)
    let expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (settings?.telegramWebhookSecret) {
      try {
        const { VaultService } = await import('@/lib/vault');
        expectedSecret = VaultService.decrypt(settings.telegramWebhookSecret);
      } catch { /* ignore decrypt error */ }
    }

    // SEC-FIX-04: Fail-Closed — if no secret configured at all, reject all requests
    if (!expectedSecret) {
      console.error('[TelegramWebhook] FATAL: TELEGRAM_WEBHOOK_SECRET is not configured. Rejecting all requests to prevent unauthenticated bot control.');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const providedToken = req.headers.get('x-telegram-bot-api-secret-token');

    // P1-14 FIX: Use timingSafeEqual to prevent timing attacks (all other webhooks already do this)
    if (!providedToken) {
      console.warn('[Telegram Webhook] Unauthorized request: missing secret token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { timingSafeEqual } = await import('crypto');
    const expected = Buffer.from(expectedSecret, 'utf8');
    const provided = Buffer.from(providedToken, 'utf8');
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      console.warn('[Telegram Webhook] Unauthorized request: secret token mismatch');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // OWASP A07: IP Allowlist check if configured
    if (settings?.telegramAllowedIps) {
      try {
        const allowedIps: string[] = JSON.parse(settings.telegramAllowedIps);
        if (allowedIps.length > 0) {
          const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip');
          if (clientIp && !allowedIps.includes(clientIp)) {
            console.warn(`[Telegram Webhook] Forbidden request: IP ${clientIp} not in allowlist`);
            return NextResponse.json({ error: 'Forbidden IP' }, { status: 403 });
          }
        }
      } catch { /* ignore parsing errors */ }
    }

    const body = await req.json();
    await bot.handleUpdate(body);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Telegram Webhook] Error processing update:', error);

    await logTelegramError({
      level: 'ERROR',
      source: 'webhook',
      errorMessage: errorMsg,
      stackTrace: error instanceof Error ? error.stack?.slice(0, 1000) : undefined,
    }).catch(() => {});

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'telegram-webhook' });
}

