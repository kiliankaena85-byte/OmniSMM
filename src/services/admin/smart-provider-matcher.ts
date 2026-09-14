import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';
import { getUnifiedLinkSpecification } from '@/services/link-engine/link-rules-registry';

export interface ShadowServiceSearchResult {
  id: string;
  providerId: string;
  providerName: string;
  externalId: string;
  name: string;
  cleanName: string | null;
  category: string | null;
  normalizedCategory: string | null;
  rate: number;
  rateRub: number;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  dripfeed: boolean;
  targetType: string;
  customDataType: string;
  isMediaGroupAware: boolean;
  warranty: number;
  anomalyScore: number;
}

export interface LinkSpecification {
  targetType: string;
  placeholder: string;
  hint: string;
  regex?: string;
  requiresBotAdmin: boolean;
  isMediaGroupAware: boolean;
  customDataType: string;
  customDataLabel?: string;
}

/**
 * @deprecated Use `getUnifiedLinkSpecification` from `@/services/link-engine/link-rules-registry` directly.
 * Kept for full backward compatibility across legacy actions and components.
 */
export function getLinkSpecification(
  targetType: string,
  networkSlug: string = 'telegram',
  activityType: string = 'OTHER'
): LinkSpecification {
  const unified = getUnifiedLinkSpecification(networkSlug, targetType, activityType);
  return {
    targetType: unified.targetType,
    placeholder: unified.placeholder,
    hint: unified.hint,
    regex: unified.regex,
    requiresBotAdmin: unified.requiresBotAdmin,
    isMediaGroupAware: unified.isMediaGroupAware,
    customDataType: unified.customDataType,
    customDataLabel: unified.customDataLabel,
  };
}

/**
 * Searches cached ShadowServices across all providers with smart filtering
 */
export async function searchShadowServices(params: {
  query?: string;
  providerId?: string;
  platform?: string;
  targetType?: string;
  limit?: number;
}): Promise<ShadowServiceSearchResult[]> {
  const { query, providerId, platform, targetType, limit = 25 } = params;

    const where: Prisma.ShadowServiceWhereInput = {};

  if (providerId) {
    where.providerId = providerId;
  }

  if (platform) {
    where.platform = { contains: platform, mode: 'insensitive' };
  }

  if (targetType) {
    where.targetType = targetType;
  }

  if (query && query.trim()) {
    const term = query.trim();
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { cleanName: { contains: term, mode: 'insensitive' } },
      { category: { contains: term, mode: 'insensitive' } },
      { externalId: { equals: term } },
    ];
  }

  const items = await db.shadowService.findMany({
    where,
    include: {
      provider: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [
      { anomalyScore: 'asc' },
      { rateRub: 'asc' },
    ],
    take: limit,
  });

  return items.map((s: (typeof items)[number]) => ({
    id: s.id,
    providerId: s.providerId,
    providerName: s.provider.name,
    externalId: s.externalId,
    name: s.name,
    cleanName: s.cleanName,
    category: s.category,
    normalizedCategory: s.normalizedCategory,
    rate: s.rate,
    rateRub: s.rateRub,
    min: s.min,
    max: s.max,
    refill: s.refill,
    cancel: s.cancel,
    dripfeed: s.dripfeed,
    targetType: s.targetType || 'POST',
    customDataType: s.customDataType || 'NONE',
    isMediaGroupAware: s.isMediaGroupAware || false,
    warranty: s.warranty || 0,
    anomalyScore: s.anomalyScore || 0,
  }));
}
