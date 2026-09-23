import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { VaultService } from '../src/lib/vault';
import { UniversalProvider } from '../src/services/providers/universal.provider';
import { SettingsProvider } from '../src/lib/settings';
import { applyBeautifulRounding } from '../src/lib/financial-constants';

const prisma = new PrismaClient();

async function main() {
  console.log('🤖 Starting Cherry-Pick Process for 1 Service...');

  const provider = await prisma.provider.findFirst({ where: { isActive: true } });
  if (!provider) throw new Error('No active provider found');

  const targetServiceId = 991;
  const rawRate = 5.7712;
  const targetMin = 10;
  const targetMax = 1000000;

  console.log(`📌 Found candidate service: ID ${targetServiceId} - Instagram Сохранения [Быстрый старт]`);

  // AI Rewritten Content
  const rebranded = {
    newName: "Сохранения Instagram (Быстрый старт)",
    newDescription: "⚡️ **Запуск:** Моментальный\n🚀 **Скорость:** Высокая\n💧 **Качество:** Активные профили\n🛡 **Гарантия:** Без списаний"
  };

  console.log(`✅ Rewritten Name: ${rebranded.newName}`);
  console.log(`✅ Rewritten Desc:\n${rebranded.newDescription}\n`);

  let category = await prisma.category.findFirst({ where: { network: { slug: 'instagram' } } });
  if (!category) {
      category = await prisma.category.findFirst();
  }
  if (!category) {
      throw new Error('No categories found in DB to attach the service');
  }

  const markup = 4.0; // 300% markup (cost + 300%)
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
  const usdToRub = settings?.exchangeRateUSD || 95;
  const pricePer1000Cents = Math.round(applyBeautifulRounding(rawRate * markup * usdToRub) * 100);

  console.log(`💾 Saving to DB with markup ${markup}x...`);
  const newService = await prisma.service.create({
    data: {
      name: rebranded.newName,
      description: rebranded.newDescription,
      externalId: String(targetServiceId),
      categoryId: category.id,
      providerId: provider.id,
      rate: rawRate,
      markup: markup,
      pricePer1000Cents: pricePer1000Cents,
      minQty: targetMin,
      maxQty: targetMax,
      isActive: true,
      isDripFeedEnabled: false,
      isRefillEnabled: false,
      isCancelEnabled: false,
      lastSeenAt: new Date(),
    }
  });

  console.log(`🎉 Successfully imported Service ID: ${newService.id} (External: ${newService.externalId})`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
