/**
 * Strict DTO for catalog table.
 * NEVER include rate (provider cost) in client DTOs.
 * markupX is safe: it's the user-visible multiplier.
 */
export interface CatalogServiceDTO {
  id: string;
  numericId: number;
  name: string;
  externalId: string | null;
  categoryId: string;
  categoryName: string;
  networkName: string | null;
  networkSlug: string | null;
  /** Provider cost per 1000 — visible only in admin, never to clients */
  rate: number;
  markup: number;
  minQty: number;
  maxQty: number;
  isActive: boolean;
  isQuarantined: boolean;
  quarantineReason: string | null;
  isDripFeedEnabled: boolean;
  isRefillEnabled: boolean;
  isCancelEnabled: boolean;
  ordersCount: number;
  description?: string | null;
  targetType?: string | null;
  customDataType?: string;
  customDataLabel?: string | null;
  isMediaGroupAware?: boolean;
  providerId?: string | null;
  requireWarning?: boolean;
  warningMessage?: string | null;
  cooldownReason?: string | null;
  clientRequirement?: string | null;
  clientConfirmation?: string | null;
  qualityTier?: string | null;
  icon?: string | null;
  categoryIcon?: string | null;
  createdAt?: Date | string | null;
}
