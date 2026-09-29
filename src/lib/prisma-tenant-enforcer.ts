/**
 * @file prisma-tenant-enforcer.ts
 * Enterprise Automatic Prisma Extension for Zero-Leak Tenant Isolation (SDD-TDD 2026).
 * Automatically intercepts and scopes database operations by tenantId using PostgreSQL Row-Level Security.
 */

import * as tenantContext from './tenant-context';

export interface TenantEnforcerOptions {
  findFirstDelegate?: (args: Record<string, unknown>) => Promise<unknown>;
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

export interface TenantContextResolver {
  resolveActiveTenantId: () => Promise<string | null>;
  isTenantBypassActive: () => boolean;
  isInTransactionContext?: () => boolean;
}

export interface PrismaBatchTransactionClient {
  $transaction<T>(arg: PromiseLike<unknown>[]): Promise<T[]>;
  $executeRawUnsafe(query: string): Promise<unknown>;
  $executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
}

export function createTenantEnforcerExtension(
  prismaClient: PrismaBatchTransactionClient,
  context: TenantContextResolver = tenantContext
) {
  const queryExtensions: Record<string, {
    $allOperations: (params: {
      args: Record<string, unknown>;
      query: (args: Record<string, unknown>) => Promise<unknown>;
    }) => Promise<unknown>;
  }> = {};

  for (const model of TENANT_SCOPED_MODELS) {
    queryExtensions[model] = {
      async $allOperations({ args, query }: {
        args: Record<string, unknown>;
        query: (args: Record<string, unknown>) => Promise<unknown>;
      }) {
        // 1. If executing within an interactive transaction, RLS session is already configured on connection
        if (typeof context.isInTransactionContext === 'function' && context.isInTransactionContext()) {
          return await query(args);
        }

        // 2. Audit-verified bypass mode
        if (context.isTenantBypassActive()) {
          const res = await prismaClient.$transaction<unknown>([
            prismaClient.$executeRawUnsafe(`SET LOCAL ROLE app_user`),
            prismaClient.$executeRaw`SELECT set_config('app.current_tenant', 'bypass', TRUE)`,
            query(args)
          ]);
          return res[res.length - 1];
        }

        let tenantId = await context.resolveActiveTenantId();
        
        // 3. Fallback for background caches / unstable_cache where headers() are not accessible
        const where = (typeof args === 'object' && args !== null && 'where' in args)
          ? (args as { where?: { tenantId?: string | { in?: string[] } } }).where
          : undefined;

        if (!tenantId && where?.tenantId) {
          if (typeof where.tenantId === 'string') {
            tenantId = where.tenantId === 'all' ? 'bypass' : where.tenantId;
          } else if (Array.isArray(where.tenantId?.in)) {
            const found = where.tenantId.in.find((t: string) => t && t !== 'all');
            if (found) {
              tenantId = found;
            } else if (where.tenantId.in.includes('all')) {
              tenantId = 'bypass';
            }
          }
        }
        
        if (tenantId) {
          const res = await prismaClient.$transaction<unknown>([
            prismaClient.$executeRawUnsafe(`SET LOCAL ROLE app_user`),
            prismaClient.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, TRUE)`,
            query(args)
          ]);
          return res[res.length - 1];
        }

        // 4. If no tenant context is resolved, apply app_user role without set_config
        const res = await prismaClient.$transaction<unknown>([
          prismaClient.$executeRawUnsafe(`SET LOCAL ROLE app_user`),
          query(args)
        ]);
        return res[res.length - 1];
      }
    };
  }

  return {
    query: queryExtensions,
  };
}
