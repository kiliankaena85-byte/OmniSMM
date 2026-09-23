import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { auditAdmin } from '@/lib/admin-audit';
import { SettingsProvider } from '@/lib/settings';
import { SAFETY_FLOOR_MARKUP, applyPricingLadder } from '@/lib/financial-constants';
import { inferTargetTypeFromCategory } from '@/utils/target-type';
import { buildCurrencySnapshot } from '@/lib/pricing/currency-invariant';
import { applyAntiNegativeMargin } from '@/lib/pricing/anti-negative-margin';
import { PriceDriftCircuitBreaker, DEFAULT_DRIFT_CONFIG } from '@/lib/pricing/drift-circuit-breaker';
import { ServiceAuditEngine } from '../audit-engine';
import { sanitizeServiceDescription } from '@/lib/sanitize';
import { getUnifiedLinkSpecification } from '@/services/link-engine/link-rules-registry';
import {
  parseProviderBoolean,
  ensureTaxonomyTenantAccess,
  inferCanonicalActivityType,
  formatFullServiceName
} from './catalog-taxonomy.service';
import { runCatalogImportPreflight } from './catalog-import-preflight';
import { resolveImportCategory, type CategoryResolutionContext } from './catalog-import-category-resolver';

export type ImportSkipReason =
  | 'ALREADY_EXISTS'
  | 'REMOVED_BY_PROVIDER'
  | 'INVALID_RATE'
  | 'NOT_IN_SHADOW_CATALOG'
  | 'CURRENCY_CONVERSION_FAILED'
  | 'PRICE_DRIFT_BLOCKED'
  | 'INVALID_MIN_MAX'
  | 'UNKNOWN_PLATFORM';

export type ImportSkippedItem = {
  externalId: string;
  name: string | null;
  reason: ImportSkipReason;
  tenantIds?: string[];
};

export type ImportMarkupAdjustment = {
  externalId: string;
  name: string | null;
  requestedMarkup: number;
  appliedMarkup: number;
  tenantId?: string;
};

export type ImportServicesResult = {
  importedCount: number;
  totalRequested: number;
  skipped: ImportSkippedItem[];
  markupAdjustments: ImportMarkupAdjustment[];
  usedLivePrices: boolean;
  shadowCatalogAgeHours: number | null;
  warnings: string[];
};

export type LiveCatalogEntry = {
  service: string;
  name: string;
  rate: string;
  min: string;
  max: string;
  dripfeed?: boolean;
  refill?: boolean;
  cancel?: boolean;
  desc?: string;
};

export class CatalogImportService {
  /**
   * Imports services from the Shadow Catalog into the curated production Service table.
   * Performs live price checks against the provider API to prevent cache poisoning.
   * Falls back to shadow catalog if the provider API is down.
   */
  static async importServices(
    externalIds: string[],
    categoryId: string,
    defaultMarkup: number,
    admin: { id: string; email: string },
    providerId: string,
    categoryIdMap?: Record<string, string>,
    targetTenantId: string = 'smmplan'
  ): Promise<ImportServicesResult> {
    const preflight = await runCatalogImportPreflight(providerId, externalIds);
    const { providerDbRecord, shadowServices, liveMap, skipped, warnings, usedLivePrices, shadowCatalogAgeHours } = preflight;

    let tenantsToImport: string[];
    if (targetTenantId === 'both' || targetTenantId === 'all') {
      try {
        const activeTenants = await db.tenant.findMany({
          where: { isActive: true },
          select: { slug: true }
        });
        tenantsToImport = activeTenants.length > 0 ? activeTenants.map(t => t.slug) : ['smmplan', 'flux'];
      } catch {
        tenantsToImport = ['smmplan', 'flux'];
      }
    } else {
      tenantsToImport = [targetTenantId];
    }

    const existingServices = await db.service.findMany({
      where: {
        providerId: providerDbRecord.id,
        externalId: { in: shadowServices.map(s => s.externalId) },
        tenantId: { in: tenantsToImport }
      },
      select: { externalId: true, tenantId: true }
    });
    const existingSet = new Set(existingServices.map(s => `${s.tenantId}:${s.externalId}`));

    const takenSlugRows = await db.service.findMany({
      where: { tenantId: { in: tenantsToImport }, slug: { not: null } },
      select: { tenantId: true, slug: true },
    });
    const takenSlugs = new Set(takenSlugRows.map(s => `${s.tenantId}:${s.slug}`));

    const uniqueCategoryIds = new Set<string>();
    if (categoryId) uniqueCategoryIds.add(categoryId);
    if (categoryIdMap) {
      Object.values(categoryIdMap).forEach(id => uniqueCategoryIds.add(id));
    }

    const categoriesDb = await db.category.findMany({
      where: {
        id: { in: Array.from(uniqueCategoryIds) },
        tenantId: { in: [...tenantsToImport, 'all'] }
      },
      select: { 
        id: true, 
        name: true, 
        activityType: true,
        networkId: true,
        network: { select: { id: true, name: true, slug: true } }
      }
    });

    const categoryNameMap = new Map(categoriesDb.map(c => [c.id, c.name]));
    const categoryActivityTypeMap = new Map(categoriesDb.map(c => [c.id, c.activityType]));
    const categoryNetworkMap = new Map(categoriesDb.map(c => [c.id, c.network]));

    const networksDb = await db.network.findMany({
      select: { id: true, name: true, slug: true }
    });
    const networkBySlug = new Map(networksDb.map(n => [n.slug.toLowerCase(), n]));
    if (networkBySlug.has('vk') && !networkBySlug.has('vkontakte')) {
      networkBySlug.set('vkontakte', networkBySlug.get('vk')!);
    } else if (networkBySlug.has('vkontakte') && !networkBySlug.has('vk')) {
      networkBySlug.set('vk', networkBySlug.get('vkontakte')!);
    }

    for (const catId of Array.from(uniqueCategoryIds)) {
      const changed = await ensureTaxonomyTenantAccess(catId);
      if (changed) {
        warnings.push(
          `Категория «${changed.categoryName}» стала общей (tenantId=all): импорт направлен в другой тенант, и категория была открыта для обоих брендов.`
        );
      }
    }

    const fallbackCategoryRecord = categoryId
      ? await db.category.findUnique({
          where: { id: categoryId },
          select: { activityType: true, networkId: true, tenantId: true, network: { select: { id: true, name: true, slug: true } } }
        })
      : null;

    const resolutionCtx: CategoryResolutionContext = {
      categoryIdMap,
      categoryActivityTypeMap,
      categoryNameMap,
      categoryNetworkMap,
      networkBySlug,
      fallbackCategoryRecord,
      autoCreatedCategoryCache: new Map<string, string>()
    };

    const servicesToCreate = [];
    const markupAdjustments: ImportMarkupAdjustment[] = [];

    for (const shadowExt of shadowServices) {
      const extId = shadowExt.externalId;

      const liveExt = liveMap.get(extId);
      if (!liveExt) {
        skipped.push({ externalId: extId, name: shadowExt.cleanName || shadowExt.name, reason: 'REMOVED_BY_PROVIDER' });
        continue;
      }

      const rawRate = parseFloat(liveExt.rate);
      if (isNaN(rawRate) || rawRate <= 0) {
        skipped.push({ externalId: extId, name: shadowExt.cleanName || shadowExt.name, reason: 'INVALID_RATE' });
        continue;
      }

      const providerCurrency = providerDbRecord.balanceCurrency || 'USD';
      let snapshot;
      try {
        snapshot = await buildCurrencySnapshot(rawRate, providerCurrency);
      } catch {
        skipped.push({ externalId: extId, name: shadowExt.cleanName || shadowExt.name, reason: 'CURRENCY_CONVERSION_FAILED' });
        continue;
      }

      const driftCheck = await PriceDriftCircuitBreaker.validate(
        providerDbRecord.id,
        extId,
        snapshot.costPer1kRub,
        DEFAULT_DRIFT_CONFIG,
        rawRate,
        providerCurrency
      );
      if (!driftCheck.ok && driftCheck.severity === 'BLOCK') {
        skipped.push({ externalId: extId, name: shadowExt.cleanName || shadowExt.name, reason: 'PRICE_DRIFT_BLOCKED' });
        warnings.push(`Услуга ${extId} заблокирована предохранителем дрейфа цен: ${driftCheck.reason}`);
        continue;
      }

      const rawMin = parseInt(String(liveExt.min), 10);
      const rawMax = parseInt(String(liveExt.max), 10);
      const minQty = isNaN(rawMin) || rawMin <= 0 ? 10 : rawMin;
      const maxQty = isNaN(rawMax) || rawMax < minQty ? Math.max(minQty * 10, 10000) : rawMax;

      const isExplicitlyMapped = Boolean(categoryIdMap?.[extId]);
      const servicePlatform = (shadowExt.platform || '').toLowerCase().trim();
      if (!isExplicitlyMapped && (!servicePlatform || servicePlatform === 'other' || servicePlatform === 'unknown')) {
        skipped.push({ 
          externalId: extId, 
          name: shadowExt.cleanName || shadowExt.name, 
          reason: 'UNKNOWN_PLATFORM' 
        });
        warnings.push(`Услуга ${extId} («${shadowExt.name}») отклонена: не определена социальная сеть. Авто-импорт без подтверждённой платформы запрещён.`);
        continue;
      }

      const importedName = shadowExt.cleanName || liveExt.name;
      const importedDesc = liveExt.desc || null;
      const baseSlug = importedName.toLowerCase().trim().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-+|-+$/g, '') || `service-${extId}`;

      const skippedTenants: string[] = [];

      for (const tId of tenantsToImport) {
        if (existingSet.has(`${tId}:${extId}`)) {
          skippedTenants.push(tId);
          continue;
        }

        const tenantSettings = await SettingsProvider.get(tId);
        const tenantFloor = Math.max(SAFETY_FLOOR_MARKUP, tenantSettings?.globalMarkup || 3.0);

        let effectiveMarkup = defaultMarkup;
        if (defaultMarkup <= 0) {
          const retailFromLadder = applyPricingLadder(snapshot.costPer1kRub);
          effectiveMarkup = snapshot.costPer1kRub > 0 ? Math.round((retailFromLadder / snapshot.costPer1kRub) * 100) / 100 : 3.0;
        }

        if (effectiveMarkup < tenantFloor) {
          markupAdjustments.push({
            externalId: extId,
            name: shadowExt.cleanName || shadowExt.name,
            requestedMarkup: effectiveMarkup,
            appliedMarkup: tenantFloor,
            tenantId: tId,
          });
          effectiveMarkup = tenantFloor;
        }

        const rawRetailRub = snapshot.costPer1kRub * effectiveMarkup;
        const marginGuard = applyAntiNegativeMargin(snapshot.costPer1kRub, rawRetailRub, 5);

        let stableSlug = baseSlug;
        if (takenSlugs.has(`${tId}:${stableSlug}`)) {
          stableSlug = `${baseSlug}-${extId}`;
          let n = 2;
          while (takenSlugs.has(`${tId}:${stableSlug}`)) {
            stableSlug = `${baseSlug}-${extId}-${n}`;
            n++;
            if (n > 50) {
              stableSlug = `${baseSlug}-${Date.now()}`;
              break;
            }
          }
        }
        takenSlugs.add(`${tId}:${stableSlug}`);

        const { resolvedCategoryId, effectiveServiceNetwork } = await resolveImportCategory(
          extId,
          shadowExt,
          categoryId,
          tId,
          resolutionCtx
        );

        const resolvedCategoryName = categoryNameMap.get(resolvedCategoryId) || fallbackCategoryRecord?.network?.name || '';
        const resolvedNetworkName = categoryNetworkMap.get(resolvedCategoryId)?.name || (effectiveServiceNetwork as { name?: string } | null)?.name || fallbackCategoryRecord?.network?.name || shadowExt.platform || '';
        const serviceCanonicalType = inferCanonicalActivityType(shadowExt.normalizedCategory, shadowExt.cleanName || shadowExt.name || '', shadowExt.targetType || undefined);
        
        let effectiveTargetType = shadowExt.targetType;
        if (serviceCanonicalType === 'SUBSCRIBERS') {
          effectiveTargetType = 'CHANNEL';
        } else if (!effectiveTargetType) {
          effectiveTargetType = inferTargetTypeFromCategory(resolvedCategoryName || shadowExt.normalizedCategory || '');
        }

        const linkSpec = getUnifiedLinkSpecification(
          shadowExt.platform || fallbackCategoryRecord?.network?.slug || '',
          effectiveTargetType,
          shadowExt.normalizedCategory || fallbackCategoryRecord?.activityType || ''
        );

        servicesToCreate.push({
          tenantId: tId,
          slug: stableSlug,
          name: formatFullServiceName(importedName, resolvedCategoryName, resolvedNetworkName),
          description: importedDesc ? sanitizeServiceDescription(ServiceAuditEngine.cleanText(importedDesc)) : null,
          externalId: extId,
          categoryId: resolvedCategoryId,
          providerId: providerDbRecord.id,
          providerCurrency: snapshot.currency,
          costPer1kRub: snapshot.costPer1kRub,
          currencyCapturedAt: snapshot.capturedAt,
          usdRateAtCapture: snapshot.usdRateAtCapture,
          rate: snapshot.rawRate,
          markup: effectiveMarkup,
          pricePer1000Cents: marginGuard.finalRetailPer1kCents,
          minQty,
          maxQty,
          features: {
            platform: shadowExt.platform,
            category: shadowExt.normalizedCategory,
            targetType: effectiveTargetType,
            customDataType: linkSpec.customDataType || shadowExt.customDataType || 'NONE',
            isMediaGroupAware: linkSpec.isMediaGroupAware ?? shadowExt.isMediaGroupAware ?? false,
            isPrivate: shadowExt.isPrivate,
            warranty: shadowExt.warranty,
            geo: shadowExt.geo,
            velocity: shadowExt.velocity,
            anomalyScore: shadowExt.anomalyScore
          },
          anomalyScore: shadowExt.anomalyScore || 0,
          targetType: effectiveTargetType,
          linkPlaceholder: linkSpec.placeholder,
          linkHint: linkSpec.hint,
          linkValidatorRegex: linkSpec.regex,
          clientRequirement: linkSpec.clientRequirement || (shadowExt.isPrivate ? 'Требуется доступ к объекту' : 'Объект продвижения должен быть открытым'),
          requiresBotAdmin: linkSpec.requiresBotAdmin || false,
          customDataType: linkSpec.customDataType || shadowExt.customDataType || 'NONE',
          customDataLabel: linkSpec.customDataLabel || null,
          isMediaGroupAware: linkSpec.isMediaGroupAware ?? shadowExt.isMediaGroupAware ?? false,
          isActive: true,
          isDripFeedEnabled: parseProviderBoolean(liveExt.dripfeed),
          isRefillEnabled: parseProviderBoolean(liveExt.refill),
          isCancelEnabled: parseProviderBoolean(liveExt.cancel),
          lastSeenAt: new Date(),
        });
      }

      if (skippedTenants.length > 0) {
        skipped.push({
          externalId: extId,
          name: shadowExt.cleanName || shadowExt.name,
          reason: 'ALREADY_EXISTS',
          tenantIds: skippedTenants,
        });
      }
    }

    let importedCount = 0;
    if (servicesToCreate.length > 0) {
      const result = await db.service.createMany({
        data: servicesToCreate,
        skipDuplicates: true
      });
      importedCount = result.count;

      if (result.count < servicesToCreate.length) {
        warnings.push(
          `${servicesToCreate.length - result.count} услуг пропущено на уровне БД (уникальные ограничения). Проверьте каталог после импорта.`
        );
      }

      const createdServices = await db.service.findMany({
        where: {
          providerId: providerDbRecord.id,
          externalId: { in: servicesToCreate.map(s => s.externalId) },
          tenantId: { in: tenantsToImport }
        },
        select: { id: true, rate: true }
      });
      if (createdServices.length > 0) {
        await db.servicePriceHistory.createMany({
          data: createdServices.map(cs => ({
            serviceId: cs.id,
            rate: cs.rate
          }))
        });
      }
    }

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SERVICES_IMPORT',
      target: categoryId,
      targetType: 'SERVICE',
      newValue: {
        importedCount,
        totalRequested: externalIds.length,
        skippedCount: skipped.length,
        markupAdjustedCount: markupAdjustments.length,
        usedLivePrices,
        providerId,
      },
    });

    logger.info(`[ImportReport] imported=${importedCount}/${externalIds.length} skipped=${skipped.length} markupAdjusted=${markupAdjustments.length} livePrices=${usedLivePrices}`, {
      providerId,
      skipReasons: skipped.reduce<Record<string, number>>((acc, s) => {
        acc[s.reason] = (acc[s.reason] || 0) + 1;
        return acc;
      }, {}),
    });

    return {
      importedCount,
      totalRequested: externalIds.length,
      skipped,
      markupAdjustments,
      usedLivePrices,
      shadowCatalogAgeHours,
      warnings,
    };
  }
}
