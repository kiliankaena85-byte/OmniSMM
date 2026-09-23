import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DATABASE INSPECTION START ---');
  
  const tables = [
    'User',
    'Order',
    'Payment',
    'Ticket',
    'TicketMessage',
    'MessageAttachment',
    'Refill',
    'LedgerEntry',
    'LoginLog',
    'AnalyticsEvent',
    'AuditLog',
    'SystemSettings',
    'SystemSetting',
    'Provider',
    'Service',
    'Category',
    'Network',
    'PromoCode'
  ];

  console.log('\n--- ROW COUNTS ---');
  for (const table of tables) {
    try {
      const modelName = table.charAt(0).toLowerCase() + table.slice(1);
      const count = await (prisma as any)[modelName].count();
      console.log(`${table}: ${count}`);
    } catch (e: any) {
      console.log(`${table}: ERROR - ${e.message}`);
    }
  }

  console.log('\n--- SYSTEM SETTINGS ---');
  try {
    const settings = await prisma.systemSettings.findFirst();
    if (settings) {
      console.log('SystemSettings (global) exists:');
      console.log(`- isTestMode: ${settings.isTestMode}`);
      console.log(`- siteName: ${settings.siteName}`);
      console.log(`- exchangeRateUSD: ${settings.exchangeRateUSD}`);
      console.log(`- smtpHost: ${settings.smtpHost}`);
      console.log(`- smtpPort: ${settings.smtpPort}`);
      console.log(`- smtpUser: ${settings.smtpUser}`);
      console.log(`- smtpPassword (length): ${settings.smtpPassword ? settings.smtpPassword.length : 'null'}`);
      console.log(`- yookassaShopId: ${settings.yookassaShopId}`);
      console.log(`- yookassaSecretKey (length): ${settings.yookassaSecretKey ? settings.yookassaSecretKey.length : 'null'}`);
      console.log(`- yookassaTestShopId: ${settings.yookassaTestShopId}`);
      console.log(`- yookassaTestSecretKey (length): ${settings.yookassaTestSecretKey ? settings.yookassaTestSecretKey.length : 'null'}`);
      console.log(`- robokassaLogin: ${settings.robokassaLogin}`);
      console.log(`- robokassaPassword (length): ${settings.robokassaPassword ? settings.robokassaPassword.length : 'null'}`);
    } else {
      console.log('No global SystemSettings found.');
    }
  } catch (e: any) {
    console.error(`SystemSettings Read Error: ${e.message}`);
  }

  console.log('\n--- PROVIDERS ---');
  try {
    const providers = await prisma.provider.findMany();
    console.log(`Found ${providers.length} provider(s):`);
    for (const p of providers) {
      console.log(`- ID: ${p.id}, Name: ${p.name}, API URL: ${p.apiUrl}, Active: ${p.isActive}, Type: ${p.providerType}`);
    }
  } catch (e: any) {
    console.error(`Providers Read Error: ${e.message}`);
  }

  console.log('--- DATABASE INSPECTION END ---');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
