import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database production sanitization...');

  // 0. Disable the LedgerEntry mutation trigger to allow deleting
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "LedgerEntry" DISABLE TRIGGER no_update_delete_ledger;');
    console.log('[TRIGGER] Disabled no_update_delete_ledger trigger on LedgerEntry.');
  } catch (error: any) {
    console.warn('[TRIGGER] Failed or skipped disabling trigger (might not exist in this environment):', error.message);
  }

  // 1. Transactional tables to empty in dependency order
  const tablesToEmpty = [
    { name: 'SmartDetectedUser', model: prisma.smartDetectedUser },
    { name: 'SmartSnapshot', model: prisma.smartSnapshot },
    { name: 'SmartChannelMetric', model: prisma.smartChannelMetric },
    { name: 'SmartExecution', model: prisma.smartExecution },
    { name: 'SmartTask', model: prisma.smartTask },
    { name: 'SmartCampaign', model: prisma.smartCampaign },
    { name: 'SecurityEvent', model: prisma.securityEvent },
    { name: 'PromoCodeUsage', model: prisma.promoCodeUsage },
    { name: 'Commission', model: prisma.commission },
    { name: 'LedgerEntry', model: prisma.ledgerEntry },
    { name: 'AdminAuditLog', model: prisma.adminAuditLog },
    { name: 'AuditLog', model: prisma.auditLog },
    { name: 'LoginLog', model: prisma.loginLog },
    { name: 'RoutingAuditLog', model: prisma.routingAuditLog },
    { name: 'RateLimit', model: prisma.rateLimit },
    { name: 'AnalyticsEvent', model: prisma.analyticsEvent },
    { name: 'Session', model: prisma.session },
    { name: 'AuthToken', model: prisma.authToken },
    { name: 'MessageAttachment', model: prisma.messageAttachment },
    { name: 'TicketMessage', model: prisma.ticketMessage },
    { name: 'Ticket', model: prisma.ticket },
    { name: 'Invoice', model: prisma.invoice },
    { name: 'Refill', model: prisma.refill },
    { name: 'Order', model: prisma.order },
    { name: 'Payment', model: prisma.payment },
    { name: 'ApiConfig', model: prisma.apiConfig },
  ];

  const deletionCounts: Record<string, number> = {};

  for (const table of tablesToEmpty) {
    if (!table.model) { continue; }
    try {
      const result = await (table.model as any).deleteMany({});
      deletionCounts[table.name] = result.count;
      console.log(`[EMPTY] Table ${table.name}: deleted ${result.count} records.`);
    } catch (error) {
      console.error(`[ERROR] Failed to empty table ${table.name}:`, error);
      throw error;
    }
  }

  // Re-enable the LedgerEntry mutation trigger immediately after deletions
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "LedgerEntry" ENABLE TRIGGER no_update_delete_ledger;');
    console.log('[TRIGGER] Re-enabled no_update_delete_ledger trigger on LedgerEntry.');
  } catch (error: any) {
    console.warn('[TRIGGER] Failed to re-enable trigger:', error.message);
  }

  // 2. Delete non-OWNER/ADMIN users
  let deletedUsersCount: number;
  try {
    const result = await prisma.user.deleteMany({
      where: {
        NOT: {
          role: {
            in: ['OWNER', 'ADMIN'],
          },
        },
      },
    });
    deletedUsersCount = result.count;
    console.log(`[DELETE] Users table: deleted ${deletedUsersCount} non-staff users.`);
  } catch (error) {
    console.error('[ERROR] Failed to delete non-staff users:', error);
    throw error;
  }

  // 3. Update SystemSettings (row with id='global')
  let systemSettingsUpdated = 0;
  try {
    const systemSettings = await prisma.systemSettings.findUnique({
      where: { id: 'global' },
    });
    if (systemSettings) {
      const updateData: any = {};
      let hasChanges = false;
      for (const [key, value] of Object.entries(systemSettings)) {
        if (typeof value === 'string') {
          if (value.includes('http://localhost:3000') || value.includes('http://127.0.0.1:3000')) {
            updateData[key] = value
              .replace(/http:\/\/localhost:3000/g, 'https://smmplan.pro')
              .replace(/http:\/\/127\.0\.0\.1:3000/g, 'https://smmplan.pro');
            hasChanges = true;
          }
        }
      }
      if (hasChanges) {
        await prisma.systemSettings.update({
          where: { id: 'global' },
          data: updateData,
        });
        systemSettingsUpdated = 1;
        console.log('[UPDATE] Global SystemSettings: updated local URLs to https://smmplan.pro.');
      } else {
        console.log('[UPDATE] Global SystemSettings: no local URLs detected.');
      }
    } else {
      console.log('[UPDATE] Global SystemSettings: global settings row not found.');
    }
  } catch (error) {
    console.error('[ERROR] Failed to update SystemSettings:', error);
    throw error;
  }

  // 4. Update SystemSetting key-value table
  let systemSettingUpdatedCount = 0;
  try {
    const settings = await prisma.systemSetting.findMany();
    for (const setting of settings) {
      if (setting.value && (setting.value.includes('http://localhost:3000') || setting.value.includes('http://127.0.0.1:3000'))) {
        const newValue = setting.value
          .replace(/http:\/\/localhost:3000/g, 'https://smmplan.pro')
          .replace(/http:\/\/127\.0\.0\.1:3000/g, 'https://smmplan.pro');
        await prisma.systemSetting.update({
          where: { key: setting.key },
          data: { value: newValue },
        });
        systemSettingUpdatedCount++;
      }
    }
    console.log(`[UPDATE] SystemSetting key-value table: updated ${systemSettingUpdatedCount} settings.`);
  } catch (error) {
    console.error('[ERROR] Failed to update SystemSetting:', error);
    throw error;
  }

  // 5. Update Provider table
  let providersUpdatedCount = 0;
  try {
    const providers = await prisma.provider.findMany();
    for (const provider of providers) {
      if (provider.apiUrl && (provider.apiUrl.includes('localhost:3000') || provider.apiUrl.includes('127.0.0.1:3000'))) {
        let newApiUrl = provider.apiUrl;
        if (newApiUrl.includes('http://localhost:3000')) {
          newApiUrl = newApiUrl.replace(/http:\/\/localhost:3000/g, 'https://smmplan.pro');
        } else if (newApiUrl.includes('https://localhost:3000')) {
          newApiUrl = newApiUrl.replace(/https:\/\/localhost:3000/g, 'https://smmplan.pro');
        } else if (newApiUrl.includes('localhost:3000')) {
          newApiUrl = newApiUrl.replace(/localhost:3000/g, 'https://smmplan.pro');
        }

        if (newApiUrl.includes('http://127.0.0.1:3000')) {
          newApiUrl = newApiUrl.replace(/http:\/\/127\.0\.0\.1:3000/g, 'https://smmplan.pro');
        } else if (newApiUrl.includes('https://127.0.0.1:3000')) {
          newApiUrl = newApiUrl.replace(/https:\/\/127\.0\.0\.1:3000/g, 'https://smmplan.pro');
        } else if (newApiUrl.includes('127.0.0.1:3000')) {
          newApiUrl = newApiUrl.replace(/127\.0\.0\.1:3000/g, 'https://smmplan.pro');
        }

        await prisma.provider.update({
          where: { id: provider.id },
          data: { apiUrl: newApiUrl },
        });
        providersUpdatedCount++;
        console.log(`[UPDATE] Provider ${provider.name}: updated API URL to ${newApiUrl}.`);
      }
    }
    console.log(`[UPDATE] Provider table: updated ${providersUpdatedCount} providers.`);
  } catch (error) {
    console.error('[ERROR] Failed to update Provider table:', error);
    throw error;
  }

  console.log('\n--- SANITIZATION SUMMARY ---');
  console.log('Deletion counts by table:');
  console.log(JSON.stringify(deletionCounts, null, 2));
  console.log(`Deleted Non-Staff Users: ${deletedUsersCount}`);
  console.log(`Updated Global SystemSettings: ${systemSettingsUpdated}`);
  console.log(`Updated Key-Value Settings: ${systemSettingUpdatedCount}`);
  console.log(`Updated Providers: ${providersUpdatedCount}`);
  console.log('----------------------------\n');
  console.log('DB Sanitization completed successfully.');
}

main()
  .catch((e) => {
    console.error('Sanitization script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
