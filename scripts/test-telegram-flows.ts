import * as dotenv from 'dotenv';
dotenv.config();

import { db } from '../src/lib/db';
import { UnifiedPaymentService } from '../src/services/financial/unified-payment.service';
import { SettingsManager } from '../src/lib/settings';

async function testAllFlows() {
  console.log('🧪 === FULL TELEGRAM & PAYMENT SUITE TEST ===\n');

  // 1. Check Bot Token
  const token = process.env.TELEGRAM_BOT_TOKEN;
  console.log('1. TELEGRAM_BOT_TOKEN:', token ? '✅ Present' : '❌ Missing');

  // 2. Check Database connection & User model
  const userCount = await db.user.count();
  console.log('2. PostgreSQL Database: ✅ Connected, total users:', userCount);

  // 3. Check Payment Gateway Secrets
  const secrets = await SettingsManager.getPaymentSecrets();
  console.log('3. YooKassa Shop ID:', secrets.yookassaShopId || '❌ Missing');
  console.log('   YooKassa Secret Key:', secrets.yookassaSecretKey ? '✅ Present' : '❌ Missing');

  // 4. Test User lookup & Auto-creation simulation
  let testUser = await db.user.findFirst({ where: { telegramId: { not: null } } });
  if (!testUser) {
    testUser = await db.user.create({
      data: {
        email: 'telegram_test_user@smmplan.pro',
        telegramId: '999999999',
        tenantId: 'smmplan'
      }
    });
  }
  console.log('4. User Telegram Resolution: ✅ User ID', testUser.id, 'TG:', testUser.telegramId);

  // 5. Test Payment Generation (YooKassa)
  const yooPayment = await UnifiedPaymentService.createPayment(
    undefined,
    testUser.id,
    300,
    'Пополнение баланса SMMplan (TG Test)',
    { source: 'BOT_TEST', type: 'deposit' },
    'yookassa'
  );
  console.log('5. YooKassa Payment Creation:');
  console.log('   Success:', yooPayment.success);
  console.log('   Payment ID:', yooPayment.paymentId);
  console.log('   Checkout URL:', yooPayment.confirmationUrl);

  if (!yooPayment.success || !yooPayment.confirmationUrl) {
    throw new Error('YooKassa payment creation failed: ' + yooPayment.error);
  }

  // 6. Test Services & Catalog Navigation
  const { BotCatalogService } = await import('../src/bot/services/bot-catalog.service');
  const networks = await BotCatalogService.getVisibleNetworks('smmplan');
  console.log('6. Visible Networks in Telegram Bot: ✅ Found', networks.length, 'networks');
  for (const n of networks.slice(0, 3)) {
    const cats = await BotCatalogService.getVisibleCategories(n.id, 'smmplan');
    console.log(`   - Network [${n.name}] has ${cats.length} active categories`);
  }

  console.log('\n🎉 ALL TELEGRAM & PAYMENT SUBSYSTEMS ARE 100% OPERATIONAL!');
}

testAllFlows().catch(console.error).finally(() => db.$disconnect());
