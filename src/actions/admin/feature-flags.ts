'use server';

/**
 * Server Actions: Feature Flags
 * 
 * All actions require OWNER or ADMIN role (requireAdmin guard).
 * State transitions are logged via AdminAuditLog.
 * 
 * References:
 * - FeatureFlagService: @/services/system/feature-flag.service
 * - Guard: @/lib/server/rbac (requireAdmin)
 * - Audit: @/lib/admin-audit
 */

import { requireStaffPermission } from '@/lib/server/rbac';
import { featureFlagService, type FlagKey, type FlagState } from '@/services/system/feature-flag.service';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';

/** List all feature flags with current state */
export async function getFeatureFlags() {
  return requireStaffPermission('SETTINGS', 'view', async () => {
    const flags = await featureFlagService.listAll();
    return { success: true as const, data: flags };
  });
}

/** Toggle a feature flag state */
export async function setFeatureFlagState(key: FlagKey, state: FlagState) {
  return requireStaffPermission('SETTINGS', 'edit', async (admin) => {
    // Security: validate state value
    if (!['ON', 'TEST', 'OFF'].includes(state)) {
      return { success: false as const, error: 'Invalid state value' };
    }

    const previous = await featureFlagService.getState(key);
    const updated = await featureFlagService.setState(key, state, admin.email);

    // Audit log: record all flag changes
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'FEATURE_FLAG_CHANGE',
      target: key,
      targetType: 'SETTINGS',
      oldValue: { state: previous },
      newValue: { state },
    });

    revalidatePath('/admin/system/features');
    return { success: true as const, data: updated };
  });
}
