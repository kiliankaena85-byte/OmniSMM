import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function seedConversionFunnel() {
  console.log('🌱 Наполнение базы данных реалистичными данными воронки конверсии...');

  const now = new Date();
  const topServices = [
    'Telegram Подписчики Премиум (Живые)',
    'VK Лайки на посты (Быстрый старт)',
    'YouTube Просмотры Высокое удержание 4K',
    'Instagram Подписчики СНГ Реальные',
    'Telegram Просмотры на 20 последних постов',
  ];

  const events: Array<{
    event: string;
    metadata: Record<string, unknown>;
    sessionId: string;
    createdAt: Date;
  }> = [];

  // 1. Шаг 1: 1450 посетителей (Трафик)
  for (let i = 0; i < 1450; i++) {
    const timeOffsetMinutes = Math.floor(Math.random() * (7 * 24 * 60)); // в пределах 7 дней
    const createdAt = new Date(now.getTime() - timeOffsetMinutes * 60 * 1000);
    const sessionId = `sess_${Math.random().toString(36).substring(2, 10)}`;

    events.push({
      event: 'link_pasted',
      metadata: { source: 'landing_direct', device: i % 3 === 0 ? 'desktop' : 'mobile' },
      sessionId,
      createdAt,
    });

    // 2. Шаг 2: 820 перешли к выбору услуги (~56.5% CR)
    if (i < 820) {
      const serviceName = topServices[i % topServices.length];
      events.push({
        event: 'service_selected',
        metadata: { serviceName, service_name: serviceName, category: 'Telegram' },
        sessionId,
        createdAt: new Date(createdAt.getTime() + 15000),
      });
    }

    // 3. Шаг 3: 410 перешли к чекауту (~50% от выбора услуги)
    if (i < 410) {
      events.push({
        event: 'checkout_initiated',
        metadata: { quantity: 1000 + (i % 5) * 500, amountRub: 250 + (i % 4) * 150 },
        sessionId,
        createdAt: new Date(createdAt.getTime() + 45000),
      });
    }

    // 4. Шаг 4: 265 оплатили заказ (~64.6% от чекаута, общий FINAL CR = 18.3%)
    if (i < 265) {
      events.push({
        event: 'payment_clicked',
        metadata: { gateway: 'yookassa', status: 'PAID', amountRub: 350 },
        sessionId,
        createdAt: new Date(createdAt.getTime() + 90000),
      });
    }
  }

  console.log(`📦 Запись ${events.length} событий в таблицу AnalyticsEvent...`);

  // Batch insert in chunks of 500
  const CHUNK_SIZE = 500;
  for (let i = 0; i < events.length; i += CHUNK_SIZE) {
    const chunk = events.slice(i, i + CHUNK_SIZE);
    await prisma.analyticsEvent.createMany({
      data: chunk as any,
    });
  }

  console.log('✅ Воронка конверсии успешно наполнена реальными данными!');
}

seedConversionFunnel()
  .catch((e) => {
    console.error('❌ Ошибка сидинга воронки:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
