import {
  ensureCategoryForActivityType,
  inferCanonicalActivityType,
  detectTargetPlatform
} from './catalog-taxonomy.service';

export type CategoryResolutionContext = {
  categoryIdMap?: Record<string, string>;
  categoryActivityTypeMap: Map<string, string | null>;
  categoryNameMap: Map<string, string>;
  categoryNetworkMap: Map<string, { id: string; name: string; slug: string } | null>;
  networkBySlug: Map<string, { id: string; name: string; slug: string }>;
  fallbackCategoryRecord: {
    activityType: string | null;
    networkId: string | null;
    tenantId: string;
    network: { id: string; name: string; slug: string } | null;
  } | null;
  autoCreatedCategoryCache: Map<string, string>;
};

export async function resolveImportCategory(
  extId: string,
  shadowExt: {
    cleanName: string | null;
    name: string;
    normalizedCategory: string | null;
    targetType: string | null;
    platform: string | null;
  },
  defaultCategoryId: string,
  tenantId: string,
  ctx: CategoryResolutionContext
): Promise<{
  resolvedCategoryId: string;
  effectiveServiceNetwork: { id: string; name: string; slug: string } | null;
}> {
  // 1. PRIORITY 1: Explicit Operator Mapping (ручной выбор администратора — закон)
  const explicitId = ctx.categoryIdMap?.[extId];
  if (explicitId) {
    const directNetwork = ctx.categoryNetworkMap.get(explicitId);
    return {
      resolvedCategoryId: explicitId,
      effectiveServiceNetwork: directNetwork || null
    };
  }

  const normCat = shadowExt.normalizedCategory;
  const serviceCanonicalType = inferCanonicalActivityType(normCat, shadowExt.cleanName || shadowExt.name || '', shadowExt.targetType || undefined);

  const candidateCatId = defaultCategoryId;
  const candidateActivityType = ctx.categoryActivityTypeMap.get(candidateCatId) || ctx.fallbackCategoryRecord?.activityType || '';
  const candidateName = (ctx.categoryNameMap.get(candidateCatId) || '').toLowerCase();

  const detectedPlatformName = detectTargetPlatform(null, shadowExt.cleanName || shadowExt.name) || shadowExt.platform;
  const detectedServiceNetwork = detectedPlatformName ? ctx.networkBySlug.get(detectedPlatformName.toLowerCase()) : null;

  let targetNetwork = ctx.categoryNetworkMap.get(candidateCatId) 
    || ctx.fallbackCategoryRecord?.network 
    || ctx.networkBySlug.get((shadowExt.platform || '').toLowerCase());

  if (detectedServiceNetwork && targetNetwork && detectedServiceNetwork.id !== targetNetwork.id) {
    targetNetwork = detectedServiceNetwork;
  }
  const effectiveServiceNetwork = targetNetwork || null;

  let isContradiction = false;

  if (detectedServiceNetwork && targetNetwork && detectedServiceNetwork.id !== targetNetwork.id) {
    isContradiction = true;
    targetNetwork = detectedServiceNetwork;
  }

  if (serviceCanonicalType && targetNetwork) {
    if (serviceCanonicalType === 'SUBSCRIBERS') {
      if (candidateActivityType && candidateActivityType !== 'SUBSCRIBERS') isContradiction = true;
      else if (candidateName && (candidateName.includes('просмотр') || candidateName.includes('лайк') || candidateName.includes('коммент') || candidateName.includes('репост') || candidateName.includes('реакц'))) isContradiction = true;
    } else if (serviceCanonicalType === 'VIEWS' || serviceCanonicalType === 'AUTO_VIEWS') {
      if (candidateActivityType && !['VIEWS', 'AUTO_VIEWS', 'AUTO_SERVICES'].includes(candidateActivityType)) isContradiction = true;
      else if (candidateName && (candidateName.includes('подписч') || candidateName.includes('лайк') || candidateName.includes('коммент'))) isContradiction = true;
    } else if (serviceCanonicalType === 'STORIES') {
      if (candidateActivityType && candidateActivityType !== 'STORIES') isContradiction = true;
      else if (candidateName && ((candidateName.includes('просмотр') && !candidateName.includes('истори') && !candidateName.includes('сторис')) || candidateName.includes('подписч') || candidateName.includes('лайк'))) isContradiction = true;
    } else if (serviceCanonicalType === 'POLLS') {
      if (candidateActivityType && candidateActivityType !== 'POLLS') isContradiction = true;
      else if (candidateName && (candidateName.includes('просмотр') || candidateName.includes('подписч') || candidateName.includes('лайк'))) isContradiction = true;
    } else if (serviceCanonicalType === 'LIKES' || serviceCanonicalType === 'AUTO_LIKES') {
      if (candidateActivityType && !['LIKES', 'AUTO_LIKES', 'AUTO_SERVICES'].includes(candidateActivityType)) isContradiction = true;
      else if (candidateName && (candidateName.includes('подписч') || candidateName.includes('просмотр') || candidateName.includes('коммент'))) isContradiction = true;
    } else if (serviceCanonicalType === 'COMMENTS' || serviceCanonicalType === 'AUTO_COMMENTS') {
      if (candidateActivityType && !['COMMENTS', 'AUTO_COMMENTS'].includes(candidateActivityType)) isContradiction = true;
      else if (candidateName && (candidateName.includes('подписч') || candidateName.includes('просмотр') || candidateName.includes('лайк'))) isContradiction = true;
    } else if (serviceCanonicalType === 'REACTIONS' || serviceCanonicalType === 'AUTO_REACTIONS') {
      if (candidateActivityType && !['REACTIONS', 'AUTO_REACTIONS'].includes(candidateActivityType)) isContradiction = true;
      else if (candidateName && (candidateName.includes('просмотр') || candidateName.includes('подписч'))) isContradiction = true;
    } else if (serviceCanonicalType === 'BOOSTS') {
      if (candidateActivityType && candidateActivityType !== 'BOOSTS') isContradiction = true;
      else if (candidateName && (candidateName.includes('просмотр') || candidateName.includes('подписч') || candidateName.includes('лайк'))) isContradiction = true;
    } else if (serviceCanonicalType === 'REPOSTS') {
      if (candidateActivityType && candidateActivityType !== 'REPOSTS') isContradiction = true;
    } else if (serviceCanonicalType === 'STREAMS') {
      if (candidateActivityType && candidateActivityType !== 'STREAMS') isContradiction = true;
      else if (candidateName && (candidateName.includes('подписч') || candidateName.includes('просмотр') || candidateName.includes('лайк'))) isContradiction = true;
    } else if (serviceCanonicalType === 'STARS') {
      if (candidateActivityType && candidateActivityType !== 'STARS') isContradiction = true;
    }
  }

  if (isContradiction && serviceCanonicalType && targetNetwork) {
    const cacheKey = `${targetNetwork.id}_${serviceCanonicalType}_${tenantId}`;
    if (!ctx.autoCreatedCategoryCache.has(cacheKey)) {
      const autoId = await ensureCategoryForActivityType(
        targetNetwork.id,
        targetNetwork.name,
        targetNetwork.slug,
        serviceCanonicalType,
        ctx.fallbackCategoryRecord?.tenantId || tenantId
      );
      ctx.autoCreatedCategoryCache.set(cacheKey, autoId);
    }
    return {
      resolvedCategoryId: ctx.autoCreatedCategoryCache.get(cacheKey)!,
      effectiveServiceNetwork
    };
  }

  if (
    serviceCanonicalType &&
    serviceCanonicalType !== 'OTHER' &&
    targetNetwork &&
    serviceCanonicalType !== ctx.fallbackCategoryRecord?.activityType
  ) {
    const cacheKey = `${targetNetwork.id}_${serviceCanonicalType}_${tenantId}`;
    if (!ctx.autoCreatedCategoryCache.has(cacheKey)) {
      const autoId = await ensureCategoryForActivityType(
        targetNetwork.id,
        targetNetwork.name,
        targetNetwork.slug,
        serviceCanonicalType,
        ctx.fallbackCategoryRecord?.tenantId || tenantId
      );
      ctx.autoCreatedCategoryCache.set(cacheKey, autoId);
    }
    return {
      resolvedCategoryId: ctx.autoCreatedCategoryCache.get(cacheKey)!,
      effectiveServiceNetwork
    };
  }

  return {
    resolvedCategoryId: defaultCategoryId,
    effectiveServiceNetwork
  };
}
