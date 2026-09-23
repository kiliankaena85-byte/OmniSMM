export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { VaultService } from '@/lib/vault';
import { normalizeTenantId } from '@/lib/tenant-resolver-edge';
import { getTelegramDispatcher } from '@/lib/telegram-agent';

const ALLOWED_TELEGRAM_HOSTS = ['api.telegram.org'];

export async function GET(req: NextRequest) {
  try {
    const session = await verifySession();
    if (!session || !session.role || !['OWNER', 'ADMIN', 'SUPPORT'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tenantParam = searchParams.get('tenant');
    const headerTenant = req.headers.get('x-tenant-id');
    const activeTenantId = normalizeTenantId(tenantParam) || normalizeTenantId(headerTenant) || 'smmplan';

    // Check if a direct token was provided in the query for instant live testing before save
    const queryToken = searchParams.get('token')?.trim();
    let token: string | null = null;

    if (queryToken && !queryToken.includes('•••') && queryToken.length > 10) {
      token = queryToken;
    } else {
      // Look up encrypted token from database SystemSettings
      try {
        const settings = await db.systemSettings.findUnique({
          where: { id: activeTenantId },
          select: { telegramBotToken: true },
        });
        if (settings?.telegramBotToken) {
          const decrypted = VaultService.decrypt(settings.telegramBotToken);
          if (decrypted && decrypted.trim().length > 10) {
            token = decrypted.trim();
          }
        }
      } catch (vaultErr) {
        console.warn('[TestTelegramBot] Vault decrypt error:', vaultErr);
      }

      // Fallback to environment variable if tenant is smmplan
      if (!token && activeTenantId === 'smmplan') {
        const envToken = process.env.TELEGRAM_BOT_TOKEN;
        if (envToken && envToken !== 'dummy_token' && envToken !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
          token = envToken.trim();
        }
      }
    }

    if (!token || token === 'dummy_token' || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
      return NextResponse.json({
        success: false,
        error: `Токен Telegram-бота для бренда ${activeTenantId === 'flux' ? 'SMMflux' : 'SMMplan'} не задан. Вставьте токен от @BotFather и сохраните настройки.`
      });
    }

    const targetUrl = `https://api.telegram.org/bot${token}/getMe`;
    const parsedUrl = new URL(targetUrl);
    if (!ALLOWED_TELEGRAM_HOSTS.includes(parsedUrl.hostname)) {
      return NextResponse.json({ success: false, error: 'SSRF protection: Invalid host' }, { status: 400 });
    }

    const dispatcher = getTelegramDispatcher();
    const startTime = Date.now();
    
    const fetchOptions: RequestInit = {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    };
    if (dispatcher) {
      (fetchOptions as Record<string, unknown>).dispatcher = dispatcher;
    }

    // audit-ignore: timeout is enforced via fetchOptions.signal = AbortSignal.timeout(8000) above
    const res = await fetch(targetUrl, fetchOptions);
    const pingMs = Date.now() - startTime;
    const data = await res.json();

    if (data.ok && data.result) {
      return NextResponse.json({
        success: true,
        bot: data.result,
        pingMs,
        username: data.result.username,
        name: data.result.first_name,
        botId: data.result.id,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: data.description || 'Не удалось связаться с Telegram Bot API. Проверьте правильность токена.'
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg });
  }
}
