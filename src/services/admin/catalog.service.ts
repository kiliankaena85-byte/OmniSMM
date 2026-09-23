import { type PaginatedResult } from '@/lib/pagination';
import {
  CatalogManagementService,
  type CatalogRow
} from './catalog/catalog-management.service';
import {
  CatalogSyncService,
  type ProviderExternalService
} from './catalog/catalog-sync.service';
import {
  CatalogImportService,
  type ImportServicesResult,
  type ImportSkippedItem,
  type ImportMarkupAdjustment,
  type ImportSkipReason
} from './catalog/catalog-import.service';

export * from './catalog/catalog-taxonomy.service';
export * from './catalog/catalog-management.service';
export * from './catalog/catalog-sync.service';
export * from './catalog/catalog-import.service';

export class AdminCatalogService {
  /**
   * Paginated service list with category, markup, and order count.
   */
  async listServices(params: {
    cursor?: string;
    page?: number;
    search?: string;
    categoryId?: string;
    providerId?: string;
    isActive?: boolean;
    hideDeleted?: boolean;
    providerStatus?: string;
    externalId?: string;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    networkSlug?: string;
    tenantId?: string;
  }): Promise<PaginatedResult<CatalogRow>> {
    return CatalogManagementService.listServices(params);
  }

  /**
   * Updates service markup and recalculates prices with safety bounds.
   */
  async updateMarkup(
    id: string,
    markup: number,
    admin: { id: string; email: string }
  ) {
    return CatalogManagementService.updateMarkup(id, markup, admin);
  }

  /**
   * Toggles service active status with audit logging.
   */
  async toggleService(id: string, isActive: boolean, admin: { id: string; email: string }) {
    return CatalogManagementService.toggleService(id, isActive, admin);
  }

  /**
   * Soft deletes a service (marks inactive and flags cooldown).
   */
  async softDeleteService(id: string, admin: { id: string; email: string }) {
    return CatalogManagementService.softDeleteService(id, admin);
  }

  /**
   * Fetches provider external services from the default provider.
   */
  async getProviderServices(): Promise<ProviderExternalService[]> {
    return CatalogSyncService.getProviderServices();
  }

  /**
   * Refreshes the local ShadowService staging catalog by fetching services from the provider.
   */
  async refreshShadowCatalog(providerId: string): Promise<number> {
    return CatalogSyncService.refreshShadowCatalog(providerId);
  }

  /**
   * Synchronizes services with the provider catalog, discovering zombies and resurrected services.
   */
  async syncProviderCatalog(providerId: string, admin: { id: string; email: string }) {
    return CatalogSyncService.syncProviderCatalog(providerId, admin);
  }

  /**
   * Imports services from shadow catalog into live curated services.
   */
  async importServices(
    externalIds: string[],
    categoryId: string,
    defaultMarkup: number,
    admin: { id: string; email: string },
    providerId: string,
    categoryIdMap?: Record<string, string>,
    targetTenantId: 'smmplan' | 'flux' | 'both' = 'smmplan'
  ): Promise<ImportServicesResult> {
    return CatalogImportService.importServices(
      externalIds,
      categoryId,
      defaultMarkup,
      admin,
      providerId,
      categoryIdMap,
      targetTenantId
    );
  }

  /**
   * Detects anomalies in provider rates.
   */
  async detectAnomalies(
    oldRates: Map<string, number | { rate: number; currency?: string; costRub?: number }>,
    newRates: Map<string, number | { rate: number; currency?: string; costRub?: number }>
  ): Promise<string[]> {
    return CatalogSyncService.detectAnomalies(oldRates, newRates);
  }

  /**
   * Returns catalog stats for header and dashboard counters.
   */
  async getCatalogStats(tenantId?: string, _startDate?: Date, _endDate?: Date) {
    return CatalogManagementService.getCatalogStats(tenantId, _startDate, _endDate);
  }

  /**
   * Bulk updates markup for multiple services matching filter.
   */
  async bulkUpdateMarkup(
    filter: { categoryId?: string; platform?: string; tenantId?: string; search?: string },
    markup: number,
    admin: { id: string; email: string }
  ) {
    return CatalogManagementService.bulkUpdateMarkup(filter, markup, admin);
  }

  /**
   * Synchronizes denormalized prices when exchange rates change.
   */
  async syncDenormalizedPrices(usdToRub: number) {
    return CatalogSyncService.syncDenormalizedPrices(usdToRub);
  }

  /**
   * Returns markup distribution analytics across all services.
   */
  async getMarkupAnalytics(tenantId?: string) {
    return CatalogManagementService.getMarkupAnalytics(tenantId);
  }

  /**
   * Lists categories for catalog filtering.
   */
  async listCategories(tenantId?: string) {
    return CatalogManagementService.listCategories(tenantId);
  }

  /**
   * Returns count of quarantined services.
   */
  async getQuarantineCount(tenantId?: string): Promise<number> {
    return CatalogManagementService.getQuarantineCount(tenantId);
  }

  /**
   * Returns health summary counts: quarantine, zombies, cooldown.
   */
  async getCatalogHealthCounts(tenantId?: string): Promise<{ quarantine: number; zombies: number; cooldown: number }> {
    return CatalogManagementService.getCatalogHealthCounts(tenantId);
  }
}

export const adminCatalogService = new AdminCatalogService();
export const catalogService = adminCatalogService;
