/**
 * @file prisma-tenant-enforcer.ts
 * Enterprise Automatic Prisma Extension for Zero-Leak Tenant Isolation (SDD-TDD 2026).
 * Automatically intercepts and scopes database operations by tenantId using PostgreSQL Row-Level Security.
 */

import { resolveActiveTenantId, isTenantBypassActive } from './tenant-context';

export interface TenantEnforcerOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findFirstDelegate?: (args: any) => Promise<any>;
}

export const TENANT_SCOPED_MODELS = [
  'order',
  'payment',
  'ticket',
  'user',
  'service',
  'category',
  'customerGroup',
  'ticketFeedback',
  'ledgerEntry',
  'supportFinancialAction',
  'authToken',
  'shadowService',
  'storefrontKey'
] as const;

export type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTenantEnforcerExtension(prismaClient: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryExtensions: Record<string, any> = {};

  for (const model of TENANT_SCOPED_MODELS) {
    queryExtensions[model] = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async $allOperations({ args, query }: { args: any; query: (args: any) => any }) {
        if (isTenantBypassActive()) {
          const [, , result] = await prismaClient.$transaction([
            prismaClient.$executeRawUnsafe(`SET LOCAL ROLE app_user`),
            prismaClient.$executeRaw`SELECT set_config('app.current_tenant', 'bypass', TRUE)`,
            query(args)
          ]);
          return result;
        }

        let tenantId = await resolveActiveTenantId();
        
        // Fallback for background caches / unstable_cache where headers() are not accessible
        if (!tenantId && args?.where?.tenantId) {
          if (typeof args.where.tenantId === 'string' && args.where.tenantId !== 'all') {
            tenantId = args.where.tenantId;
          } else if (Array.isArray(args.where.tenantId?.in)) {
            const found = args.where.tenantId.in.find((t: string) => t && t !== 'all');
            if (found) tenantId = found;
          }
        }
        
        if (tenantId) {
          const [, , result] = await prismaClient.$transaction([
            prismaClient.$executeRawUnsafe(`SET LOCAL ROLE app_user`),
            prismaClient.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, TRUE)`,
            query(args)
          ]);
          return result;
        }

        // If no tenant context is resolved, explicitly set empty string so NULLIF(..., '') IS NULL triggers cleanly
        const [, , result] = await prismaClient.$transaction([
          prismaClient.$executeRawUnsafe(`SET LOCAL ROLE app_user`),
          prismaClient.$executeRaw`SELECT set_config('app.current_tenant', '', TRUE)`,
          query(args)
        ]);
        return result;
      }
    };
  }

  return {
    query: queryExtensions,
  };
}
