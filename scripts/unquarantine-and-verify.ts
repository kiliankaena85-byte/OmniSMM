import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile('.env');
}

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

async function main() {
  console.log('=== UNQUARANTINE CATALOG SERVICES ===');

  // 1. Release quarantine for all services that belong to curated catalog or are active
  const updateResult = await prisma.service.updateMany({
    where: {
      tenantId: 'all',
      isActive: true,
      isQuarantined: true
    },
    data: {
      isQuarantined: false,
      quarantineReason: null,
      quarantinedAt: null,
      cooldownReason: null,
      cooldownUntil: null
    }
  });

  console.log(`✅ Снято с карантина услуг: ${updateResult.count}`);

  // 2. Clear all Redis cache
  const keys = await redis.keys('*');
  const catalogKeys = keys.filter(k => 
    k.includes('catalog') || 
    k.includes('network') || 
    k.includes('service') || 
    k.includes('category') || 
    k.includes('storefront') ||
    k.includes('guest')
  );

  console.log(`🧹 Найдено ключей кэша каталога в Redis: ${catalogKeys.length}`);
  if (catalogKeys.length > 0) {
    await redis.del(...catalogKeys);
    console.log(`✅ Кэш Redis успешно очищен.`);
  }

  // 3. Count visible services per network for storefront
  const networks = await prisma.network.findMany({
    where: {
      isActive: true,
      tenantId: { in: ['smmplan', 'all'] }
    },
    include: {
      categories: {
        where: {
          tenantId: { in: ['smmplan', 'all'] },
          services: {
            some: {
              isActive: true,
              isQuarantined: false,
              tenantId: { in: ['smmplan', 'all'] }
            }
          }
        },
        include: {
          _count: {
            select: {
              services: {
                where: {
                  isActive: true,
                  isQuarantined: false,
                  tenantId: { in: ['smmplan', 'all'] }
                }
              }
            }
          }
        }
      }
    }
  });

  console.log(`\n📊 Результат для витрины SMMplan:`);
  console.log(`   - Доступно соцсетей: ${networks.length}`);
  for (const net of networks) {
    const totalServices = net.categories.reduce((acc, cat) => acc + (cat._count?.services || 0), 0);
    console.log(`   - ${net.name}: категорий ${net.categories.length}, активных незаблокированных услуг: ${totalServices}`);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
