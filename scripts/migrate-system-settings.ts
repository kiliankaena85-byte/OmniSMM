import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting settings migration...');
  const globalSettings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
  
  if (!globalSettings) {
    console.log('No global settings found to migrate. Creating default tenant settings.');
    // Create default smmplan settings
    await prisma.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: {},
      create: {
        id: 'smmplan',
        siteName: 'SMMplan',
        contactSupportEmail: 'support@smmplan.pro',
      }
    });
    // Create default lovable settings
    await prisma.systemSettings.upsert({
      where: { id: 'lovable' },
      update: {},
      create: {
        id: 'lovable',
        siteName: 'Lovable Boost',
        contactSupportEmail: 'support@lovable.pro',
      }
    });
    return;
  }

  console.log('Found global settings, migrating to smmplan and lovable...');
  const { id, ...settingsData } = globalSettings;

  // Upsert smmplan
  await prisma.systemSettings.upsert({
    where: { id: 'smmplan' },
    update: settingsData,
    create: { id: 'smmplan', ...settingsData }
  });

  // Upsert lovable (override siteName and contact fields for brand isolation)
  await prisma.systemSettings.upsert({
    where: { id: 'lovable' },
    update: {
      ...settingsData,
      siteName: 'Lovable Boost',
      contactSupportEmail: 'support@lovable.pro',
      contactPrivacyEmail: 'privacy@lovable.pro',
      contactTelegramBot: 'lovable_support_bot',
      contactTelegramChannel: 'lovable_support',
      legalCompanyName: 'Lovable Boost',
    },
    create: {
      id: 'lovable',
      ...settingsData,
      siteName: 'Lovable Boost',
      contactSupportEmail: 'support@lovable.pro',
      contactPrivacyEmail: 'privacy@lovable.pro',
      contactTelegramBot: 'lovable_support_bot',
      contactTelegramChannel: 'lovable_support',
      legalCompanyName: 'Lovable Boost',
    }
  });

  console.log('Settings migration completed successfully.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
