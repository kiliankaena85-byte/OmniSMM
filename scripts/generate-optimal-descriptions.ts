/**
 * scripts/generate-optimal-descriptions.ts
 *
 * Generates 100% structured, human-friendly, high-converting descriptions
 * for all active services in the database according to the OmniSMM 1.0 standard:
 *
 * [Краткая суть услуги простым языком]
 *
 * Характеристики тарифа:
 * ⏱️ Старт: {диапазон времени}
 * ⚡ Скорость: {скорость в сутки}
 * 👤 Аудитория: {тип аудитории / качество}
 * 🛡️ Гарантия: {дни гарантии / автодокрутка}
 * 🔗 Формат ссылки: {требования к ссылке}
 *
 * Важно знать:
 * ⚠️ {правило приватности}
 * ⚠️ {правило неизменности ссылки и одновременных заказов}
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

interface ServiceMetadata {
  networkName: string;
  networkSlug: string;
  categoryName: string;
  activityType: string;
  serviceName: string;
  velocity?: number;
  warranty?: number;
  geo?: string;
  minQty: number;
  maxQty: number;
}

function buildOptimalDescription(meta: ServiceMetadata): string {
  const { networkName, categoryName, activityType, serviceName, velocity, warranty, geo, minQty, maxQty } = meta;
  const lowerName = serviceName.toLowerCase();

  // 1. Determine Start Time
  let startTime = '5–30 минут';
  if (lowerName.includes('моментальн') || lowerName.includes('быстрый старт') || lowerName.includes('мгновенн')) {
    startTime = '0–15 минут (мгновенный запуск)';
  } else if (lowerName.includes('эконом') || lowerName.includes('базовый')) {
    startTime = '15–60 минут';
  } else if (lowerName.includes('премиум') || lowerName.includes('живые')) {
    startTime = '10–45 минут';
  }

  // 2. Determine Velocity / Speed
  let speedText = 'до 3 000 – 5 000 в сутки (плавная подача)';
  if (velocity && velocity > 0) {
    const formatted = velocity >= 1000 ? `${Math.round(velocity / 1000)}k` : String(velocity);
    speedText = `до ${formatted} в сутки`;
  } else if (lowerName.includes('быстр') || lowerName.includes('моментальн')) {
    speedText = 'до 10 000 – 20 000 в сутки (высокая скорость)';
  } else if (lowerName.includes('эконом')) {
    speedText = 'до 1 000 – 3 000 в сутки';
  }

  // 3. Determine Audience / Quality
  let audienceText = 'Качественные профили с аватарками и активностью';
  if (geo && geo !== 'WORLDWIDE') {
    audienceText = `Реальные пользователи (${geo}) с заполненными профилями`;
  } else if (lowerName.includes('живые') || lowerName.includes('рф')) {
    audienceText = 'Живая аудитория (РФ и СНГ) с естественной активностью';
  } else if (lowerName.includes('премиум')) {
    audienceText = 'Премиум-профили высокого качества с высоким удержанием';
  } else if (lowerName.includes('эконом')) {
    audienceText = 'Офферные профили для быстрого набора стартовой массы';
  }

  // 4. Determine Warranty
  let warrantyText = 'Без гарантии';
  if (warranty && warranty > 0) {
    warrantyText = `${warranty} дней (автоматическая докрутка при списаниях)`;
  } else if (lowerName.includes('гаранти') || lowerName.includes('30')) {
    warrantyText = '30 дней (защита от списаний)';
  } else if (lowerName.includes('90')) {
    warrantyText = '90 дней (расширенная гарантия)';
  } else if (lowerName.includes('премиум') || lowerName.includes('живые')) {
    warrantyText = '30 дней (надежное удержание)';
  }

  // 5. Determine Link Format
  let linkFormat = 'Прямая ссылка на открытый профиль или канал';
  if (activityType === 'POSTS' || activityType === 'LIKES' || activityType === 'VIEWS' || activityType === 'REACTIONS' || lowerName.includes('лайк') || lowerName.includes('просмотр') || lowerName.includes('реакц')) {
    linkFormat = 'Прямая ссылка на конкретную публикацию / видео / пост';
  } else if (activityType === 'STORIES' || lowerName.includes('истори') || lowerName.includes('сторис')) {
    linkFormat = 'Ссылка на профиль с активными историями (Stories)';
  } else if (activityType === 'POLLS' || lowerName.includes('опрос') || lowerName.includes('голос')) {
    linkFormat = 'Ссылка на пост с опросом (укажите номер варианта ответа)';
  } else if (activityType === 'COMMENTS' || lowerName.includes('коммент')) {
    linkFormat = 'Ссылка на публикацию (укажите тексты комментариев)';
  } else if (activityType === 'STREAMS' || lowerName.includes('стрим') || lowerName.includes('зрител')) {
    linkFormat = 'Ссылка на активный прямой эфир / стрим';
  }

  // 6. Lead Paragraph
  let leadText = `Эффективное продвижение для вашего аккаунта в ${networkName}. Обеспечивает естественный рост метрик и повышает доверие аудитории.`;
  if (lowerName.includes('подписчик')) {
    leadText = `Качественное увеличение числа подписчиков для вашего канала/профиля в ${networkName}. Помогает быстро поднять статус сообщества и выйти в рекомендации.`;
  } else if (lowerName.includes('лайк')) {
    leadText = `Быстрое увеличение лайков на ваши публикации в ${networkName}. Повышает вовлеченность (ER) и выводит контент в тренды и топ ленты.`;
  } else if (lowerName.includes('просмотр')) {
    leadText = `Органические просмотры для ваших постов и видео в ${networkName}. Увеличивают общий охват и стимулируют попадание в рекомендации.`;
  } else if (lowerName.includes('реакци')) {
    leadText = `Позитивные реакции на посты в ${networkName}. Создают живую социальную активность и привлекают внимание новых читателей.`;
  } else if (lowerName.includes('коммент')) {
    leadText = `Осмысленные комментарии для ваших публикаций в ${networkName}. Активируют обсуждения под постами и повышают доверие к бренду.`;
  } else if (lowerName.includes('буст')) {
    leadText = `Бусты для вашего Telegram-канала. Открывают возможность публикации историй (Stories) и кастомных эмодзи.`;
  }

  return `${leadText}

Характеристики тарифа:
⏱️ Старт: ${startTime}
⚡ Скорость: ${speedText}
👤 Аудитория: ${audienceText}
🛡️ Гарантия: ${warrantyText}
🔗 Формат ссылки: ${linkFormat}

Важно знать:
⚠️ Профиль/канал/публикация должна быть открытой (не приватной) на всё время выполнения.
⚠️ Не меняйте ссылку (юзернейм) и не заказывайте продвижение на эту же ссылку в других сервисах одновременно.`;
}

async function main() {
  console.log('====================================================');
  console.log('  📝 SMMplan Master Description Generation Engine   ');
  console.log('====================================================\n');

  const services = await db.service.findMany({
    where: { isActive: true },
    include: {
      category: {
        include: { network: true },
      },
    },
    orderBy: { numericId: 'asc' },
  });

  console.log(`Generating optimal descriptions for ${services.length} active services...\n`);

  let updatedCount = 0;

  for (const s of services) {
    const feats = (s.features || {}) as Record<string, any>;

    const meta: ServiceMetadata = {
      networkName: s.category?.network?.name || 'Платформа',
      networkSlug: s.category?.network?.slug || 'other',
      categoryName: s.category?.name || 'Услуга',
      activityType: (s.category?.activityType || 'OTHER').toUpperCase(),
      serviceName: s.name,
      velocity: typeof s.velocity === 'number' ? s.velocity : typeof feats.velocity === 'number' ? feats.velocity : undefined,
      warranty: typeof s.warranty === 'number' ? s.warranty : typeof feats.warranty === 'number' ? feats.warranty : undefined,
      geo: typeof feats.geo === 'string' && feats.geo !== 'WORLDWIDE' ? feats.geo : undefined,
      minQty: s.minQty,
      maxQty: s.maxQty,
    };

    const newDescription = buildOptimalDescription(meta);

    await db.service.update({
      where: { id: s.id },
      data: { description: newDescription },
    });
    updatedCount++;
  }

  console.log(`✅ Successfully updated descriptions for all ${updatedCount} services!\n`);

  // Show samples
  const samples = await db.service.findMany({
    take: 3,
    where: { isActive: true },
    select: {
      numericId: true,
      name: true,
      description: true,
      category: { select: { name: true, network: { select: { name: true } } } },
    },
  });

  console.log('📋 Sample Generated Descriptions:\n');
  samples.forEach(s => {
    console.log(`--- [#${s.numericId}] ${s.name} (${s.category?.network?.name}) ---`);
    console.log(s.description);
    console.log('------------------------------------------------------------\n');
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
