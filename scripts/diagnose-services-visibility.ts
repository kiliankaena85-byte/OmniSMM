import { PrismaClient } from '@prisma/client';

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile('.env');
}

const prisma = new PrismaClient();

async function main() {
  console.log('====================================================');
  console.log('  DIAGNOSE SERVICES VISIBILITY IN DATABASE & APIS   ');
  console.log('====================================================\n');

  console.log('Database URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));

  // 1. Service count
  const totalServices = await prisma.service.count();
  const activeServices = await prisma.service.count({ where: { isActive: true } });
  const inactiveServices = await prisma.service.count({ where: { isActive: false } });
  console.log(`Total services in DB: ${totalServices}`);
  console.log(`Active services: ${activeServices}`);
  console.log(`Inactive services: ${inactiveServices}\n`);

  // 2. Services by tenantId
  const servicesByTenant = await prisma.service.groupBy({
    by: ['tenantId', 'isActive'],
    _count: { id: true }
  });
  console.log('Services grouped by tenantId & isActive:');
  console.table(servicesByTenant);

  // 3. Shadow services count
  const shadowCount = await prisma.shadowService.count();
  console.log(`\nShadow services (raw provider buffer): ${shadowCount}`);

  // 4. Categories by tenantId
  const categoriesByTenant = await prisma.category.groupBy({
    by: ['tenantId'],
    _count: { id: true }
  });
  console.log('\nCategories grouped by tenantId:');
  console.table(categoriesByTenant);

  // 5. Test tenant smmplan query (how admin & client queries it)
  const smmplanServices = await prisma.service.findMany({
    where: {
      tenantId: { in: ['smmplan', 'all'] },
      isActive: true
    },
    take: 5,
    select: { id: true, name: true, tenantId: true, isActive: true, pricePer1000Cents: true }
  });
  console.log('\nSample services visible to smmplan (tenantId in [smmplan, all]):', smmplanServices.length);
  console.log(smmplanServices);

  // 6. Test tenant flux query (how admin & client queries it)
  const fluxServices = await prisma.service.findMany({
    where: {
      tenantId: { in: ['flux', 'all'] },
      isActive: true
    },
    take: 5,
    select: { id: true, name: true, tenantId: true, isActive: true, pricePer1000Cents: true }
  });
  console.log('\nSample services visible to flux (tenantId in [flux, all]):', fluxServices.length);
  console.log(fluxServices);
}

main().catch(console.error).finally(() => prisma.$disconnect());
