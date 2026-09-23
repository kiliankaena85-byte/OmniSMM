import { db } from '../src/lib/db';

async function updateAllLegal() {
  const tenants = ['smmplan', 'flux'];
  for (const tenantId of tenants) {
    const s = await db.systemSettings.upsert({
      where: { id: tenantId },
      update: {
        maintenanceMode: true,
        legalCompanyName: 'ИП Соколов Артём Андреевич',
        legalCompanyInn: '695006320024',
        legalCompanyOgrnip: '324690000021650',
        legalCompanyAddress: 'Российская Федерация, Тверская область, г. Тверь',
      },
      create: {
        id: tenantId,
        maintenanceMode: true,
        siteName: tenantId === 'flux' ? 'SMMflux' : 'SMMplan',
        legalCompanyName: 'ИП Соколов Артём Андреевич',
        legalCompanyInn: '695006320024',
        legalCompanyOgrnip: '324690000021650',
        legalCompanyAddress: 'Российская Федерация, Тверская область, г. Тверь',
        contactSupportEmail: tenantId === 'flux' ? 'support@smmflux.ru' : 'support@smmplan.pro',
        contactTelegramBot: tenantId === 'flux' ? 'smmflux_support_bot' : 'smmplan_support_bot',
      }
    });
    console.log('✅ Updated SystemSettings for tenant:', tenantId, {
      legalCompanyName: s.legalCompanyName,
      legalCompanyInn: s.legalCompanyInn,
      legalCompanyOgrnip: s.legalCompanyOgrnip,
      maintenanceMode: s.maintenanceMode
    });
  }
  await db.$disconnect();
}

updateAllLegal().catch(console.error);
