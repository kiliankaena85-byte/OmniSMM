import { NextRequest, NextResponse } from 'next/server';
import { resolveStorefrontContext } from '@/lib/storefront/storefront-auth';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { db } from '@/lib/db';
import { runWithTenant } from '@/lib/tenant-context';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await resolveStorefrontContext(req);
    
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const orderId = params.id;
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Order ID is required' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const rateLimitKey = `sf_orders_status_${ctx.tenantId}_${ip}`;
    const rateLimitInfo = await RateLimitService.checkCustomKeyDetail(rateLimitKey, 120, 60);

    const headers = new Headers();
    headers.set('RateLimit-Limit', rateLimitInfo.limit.toString());
    headers.set('RateLimit-Remaining', rateLimitInfo.remaining.toString());
    headers.set('RateLimit-Reset', rateLimitInfo.resetSeconds.toString());

    if (rateLimitInfo.remaining < 0) {
      return NextResponse.json({ success: false, error: 'Too Many Requests' }, { status: 429, headers });
    }

    const url = new URL(req.url);
    const email = url.searchParams.get('email');

    if (ctx.keyType === 'publishable' && !email) {
      return NextResponse.json({ success: false, error: 'Email query parameter is required for publishable keys' }, { status: 403, headers });
    }

    return await runWithTenant(ctx.tenantSlug, async () => {
      // Ищем заказ с привязкой к тенанту (гарантируется Tenant Enforcer)
      const order = await db.order.findUnique({
        where: { id: orderId },
        include: { service: true, user: true }
      });

      if (!order) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404, headers });
      }

      // Проверка email, если запросили по публичному ключу
      if (ctx.keyType === 'publishable' && order.user.email.toLowerCase() !== email?.toLowerCase()) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404, headers });
      }

      return NextResponse.json({
        success: true,
        data: {
          orderId: order.id,
          numericId: order.numericId,
          status: order.status,
          serviceName: order.service.name,
          link: order.link,
          quantity: order.quantity,
          remains: order.remains,
          startCount: order.startCount,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
        }
      }, { status: 200, headers });
    });
  } catch (error: any) {
    console.error('[Storefront API Get Order Error]', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
