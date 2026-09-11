/**
 * @file tenant-context.ts
 * Enterprise Tenant Context Provider based on Node.js AsyncLocalStorage.
 * Enables zero-leak multi-tenant scoping and explicit auditable bypass.
 */

import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextState {
  tenantId?: string;
  isBypass?: boolean;
  bypassReason?: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContextState>();

/**
 * Runs an async function within an explicit tenant context.
 */
export async function runWithTenant<T>(
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  const current = tenantStorage.getStore() || {};
  return tenantStorage.run({ ...current, tenantId, isBypass: false }, fn);
}

/**
 * Runs an async function with tenant enforcement bypassed.
 * MUST specify an audit reason (e.g. 'BullMQ Outbox Global Sync').
 */
export async function runWithTenantBypass<T>(
  reason: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!reason || reason.trim() === '') {
    throw new Error('SECURITY_TENANT_BYPASS: A non-empty reason is strictly required for tenant bypass.');
  }
  const current = tenantStorage.getStore() || {};
  return tenantStorage.run({ ...current, isBypass: true, bypassReason: reason }, fn);
}

/**
 * Checks whether tenant enforcement bypass is currently active in this execution context.
 */
export function isTenantBypassActive(): boolean {
  const store = tenantStorage.getStore();
  return Boolean(store?.isBypass);
}

/**
 * Returns the audit reason for the active bypass, if any.
 */
export function getTenantBypassReason(): string | undefined {
  const store = tenantStorage.getStore();
  return store?.bypassReason;
}

/**
 * Resolves the currently active tenantId from:
 * 1. AsyncLocalStorage context
 * 2. Next.js request headers ('x-tenant-id')
 * 3. Returns null if unresolved
 */
export function resolveActiveTenantId(): string | null {
  const store = tenantStorage.getStore();
  if (store?.tenantId) {
    return store.tenantId;
  }

  // Attempt reading from Next.js headers synchronously if available or cached
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { headers } = require('next/headers');
    if (typeof headers === 'function') {
      const h = headers();
      const tenantHeader = h.get('x-tenant-id');
      if (tenantHeader) {
        return tenantHeader;
      }
    }
  } catch {
    // Ignore: outside Next.js request lifecycle (e.g. CLI, worker, test)
  }

  return null;
}
