export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';

export async function GET() {
  try {
    const session = await verifySession();
    if (!session || !session.role || !['OWNER', 'ADMIN', 'SUPPORT'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || token === 'dummy_token') {
      return NextResponse.json({
        success: false,
        error: 'TELEGRAM_BOT_TOKEN не задан в переменных окружения (.env)'
      });
    }

    const startTime = Date.now();
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
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
        error: data.description || 'Не удалось связаться с Telegram Bot API'
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg });
  }
}
