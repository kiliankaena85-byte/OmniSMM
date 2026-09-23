import { PrismaClient, Prisma } from '@prisma/client';
import { createTenantEnforcerExtension } from './prisma-tenant-enforcer';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatasourceUrl(): string | undefined {
  if (process.env.CONTOUR === 'test' && process.env.DATABASE_URL_TEST) {
    return process.env.DATABASE_URL_TEST;
  }
  if (process.env.CONTOUR === 'prod' && process.env.DATABASE_URL_PROD) {
    return process.env.DATABASE_URL_PROD;
  }
  let url = process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (url && url.startsWith('prisma://')) {
    url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_URL || url.replace(/^prisma:\/\//, 'postgresql://');
  }
  return url;
}

function createPrismaClient(): PrismaClient {
  if (typeof window !== 'undefined' || process.env.NEXT_RUNTIME === 'edge') {
    // Return mock proxy for Browser/Edge Runtime to prevent native binary evaluation crashes
    return new Proxy({} as PrismaClient, {
      get() {
        throw new Error('PrismaClient cannot be executed in Browser or Next.js Edge Runtime. Use Server Components or Server Actions.');
      }
    });
  }

  const datasourceUrl = getDatasourceUrl();
  const rawPrisma =
    globalForPrisma.prisma ??
    new PrismaClient({
      ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
      log: process.env.DEBUG_PRISMA === 'true'
        ? ['query', 'error', 'warn']
        : ['error', 'warn'],
    });

  const guarded = (rawPrisma as unknown as {
    $extends: (extension: unknown) => PrismaClient;
  }).$extends({
    query: {
      service: {
        async deleteMany({ args, query }: { args: Prisma.ServiceDeleteManyArgs; query: (args: Prisma.ServiceDeleteManyArgs) => Promise<Prisma.BatchPayload> }) {
          if (!args?.where || Object.keys(args.where).length === 0) {
            if (process.env.NODE_ENV === 'production') {
              throw new Error('🚨 [SAFE-GUARD] Unconditional Service.deleteMany() is strictly blocked in production!');
            }
            if (process.env.APP_ENV !== 'test' && process.env.ALLOW_UNSAFE_PURGE !== 'true') {
              throw new Error('🚨 [SAFE-GUARD] Unconditional Service.deleteMany() is blocked to prevent catalog loss!');
            }
            console.warn('⚠️ [AUDIT WARNING] Unconditional Service purge executed!');
          }
          return query(args);
        },
      },
      category: {
        async deleteMany({ args, query }: { args: Prisma.ServiceDeleteManyArgs; query: (args: Prisma.ServiceDeleteManyArgs) => Promise<Prisma.BatchPayload> }) {
          if (!args?.where || Object.keys(args.where).length === 0) {
            if (process.env.NODE_ENV === 'production') {
              throw new Error('🚨 [SAFE-GUARD] Unconditional Category.deleteMany() is strictly blocked in production!');
            }
            if (process.env.APP_ENV !== 'test' && process.env.ALLOW_UNSAFE_PURGE !== 'true') {
              throw new Error('🚨 [SAFE-GUARD] Unconditional Category.deleteMany() is blocked to prevent catalog loss!');
            }
            console.warn('⚠️ [AUDIT WARNING] Unconditional Category purge executed!');
          }
          return query(args);
        },
      },
      network: {
        async deleteMany({ args, query }: { args: Prisma.ServiceDeleteManyArgs; query: (args: Prisma.ServiceDeleteManyArgs) => Promise<Prisma.BatchPayload> }) {
          if (!args?.where || Object.keys(args.where).length === 0) {
            if (process.env.NODE_ENV === 'production') {
              throw new Error('🚨 [SAFE-GUARD] Unconditional Network.deleteMany() is strictly blocked in production!');
            }
            if (process.env.APP_ENV !== 'test' && process.env.ALLOW_UNSAFE_PURGE !== 'true') {
              throw new Error('🚨 [SAFE-GUARD] Unconditional Network.deleteMany() is blocked to prevent catalog loss!');
            }
            console.warn('⚠️ [AUDIT WARNING] Unconditional Network purge executed!');
          }
          return query(args);
        },
      },
      ledgerEntry: {
        async delete() {
          throw new Error('🚨 [SAFE-GUARD] LedgerEntry delete is strictly forbidden (Financial Audit Trail)!');
        },
        async deleteMany() {
          throw new Error('🚨 [SAFE-GUARD] LedgerEntry deletion is strictly forbidden (Financial Audit Trail)!');
        },
        async update() {
          throw new Error('🚨 [SAFE-GUARD] LedgerEntry update is strictly forbidden (Financial Audit Trail)!');
        },
        async updateMany() {
          throw new Error('🚨 [SAFE-GUARD] LedgerEntry update is strictly forbidden (Financial Audit Trail)!');
        },
      },
    },
  }) as unknown as PrismaClient;

  const tenantGuarded = (guarded as unknown as {
    $extends: (extension: unknown) => PrismaClient;
  }).$extends(createTenantEnforcerExtension()) as unknown as PrismaClient;

  return tenantGuarded;
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production' && process.env.NEXT_RUNTIME !== 'edge') {
  globalForPrisma.prisma = db;
}
