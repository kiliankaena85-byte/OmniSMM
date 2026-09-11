import { NextResponse } from 'next/server';
import { getBaseUrlAsync } from '@/utils/get-base-url';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { SettingsProvider } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const tenantId = await SettingsProvider.getTenantId();

  const contactSettings = await SettingsProvider.getContactAndLegalSettings();
  let botUsername = contactSettings.TELEGRAM_SUPPORT_BOT;
  if (tenantId === 'flux') {
    botUsername = process.env.FLUX_TELEGRAM_BOT || 'SMMplansapport_bot';
  } else if (!botUsername || botUsername === 'smmplan_support_bot') {
    botUsername = process.env.TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_SUPPORT_BOT || 'SMMplansapport_bot';
  }

  if (!botUsername) {
    console.error('[TelegramSupport] botUsername not resolved or configured');
    const appUrl = await getBaseUrlAsync();
    return NextResponse.redirect(`${appUrl}/dashboard`);
  }

  const baseUrl = `https://t.me/${botUsername}`;
  
  try {
    const session = await verifySession();
    const { searchParams } = new URL(req.url);
    const forceAuth = searchParams.get('forceAuth') === 'true';
    
    // Если пользователь не авторизован
    if (!session || !session.userId) {
      if (forceAuth) {
        // Требуем обязательной авторизации (Level 2 Protocol)
        const host = await getBaseUrlAsync();
        const callbackUrl = encodeURIComponent('/api/support/telegram?forceAuth=true');
        return NextResponse.redirect(`${host}/auth?callbackUrl=${callbackUrl}`);
      }
      // Обычный переход с лендинга
      return NextResponse.redirect(`${baseUrl}?start=support`);
    }

    // Если авторизован, генерируем одноразовый токен для привязки (Smart Bind Protocol Level 1)
    const tokenStr = `tg_bind_${crypto.randomBytes(16).toString('hex')}`;
    
    await db.authToken.create({
      data: {
        token: tokenStr,
        userId: session.userId,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 минут
      }
    });

    return NextResponse.redirect(`${baseUrl}?start=${tokenStr}`);
  } catch (error) {
    console.error('[TelegramSupportRedirect] Error:', error);
    // В случае ошибки БД всё равно отдаем базовую ссылку
    return NextResponse.redirect(`${baseUrl}?start=support`);
  }
}
