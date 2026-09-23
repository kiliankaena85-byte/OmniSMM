'use server';

import { revalidatePath, revalidateTag } from "next/cache";
import { requireStaffPermission } from "@/lib/server/rbac";
import { adminCatalogService } from "@/services/admin/catalog.service";
import type { ImportServicesResult } from "@/services/admin/catalog.service";
import { db } from "@/lib/db";
import { handleServerError } from "@/utils/error-handler";
import { z } from 'zod';
import { Prisma } from '@prisma/client';

export interface ImportCherryPickFilters {
    category?: string;
    providerCategory?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    importStatus?: string;
    platform?: string;
    geo?: string;
    velocity?: string;
    hasRefill?: boolean;
    hasAnomaly?: boolean;
    retailReady?: boolean;
    hideImported?: boolean;
    minPrice?: string | number;
    maxPrice?: string | number;
    activityType?: string;
}

// --- Pagination & Filtering API ---
export async function fetchPaginatedExternalServices(
    providerId: string,
    filters: ImportCherryPickFilters,
    page: number,
    pageSize: number
) {
    return requireStaffPermission('catalog', 'view', async (_user, _role, tenantId) => {
        try {
            const activeTenantId = tenantId || 'smmplan';
            const shadowCount = await db.shadowService.count({ where: { providerId } });
            if (shadowCount === 0) {
                return { success: false, error: 'Теневой каталог пуст. Нажмите «Загрузить каталог».', emptyCache: true };
            }

            // 0. Currency & Rate Settings
            const [provider, settings] = await Promise.all([
                db.provider.findUnique({ where: { id: providerId }, select: { balanceCurrency: true } }),
                db.systemSettings.findUnique({ where: { id: activeTenantId }, select: { exchangeRateUSD: true } })
            ]);
            const currency = provider?.balanceCurrency || 'USD';
            const usdRate = settings?.exchangeRateUSD || 90.0;

            // 1. Fetch imported map for "alreadyImported" status
            const existingServices = await db.service.findMany({
                where: { providerId, externalId: { not: null }, tenantId: activeTenantId },
                select: { id: true, externalId: true }
            });
            const existingMap = new Map(existingServices.map((s: {id: string; externalId: string | null}) => [s.externalId!, s.id]));
            const importedExternalIds = existingServices.map(s => s.externalId).filter(Boolean) as string[];

            // 2. Build where conditions
            const andConditions: Prisma.ShadowServiceWhereInput[] = [{ providerId }];

            if (filters.category && filters.category !== 'ALL') {
                andConditions.push({ normalizedCategory: filters.category });
            }
            if (filters.providerCategory && filters.providerCategory !== 'ALL') {
                if (filters.providerCategory === 'Без категории') {
                    andConditions.push({
                        OR: [
                            { category: null },
                            { category: '' },
                            { category: 'Без категории' }
                        ]
                    });
                } else {
                    andConditions.push({ category: filters.providerCategory });
                }
            }
            if (filters.geo && filters.geo !== 'ALL') {
                andConditions.push({ geo: filters.geo });
            }
            if (filters.velocity && filters.velocity !== 'ALL') {
                if (filters.velocity === 'FAST') {
                    andConditions.push({ velocity: { gte: 50 } });
                } else if (filters.velocity === 'SLOW') {
                    andConditions.push({ velocity: { lte: 10 } });
                } else {
                    andConditions.push({ velocity: { gt: 10, lt: 50 } });
                }
            }
            if (filters.hasRefill) {
                andConditions.push({
                    OR: [
                        { refill: true },
                        { warranty: { gt: 0 } }
                    ]
                });
            }
            if (filters.hasAnomaly) {
                andConditions.push({ anomalyScore: { gt: 0 } });
            }
            if (filters.retailReady) {
                andConditions.push({ min: { gt: 0, lte: 100 } });
            }
            if (filters.minPrice !== undefined && filters.minPrice !== '') {
                const minP = typeof filters.minPrice === 'number' ? filters.minPrice : parseFloat(filters.minPrice);
                if (!isNaN(minP)) {
                    andConditions.push({ rateRub: { gte: minP } });
                }
            }
            if (filters.maxPrice !== undefined && filters.maxPrice !== '') {
                const maxP = typeof filters.maxPrice === 'number' ? filters.maxPrice : parseFloat(filters.maxPrice);
                if (!isNaN(maxP)) {
                    andConditions.push({ rateRub: { lte: maxP } });
                }
            }
            if (filters.search) {
                const q = filters.search.toLowerCase().trim();
                const terms = q.split(/\s+/).filter(Boolean);
                for (const term of terms) {
                    andConditions.push({
                        OR: [
                            { name: { contains: term, mode: 'insensitive' } },
                            { category: { contains: term, mode: 'insensitive' } },
                            { externalId: { contains: term, mode: 'insensitive' } }
                        ]
                    });
                }
            }

            const importStatus = filters.importStatus || (filters.hideImported ? 'NOT_IMPORTED' : 'ALL');
            if (importStatus === 'NOT_IMPORTED') {
                if (importedExternalIds.length > 0) {
                    andConditions.push({ externalId: { notIn: importedExternalIds } });
                }
            } else if (importStatus === 'IMPORTED') {
                andConditions.push({ externalId: { in: importedExternalIds } });
            }

            const whereWithoutPlatform: Prisma.ShadowServiceWhereInput = { AND: andConditions };

            // 3. Platform counts based on whereWithoutPlatform
            const platformGroups = await db.shadowService.groupBy({
                by: ['platform'],
                where: whereWithoutPlatform,
                _count: {
                    id: true
                }
            });

            let telegram = 0;
            let instagram = 0;
            let vk = 0;
            let youtube = 0;
            let tiktok = 0;
            let other = 0;
            let totalCount = 0;

            for (const g of platformGroups) {
                const count = g._count.id;
                totalCount += count;
                const p = (g.platform || '').toLowerCase();
                if (p === 'telegram') telegram = count;
                else if (p === 'instagram') instagram = count;
                else if (p === 'vk') vk = count;
                else if (p === 'youtube') youtube = count;
                else if (p === 'tiktok') tiktok = count;
                else other += count;
            }

            const platformCounts = {
                ALL: totalCount,
                telegram,
                instagram,
                vk,
                youtube,
                tiktok,
                other
            };

            // 4. Platform filter apply
            let finalWhere: Prisma.ShadowServiceWhereInput = { ...whereWithoutPlatform };
            if (filters.platform && filters.platform !== 'ALL') {
                if (filters.platform === 'other') {
                    finalWhere = {
                        AND: [
                            ...andConditions,
                            {
                                platform: {
                                    notIn: ['telegram', 'instagram', 'vk', 'youtube', 'tiktok']
                                }
                            }
                        ]
                    };
                } else {
                    finalWhere = {
                        AND: [
                            ...andConditions,
                            {
                                platform: {
                                    equals: filters.platform.toLowerCase()
                                }
                            }
                        ]
                    };
                }
            }

            // 5. Unique provider categories query
            const categoryGroups = await db.shadowService.groupBy({
                by: ['category'],
                where: { providerId },
                _count: {
                    id: true
                }
            });

            const providerCategories = categoryGroups.map((g) => ({
                name: g.category || 'Без категории',
                count: g._count.id
            })).sort((a, b) => a.name.localeCompare(b.name));

            // 6. Sorting
            let orderBy: Prisma.ShadowServiceOrderByWithRelationInput = {};
            if (filters.sortBy === 'price_asc') {
                orderBy = { rateRub: 'asc' };
            } else if (filters.sortBy === 'price_desc') {
                orderBy = { rateRub: 'desc' };
            } else if (filters.sortBy === 'anomaly_asc') {
                orderBy = { anomalyScore: 'asc' };
            } else if (filters.sortBy === 'anomaly_desc' || filters.sortBy === 'anomaly') {
                orderBy = { anomalyScore: 'desc' };
            } else if (filters.sortBy === 'min_asc') {
                orderBy = { min: 'asc' };
            } else if (filters.sortBy === 'min_desc') {
                orderBy = { min: 'desc' };
            } else if (filters.sortBy === 'id_asc') {
                orderBy = { externalId: 'asc' };
            } else if (filters.sortBy === 'id_desc') {
                orderBy = { externalId: 'desc' };
            } else if (filters.sortBy === 'name_asc') {
                orderBy = { cleanName: 'asc' };
            } else if (filters.sortBy === 'name_desc') {
                orderBy = { cleanName: 'desc' };
            } else if (filters.sortBy === 'category_asc') {
                orderBy = { category: 'asc' };
            } else if (filters.sortBy === 'category_desc') {
                orderBy = { category: 'desc' };
            } else if (filters.sortBy === 'platform_asc') {
                orderBy = { platform: 'asc' };
            } else if (filters.sortBy === 'platform_desc') {
                orderBy = { platform: 'desc' };
            } else {
                orderBy = { id: 'asc' };
            }

            // 7. Paginated query
            const total = await db.shadowService.count({ where: finalWhere });
            const totalPages = Math.ceil(total / pageSize);
            const start = (page - 1) * pageSize;

            const paginated = await db.shadowService.findMany({
                where: finalWhere,
                orderBy,
                take: pageSize,
                skip: start
            });

            // 8. Map to match UI schema expectations
            const paginatedMapped = paginated.map((s) => {
                const rawRate = s.rate;
                const rateRub = s.rateRub;
                const pricePerUnitProcurementRub = rateRub / 1000;
                const pricePerUnitProcurementUsd = rawRate / 1000;

                return {
                    service: s.externalId,
                    name: s.name,
                    type: s.type || undefined,
                    category: s.category || undefined,
                    rate: s.rate,
                    min: String(s.min),
                    max: String(s.max),
                    refill: s.refill,
                    cancel: s.cancel,
                    dripfeed: s.dripfeed,
                    cleanName: s.cleanName,
                    rateRub,
                    pricePerUnitProcurementRub,
                    pricePerUnitProcurementUsd,
                    providerCurrency: currency,
                    usdRate,
                    alreadyImported: existingMap.has(s.externalId),
                    localServiceId: existingMap.get(s.externalId) || null,
                    metrics: {
                        platform: s.platform,
                        category: s.normalizedCategory,
                        targetType: s.targetType,
                        customDataType: s.customDataType,
                        isMediaGroupAware: s.isMediaGroupAware,
                        isPrivate: s.isPrivate,
                        warranty: s.warranty,
                        geo: s.geo,
                        velocity: s.velocity,
                        anomalyScore: s.anomalyScore
                    }
                };
            });

            return {
                success: true,
                data: paginatedMapped,
                platformCounts,
                providerCategories,
                pagination: {
                    total,
                    totalPages,
                    page,
                    pageSize
                }
            };
        } catch (e: unknown) {
            const localized = handleServerError(e);
            return { success: false, error: localized.message };
        }
    });
}

export async function fetchExternalServices(providerId?: string, forceRefresh = false) {
  return requireStaffPermission('catalog', 'view', async () => {
     let providerDbRecord;
     if (providerId) {
        providerDbRecord = await db.provider.findUnique({ where: { id: providerId } });
        if (!providerDbRecord) throw new Error("Provider not found");
     } else {
        providerDbRecord = await db.provider.findFirst({ where: { isActive: true } });
        if (!providerDbRecord) throw new Error("No active provider found");
     }

     const providerDbId = providerDbRecord.id;
     
     let shadowCount = 0;
     if (!forceRefresh) {
         shadowCount = await db.shadowService.count({ where: { providerId: providerDbId } });
     }

     if (shadowCount === 0 || forceRefresh) {
         shadowCount = await adminCatalogService.refreshShadowCatalog(providerDbId);
     }
     
     return {
        success: true,
        count: shadowCount,
        source: shadowCount > 0 && forceRefresh ? 'api' : 'cache',
        providerId: providerDbId,
     };
  });
}

const importServicesSchema = z.object({
  externalIds: z.array(z.string().min(1)).min(1, "Выберите хотя бы одну услугу"),
  categoryId: z.string().min(1, "Категория обязательна"),
  defaultMarkup: z.coerce.number().refine(val => val === 0 || (val >= 1.0 && val <= 10.0), {
    message: "Наценка должна быть 0 (автокалькуляция) или множителем от 1.0 (0%) до 10.0 (900%). В поле ввода указывается процент: 75% = 1.75"
  }),
  providerId: z.string().min(1, "ID провайдера обязателен"),
  categoryIdMap: z.record(z.string()).optional(),
  targetTenantId: z.string().default("smmplan"),
});

export type ImportSelectedServicesSuccess = {
  success: true;
  imported: number;
  /** AUD-04: full transparency report (skips, markup adjustments, price source) */
  report: ImportServicesResult;
};

export async function importSelectedServices(
  externalIds: string[], 
  categoryId: string, 
  defaultMarkup: number, 
  providerId: string,
  categoryIdMap?: Record<string, string>,
  targetTenantId: string = 'smmplan'
): Promise<ImportSelectedServicesSuccess | { success: false; error: string }> {
    return requireStaffPermission('catalog', 'edit', async (admin) => {
        try {
            const parsed = importServicesSchema.safeParse({ externalIds, categoryId, defaultMarkup, providerId, categoryIdMap, targetTenantId });
            if (!parsed.success) {
                return { success: false, error: 'Ошибка валидации: ' + parsed.error.errors.map(e => e.message).join(', ') };
            }

            const res = await adminCatalogService.importServices(
                parsed.data.externalIds,
                parsed.data.categoryId,
                parsed.data.defaultMarkup,
                admin,
                parsed.data.providerId,
                parsed.data.categoryIdMap,
                parsed.data.targetTenantId
            );
            
            // SDLC Gate 4: Обязательная инвалидация кэша после мутации
            // AUD-08: invalidate the real catalog admin route and public storefront cache tags
            revalidatePath('/admin/providers/import');
            revalidatePath('/admin/catalog');
            revalidateTag('catalog', 'default');
            revalidateTag('services', 'default');
            
            return { success: true, imported: res.importedCount, report: res };
        } catch (e: unknown) {
             const localized = handleServerError(e);
             return { success: false, error: localized.message };
        }
    });
}
