'use server';

import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';
import { applyBeautifulRounding } from '@/lib/financial-constants';
import { SettingsProvider } from '@/lib/settings';

export type DriftCandidate = {
  id: string;
  numericId: number;
  name: string;
  providerId: string | null;
  providerName: string | null;
  providerCurrency: string;
  oldRate: number;
  currentRate: number;
  driftPercent: number;
  actualMarkup: number;
  configuredMarkup: number;
  historicalDate: Date;
};

/**
 * Retrieves services that have experienced price drift between 5% and 19.99%
 * over the last 30 days.
 */
export async function getDriftCandidatesAction(): Promise<{ success: true; data: DriftCandidate[] } | { success: false; error: string }> {
  return requireStaffPermission('catalog', 'view', async (admin) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const tenantFilter = admin.tenantId ? { tenantId: admin.tenantId } : {};

    const services = await db.service.findMany({
      where: {
        isActive: true,
        isQuarantined: false,
        providerId: { not: null },
        rate: { gt: 0 },
        ...tenantFilter
      },
      select: {
        id: true,
        numericId: true,
        name: true,
        rate: true,
        markup: true,
        pricePer1000Cents: true,
        providerId: true,
        providerCurrency: true,
        provider: { select: { name: true } }
      }
    });

    let usdToRub = 95.0;
    try {
      usdToRub = await SettingsProvider.getExchangeRateUSD();
      if (!usdToRub || usdToRub <= 0) {
        return { success: false, error: 'Некорректный курс валют' };
      }
    } catch {
      return { success: false, error: 'Не удалось получить актуальный курс валют' };
    }
    const candidates: DriftCandidate[] = [];

    for (const s of services) {
      let history = await db.servicePriceHistory.findFirst({
        where: {
          serviceId: s.id,
          createdAt: { gte: thirtyDaysAgo }
        },
        orderBy: { createdAt: 'asc' }
      });

      if (!history) {
        history = await db.servicePriceHistory.findFirst({
          where: {
            serviceId: s.id,
            createdAt: { lt: thirtyDaysAgo }
          },
          orderBy: { createdAt: 'desc' }
        });
      }

      if (!history || history.rate === 0) continue;

      const historicalRate = history.rate;
      const currentRate = s.rate;

      if (currentRate > historicalRate) {
        const driftPercent = (currentRate - historicalRate) / historicalRate;
        
        if (driftPercent >= 0.05 && driftPercent < 0.20) {
          const exchangeRate = s.providerCurrency === 'RUB' ? 1.0 : usdToRub;
          const newCostCents = currentRate * exchangeRate * 100;
          const actualMarkup = newCostCents > 0 ? (s.pricePer1000Cents / newCostCents) : s.markup;

          candidates.push({
            id: s.id,
            numericId: s.numericId,
            name: s.name,
            providerId: s.providerId,
            providerName: s.provider?.name || 'Unknown',
            providerCurrency: s.providerCurrency,
            oldRate: historicalRate,
            currentRate: currentRate,
            driftPercent,
            actualMarkup,
            configuredMarkup: s.markup,
            historicalDate: history.createdAt
          });
        }
      }
    }

    candidates.sort((a, b) => b.driftPercent - a.driftPercent);
    return { success: true, data: candidates };
  });
}

/**
 * Retrieves the full price history for a specific service.
 */
export async function getServicePriceHistoryAction(serviceId: string) {
  return requireStaffPermission('catalog', 'view', async () => {
    const history = await db.servicePriceHistory.findMany({
      where: { serviceId },
      orderBy: { createdAt: 'asc' }
    });

    return { 
      success: true, 
      data: history.map(h => ({
        date: h.createdAt.toISOString(),
        rate: h.rate
      }))
    };
  });
}

/**
 * Compensates for margin erosion by updating the selling price
 * based on the current rate and the original configured markup.
 */
export async function compensateServiceMarginAction(serviceId: string) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const service = await db.service.findUnique({
      where: { id: serviceId }
    });

    if (!service) return { success: false, error: 'Service not found' };

    const usdToRub = await SettingsProvider.getExchangeRateUSD();
    const exchangeRate = service.providerCurrency === 'RUB' ? 1.0 : usdToRub;

    const newPriceCents = Math.round(applyBeautifulRounding(service.rate * service.markup * exchangeRate) * 100);

    if (newPriceCents === service.pricePer1000Cents) {
      return { success: true, message: 'Цена уже соответствует марже' };
    }

    await db.service.update({
      where: { id: serviceId },
      data: {
        pricePer1000Cents: newPriceCents
      }
    });

    const { auditAdminAwaitable } = await import('@/lib/admin-audit');
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'COMPENSATE_MARGIN_DRIFT',
      target: serviceId,
      targetType: 'SERVICE',
      oldValue: { priceCents: service.pricePer1000Cents },
      newValue: { priceCents: newPriceCents }
    });

    return { success: true, message: 'Наценка успешно компенсирована' };
  });
}
