/**
 * Centralized Role-Based Access Control (RBAC) Permissions Map & Evaluators.
 * Defines exact feature access per role and evaluates custom granular overrides.
 */

export interface StaffRolePermissionsConfig {
  canAccessExecutive: boolean;
  canUseKillSwitch: boolean;
  canViewLiquidity: boolean;
  canViewAuditLogs: boolean;
  canAccessTelegram: boolean;
  canViewFinancials: boolean;
  canEditCatalog: boolean;
  canManageStaff: boolean;
}

export const ROLE_PERMISSIONS: Record<string, StaffRolePermissionsConfig> = {
  OWNER: {
    canAccessExecutive: true,
    canUseKillSwitch: true,
    canViewLiquidity: true,
    canViewAuditLogs: true,
    canAccessTelegram: true,
    canViewFinancials: true,
    canEditCatalog: true,
    canManageStaff: true,
  },
  ADMIN: {
    canAccessExecutive: true,
    canUseKillSwitch: true,
    canViewLiquidity: true,
    canViewAuditLogs: true,
    canAccessTelegram: true,
    canViewFinancials: true,
    canEditCatalog: true,
    canManageStaff: true,
  },
  MANAGER: {
    canAccessExecutive: false,
    canUseKillSwitch: false,
    canViewLiquidity: false,
    canViewAuditLogs: false,
    canAccessTelegram: false,
    canViewFinancials: false,
    canEditCatalog: true,
    canManageStaff: false,
  },
  SUPPORT: {
    canAccessExecutive: false,
    canUseKillSwitch: false,
    canViewLiquidity: false,
    canViewAuditLogs: false,
    canAccessTelegram: false,
    canViewFinancials: false,
    canEditCatalog: false,
    canManageStaff: false,
  },
  OPERATOR: {
    canAccessExecutive: false,
    canUseKillSwitch: false,
    canViewLiquidity: false,
    canViewAuditLogs: false,
    canAccessTelegram: false,
    canViewFinancials: false,
    canEditCatalog: false,
    canManageStaff: false,
  },
};

/**
 * Returns merged permissions for a staff user taking into account role defaults + explicit DB overrides.
 */
export function getRolePermissions(
  role: string = 'SUPPORT',
  customPermissions?: Array<{ section: string; canView: boolean; canEdit: boolean }> | null
): StaffRolePermissionsConfig {
  if (role === 'OWNER' || role === 'ADMIN') {
    return { ...ROLE_PERMISSIONS.OWNER };
  }

  const base = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.SUPPORT;
  if (!customPermissions || customPermissions.length === 0) {
    return { ...base };
  }

  const has = (section: string, mode: 'view' | 'edit' = 'view') => {
    const sec = section.toUpperCase();
    return customPermissions.some(
      (p) => p.section.toUpperCase() === sec && (mode === 'edit' ? p.canEdit : (p.canView || p.canEdit))
    );
  };

  return {
    canAccessExecutive: base.canAccessExecutive || has('analytics', 'view'),
    canUseKillSwitch: base.canUseKillSwitch || has('settings', 'edit'),
    canViewLiquidity: base.canViewLiquidity || has('providers', 'view'),
    canViewAuditLogs: base.canViewAuditLogs || has('settings', 'view'),
    canAccessTelegram: base.canAccessTelegram || has('settings', 'edit'),
    canViewFinancials: base.canViewFinancials || has('finance', 'view'),
    canEditCatalog: base.canEditCatalog || has('catalog', 'edit'),
    canManageStaff: base.canManageStaff || has('staff', 'edit'),
  };
}
