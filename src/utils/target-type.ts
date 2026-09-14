import {
  TargetTypeEnum,
  normalizeTargetType,
  inferTargetTypeFromName,
  resolveServiceTargetType,
  isTargetTypeCompatible,
  type ServiceTargetType
} from './target-type-mapper';

export {
  TargetTypeEnum,
  normalizeTargetType,
  inferTargetTypeFromName,
  resolveServiceTargetType,
  isTargetTypeCompatible,
  type ServiceTargetType
};

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

