/**
 * @deprecated Use `@/utils/target-type` instead.
 * Centralized Link-Service Compatibility Layer (Backward-Compatibility Facade Proxy).
 * Architected according to SPEC-2026-09-14.
 */

import {
  TargetTypeEnum,
  normalizeTargetType,
  isTargetTypeCompatible,
  getCompatibilityError as getCompatibilityErrorFromTargetType,
  type ServiceTargetType as UnifiedServiceTargetType,
} from '@/utils/target-type';

/**
 * @deprecated Use TargetTypeEnum from `@/utils/target-type`
 */
export const LinkType = TargetTypeEnum;
export type LinkType = TargetTypeEnum;

/**
 * @deprecated Use TargetTypeEnum / ServiceTargetType from `@/utils/target-type`
 */
export const ServiceTargetType = TargetTypeEnum;
export type ServiceTargetType = UnifiedServiceTargetType;

/**
 * @deprecated Use normalizeTargetType from `@/utils/target-type`
 */
export function normalizeLinkType(rawType: string | null | undefined): TargetTypeEnum {
  return normalizeTargetType(rawType);
}

/**
 * @deprecated Use normalizeTargetType from `@/utils/target-type`
 */
export function normalizeServiceTargetType(rawType: string | null | undefined): TargetTypeEnum {
  return normalizeTargetType(rawType);
}

/**
 * Checks whether a detected URL link type is compatible with a service target type.
 */
export function isLinkServiceCompatible(
  rawLinkType: TargetTypeEnum | string | null | undefined,
  rawTargetType: TargetTypeEnum | string | null | undefined
): boolean {
  return isTargetTypeCompatible(rawLinkType, rawTargetType);
}

/**
 * Human-readable, educational error messages for incompatible combinations.
 */
export function getCompatibilityError(
  rawLinkType: TargetTypeEnum | string | null | undefined,
  rawTargetType: TargetTypeEnum | string | null | undefined,
  serviceName?: string
): string {
  return getCompatibilityErrorFromTargetType(rawLinkType, rawTargetType, serviceName);
}
