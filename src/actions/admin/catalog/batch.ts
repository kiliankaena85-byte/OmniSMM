'use server';

/**
 * Server Actions: Batch catalog operations
 *
 * batchToggleServicesAction — bulk enable/disable
 * batchSetMarkupAction — set fixed markup for a selection
 *
 * Security: requireAdmin guard on all actions.
 * All changes recorded in AdminAuditLog (awaited for financial integrity).
 */

import { requireStaffPermission } from '@/lib/server/rbac';
import { db } from '@/lib/db';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { auditAdmin, auditAdminAwaitable } from '@/lib/admin-audit';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { applyBeautifulRounding, applyPricingLadder, SAFETY_FLOOR_MARKUP, UPPER_SANITY_LIMIT_RUB } from '@/lib/financial-constants';
import { getCostRub } from '@/lib/pricing/currency-invariant';
import { applyAntiNegativeMargin } from '@/lib/pricing/anti-negative-margin';
import { SettingsProvider } from '@/lib/settings';

const MIN_MARKUP = 1.0;

const batchIdsSchema = z.array(z.string().min(1)).min(1).max(200);
const markupSchema = z.number().min(MIN_MARKUP).max(150);

/** Bulk toggle isActive for a list of service IDs */
export async function batchToggleServicesAction(
  serviceIds: string[],
  isActive: boolean
) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    const ids = batchIdsSchema.safeParse(serviceIds);
    if (!ids.success) {
      return { success: false as const, error: 'Invalid service IDs' };
    }

    await db.service.updateMany({
      where: {
        id: { in: ids.data },
        ...(admin.tenantId ? { tenantId: admin.tenantId } : {})
      },
      data: { isActive },
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'BATCH_SERVICE_ENABLE' as const,
      target: ids.data.join(','),
      targetType: 'SERVICE',
      newValue: { count: ids.data.length, isActive },
    });

    revalidatePath('/admin/catalog');
    revalidatePath('/services', 'layout');
    revalidateTag('catalog', 'default');
    revalidateTag('services', 'default');
    revalidateTag('catalog-smmplan', 'default');
    revalidateTag('catalog-flux', 'default');
    revalidateTag('services-smmplan', 'default');
    revalidateTag('services-flux', 'default');
    return { success: true as const, count: ids.data.length };
  });
}

/** Bulk set fixed markup for a list of service IDs */
export async function batchSetMarkupAction(
  serviceIds: string[],
  markup: number
) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const ids = batchIdsSchema.safeParse(serviceIds);
    if (!ids.success) {
      return { success: false as const, error: 'Invalid service IDs' };
    }

    const markupValidation = markupSchema.safeParse(markup);
    if (!markupValidation.success) {
      return {
        success: false as const,
        error: `Минимальная маржа ${MIN_MARKUP.toFixed(2)}x (Safety Floor)`,
      };
    }

    const m = markupValidation.data;
    const usdToRub = await SettingsProvider.getExchangeRateUSD();

    // We can't use updateMany with calculated fields in Prisma easily,
    // so we iterate or use a raw query. For 500 items, iteration is safe.
    const services = await db.service.findMany({
      where: {
        id: { in: ids.data },
        ...(admin.tenantId ? { tenantId: admin.tenantId } : {})
      },
      select: { id: true, name: true, rate: true, providerCurrency: true }
    });

    const updates = services.map(s => {
      const costRub = getCostRub(s.rate, s.providerCurrency || 'RUB', usdToRub);
      const rawRetailRub = applyBeautifulRounding(costRub * m);
      const antiLoss = applyAntiNegativeMargin(costRub, rawRetailRub);

      if (antiLoss.finalRetailPer1kRub > UPPER_SANITY_LIMIT_RUB) {
        throw new Error(`Услуга "${s.name}" превышает верхний лимит ${UPPER_SANITY_LIMIT_RUB.toLocaleString('ru-RU')} ₽ (расчетная цена: ${antiLoss.finalRetailPer1kRub.toFixed(2)} ₽)`);
      }

      return db.service.update({
        where: { id: s.id },
        data: { 
          markup: m,
          costPer1kRub: costRub,
          pricePer1000Cents: antiLoss.finalRetailPer1kCents
        }
      });
    });

    await db.$transaction(updates);

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'BATCH_MARKUP_SET',
      target: ids.data.join(','),
      targetType: 'SERVICE',
      newValue: { count: ids.data.length, markup: m },
    });

    revalidatePath('/admin/catalog');
    revalidatePath('/services', 'layout');
    revalidateTag('catalog', 'default');
    revalidateTag('services', 'default');
    revalidateTag('catalog-smmplan', 'default');
    revalidateTag('catalog-flux', 'default');
    revalidateTag('services-smmplan', 'default');
    revalidateTag('services-flux', 'default');
    return { success: true as const, count: ids.data.length };
  });
}

/** Preview price changes before applying batch markup */
export async function previewBatchMarkupAction(
  serviceIds: string[],
  newMarkup: number
) {
  return requireStaffPermission('catalog', 'view', async (admin) => {
    const ids = batchIdsSchema.safeParse(serviceIds);
    if (!ids.success) return { success: false as const, error: 'Invalid service IDs' };

    const markupValidation = markupSchema.safeParse(newMarkup);
    if (!markupValidation.success) {
      return { success: false as const, error: `Минимальная маржа ${MIN_MARKUP.toFixed(2)}x` };
    }

    const m = markupValidation.data;
    const usdToRub = await SettingsProvider.getExchangeRateUSD();

    const services = await db.service.findMany({
      where: {
        id: { in: ids.data },
        ...(admin.tenantId ? { tenantId: admin.tenantId } : {})
      },
      select: { id: true, name: true, rate: true, markup: true, pricePer1000Cents: true, providerCurrency: true },
      take: 10
    });

    const samples = services.map(s => {
      const oldPriceRub = s.pricePer1000Cents / 100;
      const rateRub = getCostRub(s.rate, s.providerCurrency || 'RUB', usdToRub);
      const newPriceRub = applyBeautifulRounding(rateRub * m);
      return {
        id: s.id,
        name: s.name,
        oldMarkup: s.markup,
        newMarkup: m,
        oldPriceRub,
        newPriceRub,
        diffPercent: Math.round(((newPriceRub - oldPriceRub) / (oldPriceRub || 1)) * 100)
      };
    });

    return { success: true as const, samples, totalCount: ids.data.length };
  });
}

/** Update single service markup (inline edit) */
export async function updateServiceMarkupAction(
  serviceId: string,
  markup: number
) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const markupValidation = markupSchema.safeParse(markup);
    if (!markupValidation.success) {
      return {
        success: false as const,
        error: `Минимальная маржа ${MIN_MARKUP.toFixed(2)}x`,
      };
    }

    const m = markupValidation.data;
    const usdToRub = await SettingsProvider.getExchangeRateUSD();

    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: { markup: true, rate: true, providerCurrency: true, name: true },
    });

    if (!service) return { success: false as const, error: 'Service not found' };

    const costRub = getCostRub(service.rate, service.providerCurrency || 'RUB', usdToRub);
    const rawRetailRub = applyBeautifulRounding(costRub * m);
    const antiLoss = applyAntiNegativeMargin(costRub, rawRetailRub);

    if (antiLoss.finalRetailPer1kRub > UPPER_SANITY_LIMIT_RUB) {
      return {
        success: false as const,
        error: `Превышен верхний лимит цены ${UPPER_SANITY_LIMIT_RUB.toLocaleString('ru-RU')} ₽ (расчетная: ${antiLoss.finalRetailPer1kRub.toFixed(2)} ₽)`,
      };
    }

    await db.service.update({
      where: { id: serviceId },
      data: { 
        markup: m,
        costPer1kRub: costRub,
        pricePer1000Cents: antiLoss.finalRetailPer1kCents
      },
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SERVICE_MARKUP_UPDATE',
      target: serviceId,
      targetType: 'SERVICE',
      oldValue: { markup: service.markup },
      newValue: { markup: m },
    });

    revalidatePath('/admin/catalog');
    revalidatePath('/services', 'layout');
    revalidateTag('catalog', 'default');
    revalidateTag('services', 'default');
    revalidateTag('catalog-smmplan', 'default');
    revalidateTag('catalog-flux', 'default');
    revalidateTag('services-smmplan', 'default');
    revalidateTag('services-flux', 'default');
    return { success: true as const };
  });
}

/** Toggle single service active status */
export async function toggleServiceActiveAction(
  serviceId: string,
  isActive: boolean
) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    await db.service.update({
      where: { id: serviceId },
      data: { isActive },
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: isActive ? 'SERVICE_ENABLE' : 'SERVICE_DISABLE',
      target: serviceId,
      targetType: 'SERVICE',
      newValue: { isActive },
    });

    revalidatePath('/admin/catalog');
    revalidatePath('/services', 'layout');
    revalidateTag('catalog', 'default');
    revalidateTag('services', 'default');
    revalidateTag('catalog-smmplan', 'default');
    revalidateTag('catalog-flux', 'default');
    revalidateTag('services-smmplan', 'default');
    revalidateTag('services-flux', 'default');
    return { success: true as const };
  });
}

/** Bulk reassign services to a target category */
export async function batchReassignServicesCategoryAction(
  serviceIds: string[],
  targetCategoryId: string
) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    const ids = batchIdsSchema.safeParse(serviceIds);
    if (!ids.success) {
      return { success: false as const, error: 'Invalid service IDs' };
    }

    if (!targetCategoryId || typeof targetCategoryId !== 'string') {
      return { success: false as const, error: 'Invalid target category ID' };
    }

    // Verify target category exists
    const targetCategory = await db.category.findUnique({
      where: { id: targetCategoryId },
    });
    if (!targetCategory) {
      return { success: false as const, error: 'Target category not found' };
    }

    // Update all matching services inside db query
    const updateResult = await db.service.updateMany({
      where: {
        id: { in: ids.data },
        ...(admin.tenantId ? { tenantId: admin.tenantId } : {})
      },
      data: { categoryId: targetCategoryId },
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'BATCH_SERVICE_REASSIGN',
      target: ids.data.join(','),
      targetType: 'SERVICE',
      newValue: { count: updateResult.count, targetCategoryId },
    });

    revalidatePath('/admin/catalog');
    revalidatePath('/services', 'layout');
    revalidateTag('catalog', 'default');
    revalidateTag('services', 'default');
    revalidateTag('catalog-smmplan', 'default');
    revalidateTag('catalog-flux', 'default');
    revalidateTag('services-smmplan', 'default');
    revalidateTag('services-flux', 'default');
    return { success: true as const, count: updateResult.count };
  });
}

/** Bulk reset markup of selected services based on the pricing ladder */
export async function batchResetMarkupAction(
  serviceIds: string[]
) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const ids = batchIdsSchema.safeParse(serviceIds);
    if (!ids.success) {
      return { success: false as const, error: 'Invalid service IDs' };
    }

    const usdToRub = await SettingsProvider.getExchangeRateUSD();

    const services = await db.service.findMany({
      where: {
        id: { in: ids.data },
        ...(admin.tenantId ? { tenantId: admin.tenantId } : {})
      },
      select: { id: true, name: true, rate: true, providerCurrency: true }
    });

    const updates = services.map(s => {
      const costRub = getCostRub(s.rate, s.providerCurrency || 'RUB', usdToRub);
      const retailFromLadder = applyPricingLadder(costRub);
      let calculatedMarkup = costRub > 0 ? Math.round((retailFromLadder / costRub) * 100) / 100 : SAFETY_FLOOR_MARKUP;
      
      // Safety Floor Check
      if (calculatedMarkup < SAFETY_FLOOR_MARKUP) {
        calculatedMarkup = SAFETY_FLOOR_MARKUP;
      }

      const rawRetailRub = applyBeautifulRounding(costRub * calculatedMarkup);
      const antiLoss = applyAntiNegativeMargin(costRub, rawRetailRub);

      if (antiLoss.finalRetailPer1kRub > UPPER_SANITY_LIMIT_RUB) {
        throw new Error(`Услуга "${s.name}" превышает верхний лимит ${UPPER_SANITY_LIMIT_RUB.toLocaleString('ru-RU')} ₽`);
      }

      return db.service.update({
        where: { id: s.id },
        data: { 
          markup: calculatedMarkup,
          costPer1kRub: costRub,
          pricePer1000Cents: antiLoss.finalRetailPer1kCents
        }
      });
    });

    await db.$transaction(updates);

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'BATCH_MARKUP_RESET',
      target: ids.data.join(','),
      targetType: 'SERVICE',
      newValue: { count: ids.data.length },
    });

    revalidatePath('/admin/catalog');
    revalidatePath('/services', 'layout');
    revalidateTag('catalog', 'default');
    revalidateTag('services', 'default');
    revalidateTag('catalog-smmplan', 'default');
    revalidateTag('catalog-flux', 'default');
    revalidateTag('services-smmplan', 'default');
    revalidateTag('services-flux', 'default');
    return { success: true as const, count: ids.data.length };
  });
}

