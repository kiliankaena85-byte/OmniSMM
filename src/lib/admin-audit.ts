import { db } from '@/lib/db';
import { normalizeTenantId } from '@/lib/tenant-resolver-edge';
import { tenantStorage } from '@/lib/tenant-context';

/**
 * Resolves the tenant context for audit logging.
 * Priority:
 * 1. Explicitly provided tenantId
 * 2. Active AsyncLocalStorage tenant context (tenantStorage / runWithTenant)
 * 3. Next.js headers / cookies (x_admin_tenant, x_tenant, x-tenant-id)
 * 4. Fallback: 'smmplan'
 */
async function resolveAuditTenant(explicitTenant?: string | null): Promise<string> {
  if (explicitTenant && explicitTenant.trim() !== '') {
    return (normalizeTenantId(explicitTenant) as string) || 'smmplan';
  }

  // 2. Check Node.js AsyncLocalStorage store (BullMQ runWithTenant, background processors)
  try {
    const storeTenant = tenantStorage.getStore()?.tenantId;
    if (storeTenant && storeTenant.trim() !== '') {
      return (normalizeTenantId(storeTenant) as string) || 'smmplan';
    }
  } catch {}

  // 3. Check Next.js request context (cookies & headers)
  try {
    const { cookies, headers } = await import('next/headers');
    try {
      const cookieStore = await cookies();
      const cookieTenant = cookieStore.get('x_admin_tenant')?.value || cookieStore.get('x_tenant')?.value;
      if (cookieTenant && cookieTenant.trim() !== '') {
        return (normalizeTenantId(cookieTenant) as string) || 'smmplan';
      }
    } catch {}

    try {
      const headerStore = await headers();
      const headerTenant = headerStore.get('x-tenant-id');
      if (headerTenant && headerTenant.trim() !== '') {
        return (normalizeTenantId(headerTenant) as string) || 'smmplan';
      }
    } catch {}
  } catch {
    // Outside Next.js request context (worker, queue, test, script)
  }

  return 'smmplan';
}

/**
 * Safely serializes values to JSON strings.
 * Handles BigInt, circular references, deep recursive key scrubbing,
 * and guards against synchronous JSON stringification crashes.
 */
export function safeSerialize(value: unknown): string | null {
  if (value === undefined || value === null) return null;

  const seen = new Set<unknown>();

  function recurse(val: unknown): unknown {
    if (val === null || val === undefined) {
      return val;
    }

    if (typeof val === 'bigint') {
      return val.toString();
    }

    if (typeof val !== 'object') {
      return val;
    }

    // Handle circular references
    if (seen.has(val)) {
      return '[Circular]';
    }
    seen.add(val);

    if (Array.isArray(val)) {
      const arr = val.map(item => recurse(item));
      seen.delete(val);
      return arr;
    }

    if (val instanceof Date) {
      return val.toISOString();
    }
    if (val instanceof RegExp) {
      return val.toString();
    }

    const obj = val as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    const sensitiveKeys = ['password', 'pass', 'hash', 'token', 'secret', 'key', 'credentials', 'yookassa', 'vault'];

    for (const k of Object.keys(obj)) {
      const lowerKey = k.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
      
      if (isSensitive) {
        result[k] = '[SCRUBBED]';
      } else {
        result[k] = recurse(obj[k]);
      }
    }

    seen.delete(val);
    return result;
  }

  try {
    const cleaned = recurse(value);
    return JSON.stringify(cleaned);
  } catch (err) {
    console.error('[AdminAudit] Failed to serialize:', err);
    return '[Serialization Failed]';
  }
}

/**
 * Logs an administrative action to the AdminAuditLog table.
 * Uses fire-and-forget by default (non-blocking).
 * For critical actions (balance changes), pass `await` explicitly.
 */
export function auditAdmin(params: {
  adminId: string;
  adminEmail: string;
  action: string;
  target: string;
  targetType: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  tenantId?: string;
}) {
  // Fire-and-forget: does not block the main operation
  void (async () => {
    const tenantId = await resolveAuditTenant(params.tenantId);
    await db.adminAuditLog.create({
      data: {
        tenantId,
        adminId: params.adminId,
        adminEmail: params.adminEmail,
        action: params.action,
        target: params.target,
        targetType: params.targetType,
        oldValue: safeSerialize(params.oldValue),
        newValue: safeSerialize(params.newValue),
        ipAddress: params.ipAddress ?? null,
      },
    });
  })().catch((err) => {
    // Silently log — audit failure must never crash the primary action
    console.error('[AdminAudit] Failed to write log:', err);
  });
}

/**
 * Awaitable version of auditAdmin for critical operations where we MUST ensure the log is saved
 * (e.g. role changes, financial changes).
 */
export async function auditAdminAwaitable(params: {
  adminId: string;
  adminEmail: string;
  action: string;
  target: string;
  targetType: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  tenantId?: string;
  tx?: any;
}) {
  const tenantId = await resolveAuditTenant(params.tenantId);
  const client = params.tx || db;
  return client.adminAuditLog.create({
    data: {
      tenantId,
      adminId: params.adminId,
      adminEmail: params.adminEmail,
      action: params.action,
      target: params.target,
      targetType: params.targetType,
      oldValue: safeSerialize(params.oldValue),
      newValue: safeSerialize(params.newValue),
      ipAddress: params.ipAddress ?? null,
    },
  });
}

