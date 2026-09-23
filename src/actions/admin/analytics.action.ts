'use server';

import { db } from '@/lib/db'
import { analyticsService } from '@/services/admin/analytics.service'
import { requireStaffPermission } from '@/lib/server/rbac'

export async function getFunnelAnalyticsAction(days: number) {
  return requireStaffPermission('orders', 'view', async () => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    const { SettingsProvider } = await import('@/lib/settings')
    const tenantId = await SettingsProvider.getTenantId()

    const [
      linkPasted,
      serviceSelected,
      checkoutInitiated,
      paymentClicked,
      serviceProfitability,
      categoryProfitability,
      ltv
    ] = await Promise.all([
      db.analyticsEvent.count({
        where: {
          event: { in: ['LINK_PASTED', 'link_pasted', 'page_view', 'order_started'] },
          createdAt: { gte: cutoff },
        },
      }),
      db.analyticsEvent.count({
        where: {
          event: { in: ['SERVICE_SELECTED', 'service_selected'] },
          createdAt: { gte: cutoff },
        },
      }),
      db.analyticsEvent.count({
        where: {
          event: { in: ['CHECKOUT_INITIATED', 'checkout_initiated'] },
          createdAt: { gte: cutoff },
        },
      }),
      db.analyticsEvent.count({
        where: {
          event: { in: ['PAYMENT_CLICKED', 'payment_clicked', 'payment_initiated', 'order_completed'] },
          createdAt: { gte: cutoff },
        },
      }),
      analyticsService.getServiceProfitability(days, tenantId),
      analyticsService.getCategoryProfitability(days, tenantId),
      analyticsService.getLTVAnalytics(tenantId),
    ]);

    // Optional: Top 5 Services by Clicks (for funnel)
    const topServicesRaw = await db.$queryRaw<{ name: string; clicks: number }[]>`
      SELECT COALESCE("metadata"->>'serviceName', "metadata"->>'service_name', 'Услуга') as name, COUNT(*)::int as clicks
      FROM "AnalyticsEvent"
      WHERE event IN ('SERVICE_SELECTED', 'service_selected') AND "createdAt" >= ${cutoff}
      GROUP BY COALESCE("metadata"->>'serviceName', "metadata"->>'service_name', 'Услуга')
      ORDER BY clicks DESC
      LIMIT 5
    `;

    const topServices = topServicesRaw.map(row => ({
      name: row.name,
      clicks: Number(row.clicks)
    }))

    return {
      funnel: {
        linkPasted,
        serviceSelected,
        checkoutInitiated,
        paymentClicked
      },
      topServices,
      profitability: {
        services: serviceProfitability,
        categories: categoryProfitability
      },
      ltv
    }
  })
}

export async function getAiFunnelAnalysisAction(days: number, forceRefresh: boolean = false) {
  return requireStaffPermission('orders', 'view', async () => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    const { SettingsProvider } = await import('@/lib/settings')
    const tenantId = await SettingsProvider.getTenantId()

    const [
      linkPasted,
      serviceSelected,
      checkoutInitiated,
      paymentClicked
    ] = await Promise.all([
      db.analyticsEvent.count({
        where: {
          event: { in: ['LINK_PASTED', 'link_pasted', 'page_view', 'order_started'] },
          createdAt: { gte: cutoff },
        },
      }),
      db.analyticsEvent.count({
        where: {
          event: { in: ['SERVICE_SELECTED', 'service_selected'] },
          createdAt: { gte: cutoff },
        },
      }),
      db.analyticsEvent.count({
        where: {
          event: { in: ['CHECKOUT_INITIATED', 'checkout_initiated'] },
          createdAt: { gte: cutoff },
        },
      }),
      db.analyticsEvent.count({
        where: {
          event: { in: ['PAYMENT_CLICKED', 'payment_clicked', 'payment_initiated', 'order_completed'] },
          createdAt: { gte: cutoff },
        },
      }),
    ]);

    const topServicesRaw = await db.$queryRaw<{ name: string; clicks: number }[]>`
      SELECT COALESCE("metadata"->>'serviceName', "metadata"->>'service_name', 'Услуга') as name, COUNT(*)::int as clicks
      FROM "AnalyticsEvent"
      WHERE event IN ('SERVICE_SELECTED', 'service_selected') AND "createdAt" >= ${cutoff}
      GROUP BY COALESCE("metadata"->>'serviceName', "metadata"->>'service_name', 'Услуга')
      ORDER BY clicks DESC
      LIMIT 5
    `;

    const topServices = topServicesRaw.map(row => ({
      name: row.name,
      clicks: Number(row.clicks)
    }));

    const { AiFunnelAnalystService } = await import('@/services/analytics/ai-funnel-analyst.service')
    return AiFunnelAnalystService.analyzeFunnel({
      linkPasted,
      serviceSelected,
      checkoutInitiated,
      paymentClicked,
      periodDays: days,
      tenantId,
      topServices
    }, forceRefresh);
  });
}
