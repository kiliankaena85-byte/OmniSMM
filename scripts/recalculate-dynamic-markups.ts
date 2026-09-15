import { PrismaClient } from '@prisma/client';
import { applyBeautifulRounding } from '../src/lib/financial-constants';

const prisma = new PrismaClient();

async function main() {
  console.log('=== РАСЧЕТ ДИНАМИЧЕСКИХ НАЦЕНОК (CHERRY-PICK CFO ENGINE) ===\n');

  const usdToRub = 95.0; // Standard exchange rate for local dev
  const services = await prisma.service.findMany({
    include: { category: { include: { network: true } } }
  });

  if (services.length === 0) {
    console.log('❌ Нет услуг в базе данных. Сначала запустите: npm run db:seed-mock');
    return;
  }

  console.log(`Найдено ${services.length} услуг для переоценки...\n`);
  let updatedCount = 0;

  for (const s of services) {
    const costRub = s.rate * usdToRub; // Cost per 1000 in RUB
    // eslint-disable-next-line no-useless-assignment
    let newMarkup = 1.6; // Default fallback

    // --- 4-TIER DYNAMIC SEGMENTED PRICING MODEL ---
    if (costRub < 5.0) {
      // Tier 1: Микро-услуги (себестоимость < 5 руб за 1000 шт)
      // Минимальная розничная цена за 1000 шт — 15 руб (защита от стоимости поддержки)
      // Либо наценка минимум 500% (коэффициент 6.0)
      newMarkup = Math.max(15.0 / costRub, 6.0);
    } else if (costRub < 50.0) {
      // Tier 2: Бюджетные (себестоимость 5 - 50 руб за 1000 шт)
      // Наценка 150% - 500% (коэффициент 3.5)
      newMarkup = 3.5;
    } else if (costRub < 300.0) {
      // Tier 3: Стандартные (себестоимость 50 - 300 руб за 1000 шт)
      // Наценка 60% - 150% (коэффициент 1.8)
      newMarkup = 1.8;
    } else {
      // Tier 4: Премиум (себестоимость > 300 руб за 1000 шт)
      // Наценка 30% - 60% (коэффициент 1.4 для сохранения конкурентоспособности API)
      newMarkup = 1.4;
    }

    // Limit maximum markup multiplier to x151 (15000% markup) to prevent near-zero rates
    if (newMarkup > 151.0) {
      newMarkup = 151.0;
    }

    const oldPrice = applyBeautifulRounding(s.rate * s.markup * usdToRub);
    const newPrice = applyBeautifulRounding(s.rate * newMarkup * usdToRub);

    await prisma.service.update({
      where: { id: s.id },
      data: {
        markup: newMarkup,
        pricePer1000Cents: Math.round(newPrice * 100)
      }
    });

    updatedCount++;
    console.log(
      `Service: "${s.name}" (${s.category?.network?.name || 'Social'})\n` +
      `  • Себестоимость: ${(costRub).toFixed(4)} ₽ / 1k\n` +
      `  • Наценка:  ${(s.markup * 100 - 100).toFixed(0)}% (${s.markup.toFixed(2)}) → ${(newMarkup * 100 - 100).toFixed(0)}% (${newMarkup.toFixed(2)})\n` +
      `  • Розница:  ${oldPrice.toFixed(2)} ₽ → ${newPrice.toFixed(2)} ₽ / 1k (${(newPrice / 1000).toFixed(4)} ₽/шт)\n`
    );
  }

  console.log(`\n🎉 Переоценка завершена! Обновлено услуг: ${updatedCount}.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
