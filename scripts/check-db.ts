import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting DB state verification...');
  let failed = false;

  // 1. Check transactional tables are empty
  const tablesToCheck = [
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

  console.log('\n--- 1. Transactional Tables Verification ---');
  for (const table of tablesToCheck) {
    if (!table.model) { continue; }
    try {
      const count = await (table.model as any).count();
      if (count > 0) {
        console.error(`[FAIL] Table ${table.name} has ${count} records. Should be 0.`);
        failed = true;
      } else {
        console.log(`[PASS] Table ${table.name} is empty (0 records).`);
      }
    } catch (e: any) {
      console.error(`[ERROR] Table ${table.name} failed to count: ${e.message}`);
      failed = true;
    }
  }

  // 2. Check users role
  console.log('\n--- 2. Users Verification ---');
  try {
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
      },
    });
    const disallowedUsers = allUsers.filter((u) => !['OWNER', 'ADMIN'].includes(u.role));
    if (disallowedUsers.length > 0) {
      console.error(`[FAIL] Found ${disallowedUsers.length} disallowed users (roles: ${disallowedUsers.map((u) => u.role).join(', ')}):`);
      disallowedUsers.forEach((u) => console.error(`  - ID: ${u.id}, Email: ${u.email}, Role: ${u.role}`));
      failed = true;
    } else {
      console.log(`[PASS] Users list contains ONLY OWNER or ADMIN users (${allUsers.length} total).`);
      allUsers.forEach((u) => console.log(`  - Email: ${u.email}, Role: ${u.role}`));
    }
  } catch (e: any) {
    console.error(`[ERROR] Users verification failed: ${e.message}`);
    failed = true;
  }

  // 3. Check SystemSettings and SystemSetting domain replacement
  console.log('\n--- 3. Settings Domain Verification ---');
  try {
    const systemSettings = await prisma.systemSettings.findUnique({
      where: { id: 'global' },
    });
    if (systemSettings) {
      let settingsFoundLocalhost = false;
      for (const [key, value] of Object.entries(systemSettings)) {
        if (typeof value === 'string') {
          if (value.includes('localhost:3000') || value.includes('127.0.0.1:3000')) {
            console.error(`[FAIL] SystemSettings contains local domain in field "${key}": ${value}`);
            failed = true;
            settingsFoundLocalhost = true;
          }
        }
      }
      if (!settingsFoundLocalhost) {
        console.log('[PASS] Global SystemSettings does not contain any localhost/127.0.0.1 references.');
      }
    } else {
      console.log('[INFO] Global SystemSettings row not found.');
    }
  } catch (e: any) {
    console.error(`[ERROR] SystemSettings domain verification failed: ${e.message}`);
    failed = true;
  }

  try {
    const systemSettingsKV = await prisma.systemSetting.findMany();
    let kvFoundLocalhost = false;
    for (const setting of systemSettingsKV) {
      if (setting.value && (setting.value.includes('localhost:3000') || setting.value.includes('127.0.0.1:3000'))) {
        console.error(`[FAIL] SystemSetting key "${setting.key}" contains local domain: ${setting.value}`);
        failed = true;
        kvFoundLocalhost = true;
      }
    }
    if (!kvFoundLocalhost) {
      console.log('[PASS] SystemSetting key-value table does not contain any localhost/127.0.0.1 references.');
    }
  } catch (e: any) {
    console.error(`[ERROR] SystemSetting KV domain verification failed: ${e.message}`);
    failed = true;
  }

  // 4. Check Provider API URLs
  console.log('\n--- 4. Providers Verification ---');
  try {
    const providers = await prisma.provider.findMany();
    let providerFoundLocalhost = false;
    if (providers.length === 0) {
      console.log('[INFO] No providers in table.');
    } else {
      console.log(`Found ${providers.length} providers. Inspecting API URLs:`);
      for (const provider of providers) {
        console.log(`  - Provider "${provider.name}": URL is "${provider.apiUrl}"`);
        if (provider.apiUrl && (provider.apiUrl.includes('localhost:3000') || provider.apiUrl.includes('127.0.0.1:3000'))) {
          console.error(`[FAIL] Provider "${provider.name}" contains local domain in apiUrl: ${provider.apiUrl}`);
          failed = true;
          providerFoundLocalhost = true;
        }
      }
    }
    if (!providerFoundLocalhost && providers.length > 0) {
      console.log('[PASS] All providers have correct non-local API URLs.');
    }
  } catch (e: any) {
    console.error(`[ERROR] Providers verification failed: ${e.message}`);
    failed = true;
  }

  console.log('\n---------------------------------------');
  if (failed) {
    console.error('VERIFICATION FAILED: Anomaly detected in DB state!');
    process.exit(1);
  } else {
    console.log('VERIFICATION PASSED: Database is successfully sanitized and verified.');
  }
}

main()
  .catch((e) => {
    console.error('Verification script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
