import * as dotenv from 'dotenv';
dotenv.config();

import { db } from '../src/lib/db';
import { tenantVisibilityFilter } from '../src/lib/tenant-scope';

async function main() {
  console.log('=== 1. TENANT BREAKDOWN IN DATABASE ===');
  
  const services = await db.service.groupBy({
    by: ['tenantId', 'isActive', 'isQuarantined'],
    _count: { _all: true }
  });
  console.log('Services by Tenant:', services);

  const categories = await db.category.groupBy({
    by: ['tenantId', 'isActive'],
    _count: { _all: true }
  });
  console.log('Categories by Tenant:', categories);

  const networks = await db.network.groupBy({
    by: ['tenantId', 'isActive'],
    _count: { _all: true }
  });
  console.log('Networks by Tenant:', networks);

  console.log('\n=== 2. BOT TENANT CONFIGURATION ===');
  console.log('BOT_TENANT_ID in process.env:', process.env.BOT_TENANT_ID || '(default: smmplan)');

  console.log('\n=== 3. HOW SMMFLUX VS SMMPLAN SEES CATALOG ===');
  const fluxTenant = tenantVisibilityFilter('flux');
  const planTenant = tenantVisibilityFilter('smmplan');
  console.log('tenantVisibilityFilter("flux"):', fluxTenant);
  console.log('tenantVisibilityFilter("smmplan"):', planTenant);

  const fluxServicesCount = await db.service.count({
    where: { tenantId: fluxTenant, isActive: true, isQuarantined: false }
  });
  const planServicesCount = await db.service.count({
    where: { tenantId: planTenant, isActive: true, isQuarantined: false }
  });

  console.log(`Active Services for SMMflux ('flux'): ${fluxServicesCount}`);
  console.log(`Active Services for SMMplan ('smmplan'): ${planServicesCount}`);
}

main().catch(console.error).finally(() => db.$disconnect());
