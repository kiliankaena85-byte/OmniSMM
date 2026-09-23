import { db } from '../src/lib/db';

async function main() {
  console.log('=== SYNCING CANONICAL TENANTS ===');

  // 1. Update or create SMMplan tenant
  const smmplanTenant = await db.tenant.upsert({
    where: { slug: 'smmplan' },
    update: { name: 'SMMplan', isActive: true, domain: 'smmplan.local' },
    create: { id: 'smmplan', name: 'SMMplan', slug: 'smmplan', domain: 'smmplan.local', isActive: true, vaultSalt: 'smmplan-salt' }
  });
  console.log('✅ SMMplan tenant:', smmplanTenant.id);

  // 2. Update or create SMMflux tenant (slug: flux)
  let fluxTenant = await db.tenant.findUnique({ where: { slug: 'flux' } });
  if (!fluxTenant) {
    const lovable = await db.tenant.findUnique({ where: { slug: 'lovable' } });
    if (lovable) {
      fluxTenant = await db.tenant.update({
        where: { id: lovable.id },
        data: { slug: 'flux', name: 'SMMflux', domain: 'smmflux.local' }
      });
    } else {
      fluxTenant = await db.tenant.create({
        data: { id: 'flux', slug: 'flux', name: 'SMMflux', domain: 'smmflux.local', isActive: true, vaultSalt: 'flux-salt' }
      });
    }
  }
  console.log('✅ SMMflux tenant:', fluxTenant.id, 'slug:', fluxTenant.slug);

  // 3. Upsert SystemSettings for SMMplan
  await db.systemSettings.upsert({
    where: { id: smmplanTenant.id },
    update: { siteName: 'SMMplan', maintenanceMode: false },
    create: { id: smmplanTenant.id, siteName: 'SMMplan', isTestMode: false, maintenanceMode: false, taxRate: 6, opexMonthly: 0 }
  });
  console.log('✅ SMMplan systemSettings synced');

  // 4. Upsert SystemSettings for SMMflux
  await db.systemSettings.upsert({
    where: { id: fluxTenant.id },
    update: { siteName: 'SMMflux', maintenanceMode: false },
    create: { id: fluxTenant.id, siteName: 'SMMflux', isTestMode: false, maintenanceMode: false, taxRate: 6, opexMonthly: 0 }
  });
  console.log('✅ SMMflux systemSettings synced');

  // 5. Clean up Redis cached tenant and settings keys
  try {
    const { redis } = await import('../src/lib/redis');
    if (redis) {
      const keys = await redis.keys('settings:*');
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`✅ Cleared ${keys.length} cached Redis settings keys`);
      }
    }
  } catch (err) {
    console.warn('Redis cleanup skipped:', err);
  }

  console.log('🎉 Tenants and Settings successfully synchronized!');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
