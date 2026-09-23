import { NextResponse } from 'next/server';
import { PreLaunchService } from '@/services/marketing/prelaunch-service';
import { RateLimitService } from '@/services/core/rate-limit.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email : '';
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId : 'smmplan';
    const source = typeof body.source === 'string' ? body.source : 'holding_page';
    const honeypot = body.company_fax_id || body.website_url_hp || body.hp_field;

    // 1. Bot Honeypot Trapping (N-3.3): if bot filled hidden field, return silent 200
    if (honeypot && typeof honeypot === 'string' && honeypot.trim() !== '') {
      return NextResponse.json({
        success: true,
        message: 'Спасибо! Вы успешно подписаны на обновления.'
      });
    }

    const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
    const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

    // 2. IP-based Rate Limiter (Max 5 requests per hour per tenant contour)
    const isAllowed = await RateLimitService.checkCustomKey(`prelaunch:subscribe:${tenantId}:${ip}`, 5, 3600, true);
    if (!isAllowed) {
      return NextResponse.json(
        { success: false, error: 'Слишком много попыток подписки с вашего IP-адреса. Пожалуйста, попробуйте позже.' },
        { 
          status: 429,
          headers: { 'Retry-After': '3600' }
        }
      );
    }

    const result = await PreLaunchService.subscribe({
      email,
      tenantId,
      source,
      ip
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message
    });
  } catch (error: any) {
    console.error('[API PreLaunch Subscribe] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Произошла непредвиденная ошибка. Попробуйте позже.' },
      { status: 500 }
    );
  }
}
