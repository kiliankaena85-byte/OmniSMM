import { db } from '../src/lib/db';

async function checkTenants() {
  const networkTenants = await db.network.groupBy({
    by: ['tenantId'],
    _count: { id: true }
  });
  console.log('Network tenantIds:', networkTenants);

  const categoryTenants = await db.category.groupBy({
    by: ['tenantId'],
    _count: { id: true }
  });
  console.log('Category tenantIds:', categoryTenants);

  const serviceTenants = await db.service.groupBy({
    by: ['tenantId'],
    _count: { id: true }
  });
  console.log('Service tenantIds:', serviceTenants);

  const quarantinedServices = await db.service.count({ where: { isQuarantined: true } });
  console.log('Quarantined services:', quarantinedServices);

  const inactiveServices = await db.service.count({ where: { isActive: false } });
  console.log('Inactive services:', inactiveServices);

  const cooldownServices = await db.service.count({ where: { cooldownUntil: { gte: new Date() } } });
  console.log('Cooldown active services:', cooldownServices);

  // Check some sample services
  const sampleServices = await db.service.findMany({
    take: 5,
    select: { id: true, name: true, categoryId: true, tenantId: true, isActive: true, isQuarantined: true, cooldownUntil: true }
  });
  console.log('Sample services:', sampleServices);
}

checkTenants()
  .catch(console.error)
  .finally(() => db.$disconnect());
