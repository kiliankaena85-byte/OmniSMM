/**
 * UNIFIED LINK & SERVICE TARGET TYPE CONTRACT (Tier 1 Core)
 * Single Source of Truth for URL target recognition and service compatibility.
 * Defined in SPEC-2026-09-14.
 */

import {
  TargetTypeEnum,
  LinkType,
  normalizeTargetType,
  inferTargetTypeFromName,
  resolveServiceTargetType,
  isTargetTypeCompatible,
  isLinkServiceCompatible,
  getCompatibilityError,
  type ServiceTargetType,
} from './target-type-mapper';

export {
  TargetTypeEnum,
  LinkType,
  normalizeTargetType,
  inferTargetTypeFromName,
  resolveServiceTargetType,
  isTargetTypeCompatible,
  isLinkServiceCompatible,
  getCompatibilityError,
  type ServiceTargetType,
};

/** Alias for LinkTargetType */
export type LinkTargetType = TargetTypeEnum;

/**
 * Checks compatibility between Service Target Type and Link Target Type.
 * Complies with strict signature isCompatible(serviceType, linkType).
 */
export function isCompatible(
  serviceType: TargetTypeEnum | string | null | undefined,
  linkType: TargetTypeEnum | string | null | undefined
): boolean {
  return isTargetTypeCompatible(linkType, serviceType);
}

export function isHybridViewCategory(categoryName: string | null | undefined): boolean {
  if (!categoryName) return false;
  const n = categoryName.toLowerCase();
  if (n.includes('стори') || n.includes('story') || n.includes('клип') || n.includes('clip') || n.includes('shorts') || n.includes('reel')) {
    return false;
  }
  return n.includes('просмотр') || n.includes('охват') || n.includes('view') || n.includes('watch');
}

export function inferTargetTypeFromCategory(categoryName: string | null | undefined): TargetTypeEnum {
  if (isHybridViewCategory(categoryName)) {
    return TargetTypeEnum.CUSTOM;
  }
  return inferTargetTypeFromName(categoryName);
}
