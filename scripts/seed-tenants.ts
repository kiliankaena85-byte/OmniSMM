import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding tenants and system settings...');

  // 1. Create SMMplan Tenant & settings
  const smmplanSalt = crypto.randomBytes(32).toString('hex');
  const smmplanTenant = await prisma.tenant.upsert({
    where: { id: 'smmplan' },
    update: {},
    create: {
      id: 'smmplan',
      name: 'SMMplan',
      slug: 'smmplan',
      domain: 'smmplan.pro',
      vaultSalt: smmplanSalt,
      isActive: true
    }
  });

  await prisma.systemSettings.upsert({
    where: { id: 'smmplan' },
    update: {},
    create: {
      id: 'smmplan',
      siteName: 'SMMplan',
      siteDescription: 'Панель продвижения SMMplan',
      taxRate: 6.0,
      exchangeRateUSD: 95.0,
      contactSupportEmail: 'support@smmplan.pro',
      contactPrivacyEmail: 'privacy@smmplan.pro',
      contactTelegramBot: 'smmplan_support_bot',
      contactTelegramChannel: 'smmplan_support',
      legalCompanyName: 'ИП Соколов Артём Андреевич',
      legalCompanyInn: '695006320024',
      legalCompanyAddress: 'Российская Федерация, Тверская область, г. Тверь',
    }
  });

  // 2. Create Lovable Tenant & settings
  const lovableSalt = crypto.randomBytes(32).toString('hex');
  const lovableTenant = await prisma.tenant.upsert({
    where: { id: 'lovable' },
    update: {},
    create: {
      id: 'lovable',
      name: 'Lovable Boost',
      slug: 'lovable',
      domain: 'lovable.pro',
      vaultSalt: lovableSalt,
      isActive: true
    }
  });

  await prisma.systemSettings.upsert({
    where: { id: 'lovable' },
    update: {},
    create: {
      id: 'lovable',
      siteName: 'Lovable Boost',
      siteDescription: 'Premium Social Growth Platform',
      taxRate: 6.0,
      exchangeRateUSD: 95.0,
      contactSupportEmail: 'support@lovable.pro',
      contactPrivacyEmail: 'privacy@lovable.pro',
      contactTelegramBot: 'lovable_support_bot',
      contactTelegramChannel: 'lovable_support',
      legalCompanyName: 'Lovable Inc',
    }
  });

  console.log('Seeding finished successfully.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
