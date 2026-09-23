import { ITenantDashboardStrategy, BaseUserProps } from './types';
import { getTenantLoader } from './registry';
import { normalizeTenantId } from '@/lib/tenant-resolver-edge';

/**
 * Tenant View Factory (100% OCP Compliant)
 * Dynamically resolves the tenant dashboard strategy without editing this factory file.
 */
export async function getTenantDashboardViews(tenantId: string): Promise<ITenantDashboardStrategy<BaseUserProps, unknown>> {
  const normalizedId = normalizeTenantId(tenantId) || 'smmplan';
  const loader = getTenantLoader(normalizedId);
  if (!loader) {
    console.warn(`[TenantFactory] Unregistered tenant requested: "${tenantId}". Loading neutral maintenance fallback.`);
    const fallbackModule = await import('./fallback/neutral-maintenance-strategy');
    return fallbackModule.default as ITenantDashboardStrategy<BaseUserProps, unknown>;
  }

  try {
    const tenantModule = await loader();
    return tenantModule.default as ITenantDashboardStrategy<BaseUserProps, unknown>;
  } catch (err) {
    console.error(`[TenantFactory] Failed to load tenant module for "${tenantId}":`, err);
    const fallbackModule = await import('./fallback/neutral-maintenance-strategy');
    return fallbackModule.default as ITenantDashboardStrategy<BaseUserProps, unknown>;
  }
}
