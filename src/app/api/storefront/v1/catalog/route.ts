import { NextRequest, NextResponse } from 'next/server';
import { resolveStorefrontContext } from '@/lib/storefront/storefront-auth';
import { getServicesByCategoryAction } from '@/actions/order/catalog';
import { db } from '@/lib/db';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { runWithTenant } from '@/lib/tenant-context';

export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveStorefrontContext(req);
    
    if (!ctx) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Rate Limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const rateLimitKey = `sf_ratelimit_${ctx.tenantId}_${ip}`;
    const rateLimitInfo = await RateLimitService.checkCustomKeyDetail(rateLimitKey, ctx.rateLimit, 60);

    const headers = new Headers();
    headers.set('RateLimit-Limit', rateLimitInfo.limit.toString());
    headers.set('RateLimit-Remaining', rateLimitInfo.remaining.toString());
    headers.set('RateLimit-Reset', rateLimitInfo.resetSeconds.toString());

    if (rateLimitInfo.remaining < 0) {
      return NextResponse.json(
        { success: false, error: 'Too Many Requests' },
        { status: 429, headers }
      );
    }

    // Скоупинг запроса к БД (BOLA Immunity)
    return await runWithTenant(ctx.tenantSlug, async () => {
      // Ищем все категории тенанта
      const categories = await db.category.findMany({
        orderBy: { sort: 'asc' },
        include: { network: true },
      });

      const url = new URL(req.url);
      const filterCategory = url.searchParams.get('category');
      const filterTargetType = url.searchParams.get('targetType');

      const resultCategories = [];

      for (const cat of categories) {
        if (filterCategory && cat.slug !== filterCategory) continue;

        const services = await getServicesByCategoryAction(cat.id, ctx.tenantId);
        
        let filteredServices = services;
        if (filterTargetType) {
          filteredServices = filteredServices.filter(s => s.targetType === filterTargetType);
        }

        if (filteredServices.length > 0) {
          resultCategories.push({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            icon: cat.icon || cat.network?.icon || 'globe',
            network: cat.network?.name || 'OTHER',
            services: filteredServices.map(s => ({
              id: s.id,
              name: s.name,
              description: s.description,
              minQuantity: s.minQty,
              maxQuantity: s.maxQty,
              pricePerUnitRub: s.pricePerUnitRub,
              pricePer1000Rub: s.pricePer1kRub,
              dripFeedSupported: s.isDripFeedEnabled,
              targetType: s.targetType || 'POST',
              speed: s.speedDisplay || s.speed,
              startTime: s.startTime,
              qualityLabel: s.qualityLabel,
              warrantyDays: s.warrantyDays,
              badge: s.badge
            })),
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: { categories: resultCategories }
      }, { status: 200, headers });
    });
  } catch (error: any) {
    console.error('[Storefront API Catalog Error]', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
