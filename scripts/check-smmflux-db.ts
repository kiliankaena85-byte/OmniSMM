import { PrismaClient } from '@prisma/client';

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile('.env');
}

const prisma = new PrismaClient();

async function main() {
  console.log('=== SMMFLUX TENANT & CATALOG AUDIT ===');
  
  // 1. Tenants
  const tenants = await prisma.tenant.findMany();
  console.log('Registered Tenants:', tenants.map(t => ({ id: t.id, slug: t.slug, name: t.name, domain: t.domain })));

  // 2. Existing services per tenant
  const serviceCounts = await prisma.service.groupBy({
    by: ['tenantId'],
    _count: { id: true }
  });
  console.log('Existing services by tenantId:', serviceCounts);

  // 3. Existing categories per tenant
  const categoryCounts = await prisma.category.groupBy({
    by: ['tenantId'],
    _count: { id: true }
  });
  console.log('Existing categories by tenantId:', categoryCounts);

  // 4. Existing networks
  const networks = await prisma.network.findMany();
  console.log('Existing networks:', networks.map(n => ({ id: n.id, slug: n.slug, name: n.name })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
