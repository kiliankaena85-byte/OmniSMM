import { db } from '../src/lib/db';

async function main() {
  const tenants = ['smmplan', 'flux'];
  for (const tenantId of tenants) {
    const s = await db.systemSettings.upsert({
      where: { id: tenantId },
      update: { maintenanceMode: true },
      create: {
        id: tenantId,
        maintenanceMode: true,
        siteName: tenantId === 'flux' ? 'SMMflux' : 'SMMplan',
        contactSupportEmail: tenantId === 'flux' ? 'support@smmflux.ru' : 'support@smmplan.pro',
        contactTelegramBot: tenantId === 'flux' ? 'smmflux_support_bot' : 'smmplan_support_bot',
      }
    });
    console.log('✅ Tenant:', tenantId, '| maintenanceMode:', s.maintenanceMode);
  }
  await db.$disconnect();
}

main().catch(console.error);
