import { NextRequest, NextResponse } from 'next/server';
import { resolveStorefrontContext } from '@/lib/storefront/storefront-auth';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { checkoutAction } from '@/actions/order/checkout';
import { db } from '@/lib/db';
import { runWithTenant } from '@/lib/tenant-context';

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveStorefrontContext(req);
    
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (ctx.keyType !== 'secret') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Secret key required for orders' },
        { status: 403 }
      );
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const rateLimitKey = `sf_orders_${ctx.tenantId}_${ip}`;
    // Жесткий лимит на заказы - 30 в минуту
    const rateLimitInfo = await RateLimitService.checkCustomKeyDetail(rateLimitKey, 30, 60);

    const headers = new Headers();
    headers.set('RateLimit-Limit', rateLimitInfo.limit.toString());
    headers.set('RateLimit-Remaining', rateLimitInfo.remaining.toString());
    headers.set('RateLimit-Reset', rateLimitInfo.resetSeconds.toString());

    if (!rateLimitInfo.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too Many Requests' },
        { status: 429, headers }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400, headers });
    }

    // Скоупинг заказа к тенанту
    return await runWithTenant(ctx.tenantSlug, async () => {
      // Делегируем логику оформления (вкл. ExactMath и Drip-Feed floor) в существующий checkoutAction
      const result = await checkoutAction({
        serviceId: body.serviceId,
        link: body.link,
        quantity: body.quantity,
        email: body.email,
        promoCodeStr: body.promoCode,
        runs: body.runs,
        interval: body.interval,
        idempotencyKey: body.idempotencyKey,
        tenantId: ctx.tenantId, // Явно прокидываем tenantId
      });

      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error || 'Failed to create order',
        }, { status: 400, headers });
      }

      const orderData = result.data as any;

      // Маппинг ответа (Zero Vendor Leaks)
      const service = await db.service.findUnique({
        where: { id: body.serviceId },
        select: { name: true }
      });

      return NextResponse.json({
        success: true,
        data: {
          orderId: orderData.orderId,
          numericId: orderData.numericId,
          status: 'PENDING',
          serviceName: service?.name || 'Unknown',
          link: body.link,
          quantity: body.quantity,
          totalRub: orderData.totalKopecks ? Number(orderData.totalKopecks) / 100 : 0,
          paymentRequired: !!orderData.paymentUrl,
          paymentUrl: orderData.paymentUrl || null,
          createdAt: new Date().toISOString(),
        }
      }, { status: 201, headers });
    });
  } catch (error: any) {
    console.error('[Storefront API Create Order Error]', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
