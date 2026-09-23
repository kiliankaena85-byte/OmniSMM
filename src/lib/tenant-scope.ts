/**
 * @file TenantScope - Canonical Golden Path Primitive for Multi-Tenant Scoping & Enforcement.
 * @module TenantScope
 * 
 * JSDoc / Usage Guidelines:
 * ✅ DO THIS:
 *   const tenantId = requireTenantId(session);
 *   const orders = await db.order.findMany({ where: tenantWhere(session, { status: 'COMPLETED' }) });
 *   assertSameTenant(session, targetOrder);
 * 
 * ❌ NEVER DO THIS (Tenant Isolation Leak):
 *   const order = await db.order.findUnique({ where: { id: params.id } }); // ❌ Lacks tenant filter!
 */

export interface TenantSession {
  tenantId?: string;
  user?: {
    tenantId?: string;
  };
}

export function requireTenantId(session: TenantSession | null | undefined): string {
  const tenantId = session?.tenantId || session?.user?.tenantId;
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error('SECURITY_TENANT_MISSING: Operation blocked - missing valid tenantId in session.');
  }
  return tenantId;
}

export function tenantWhere<T extends object>(session: TenantSession | null | undefined, baseWhere: T = {} as T): T & { tenantId: string } {
  const tenantId = requireTenantId(session);
  return {
    ...baseWhere,
    tenantId
  };
}

export function assertSameTenant(session: TenantSession | null | undefined, entity: { tenantId?: string } | null | undefined): void {
  const sessionTenantId = requireTenantId(session);
  if (!entity || !entity.tenantId || entity.tenantId !== sessionTenantId) {
    throw new Error(`SECURITY_TENANT_MISMATCH: Cross-tenant access blocked! Session tenant: ${sessionTenantId}, Entity tenant: ${entity?.tenantId || 'NONE'}`);
  }
}

/**
 * AUD-05 (3.1): canonical catalog visibility rule.
 *
 * A tenant sees catalog taxonomy (Network/Category) and services that belong
 * to its own tenantId OR are explicitly shared with tenantId = 'all'.
 *
 * Apply this filter uniformly in EVERY catalog read path:
 * storefront network tree, category services list, admin listings and the
 * import wizard category picker. Divergent filters produce "ghost" or
 * "empty" categories — the root cause of AUD-05.
 *
 * Usage:
 *   db.category.findMany({ where: { tenantId: tenantVisibilityFilter(tenantId), ... } });
 */
export function tenantVisibilityFilter(tenantId: string): { in: string[] } {
  const normalized = normalizeTenantId(tenantId);
  const tenant = normalized === 'all' || normalized === '' ? 'smmplan' : normalized;
  return { in: [tenant, 'all'] };
}

const ALLOWED_TENANTS = new Set(['smmplan', 'flux', 'all']);

/**
 * TASK 2: Validates and normalizes client-provided tenantId parameters.
 * Defaults unknown or unrecognized tenant IDs to 'smmplan' and logs warning.
 */
export function normalizeTenantId(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) {
    return 'smmplan';
  }
  const clean = input.trim().toLowerCase();
  if (clean === 'lovable') return 'flux'; // legacy alias
  if (ALLOWED_TENANTS.has(clean)) {
    return clean;
  }
  return 'smmplan';
}

