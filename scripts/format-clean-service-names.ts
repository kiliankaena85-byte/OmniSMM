/**
 * scripts/format-clean-service-names.ts
 *
 * Implements clean, human-friendly service names strictly following the format:
 *   "{Действие} - {Тариф}"
 *
 * Examples:
 *   "Подписчики - Стандарт"
 *   "Подписчики - Живые"
 *   "Подписчики - Эконом"
 *   "Подписчики - Премиум"
 *   "Подписчики - С гарантией 30 дней"
 *   "Лайки - Стандарт"
 *   "Лайки - Моментальные"
 *   "Лайки - Живые"
 *   "Просмотры - Стандарт"
 *   "Просмотры - Быстрый старт"
 *   "Реакции - Позитивные"
 *   "Реакции - Стандарт"
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const ACTION_MAP: Record<string, string> = {
  SUBSCRIBERS: 'Подписчики',
  GROUPS: 'Подписчики',
  LIKES: 'Лайки',
  VIEWS: 'Просмотры',
  COMMENTS: 'Комментарии',
  REACTIONS: 'Реакции',
  REPOSTS: 'Репосты',
  AUTO_VIEWS: 'Автопросмотры',
  AUTO_LIKES: 'Автолайки',
  AUTO_REACTIONS: 'Автореакции',
  AUTO_REPOSTS: 'Авторепосты',
  AUTO_COMMENTS: 'Автокомментарии',
  BOOSTS: 'Бусты',
  POLLS: 'Голоса',
  STORIES: 'Истории',
  BOTS: 'Боты',
  REFERRALS: 'Рефералы',
  FRIENDS: 'Друзья',
  PLAYS: 'Прослушивания',
  TRAFFIC: 'Трафик',
  DISLIKES: 'Дизлайки',
  STARS: 'Звёзды',
  SAVES: 'Сохранения',
  COMPLAINTS: 'Жалобы',
  STREAMS: 'Зрители',
  PREMIUM: 'Премиум',
  RECOVER: 'Восстановление',
  OTHER: 'Продвижение',
};

function getActionWord(category: { name: string; activityType: string | null } | null): string {
  if (!category) return 'Услуга';
  if (category.activityType && ACTION_MAP[category.activityType]) {
    return ACTION_MAP[category.activityType];
  }

  const catLower = category.name.toLowerCase();
  if (catLower.includes('подпис') || catLower.includes('участник') || catLower.includes('фолловер') || catLower.includes('читател')) return 'Подписчики';
  if (catLower.includes('лайк') || catLower.includes('класс') || catLower.includes('нравится')) return 'Лайки';
  if (catLower.includes('просмотр') || catLower.includes('охват') || catLower.includes('дочитыван')) return 'Просмотры';
  if (catLower.includes('реакц') || catLower.includes('эмодзи')) return 'Реакции';
  if (catLower.includes('коммент') || catLower.includes('отзыв')) return 'Комментарии';
  if (catLower.includes('репост') || catLower.includes('подели')) return 'Репосты';
  if (catLower.includes('буст')) return 'Бусты';
  if (catLower.includes('бот')) return 'Боты';
  if (catLower.includes('опрос') || catLower.includes('голос')) return 'Голоса';
  if (catLower.includes('истори') || catLower.includes('сторис')) return 'Истории';
  if (catLower.includes('зрител') || catLower.includes('стрим')) return 'Зрители';
  if (catLower.includes('звезд') || catLower.includes('stars')) return 'Звёзды';
  if (catLower.includes('сохран')) return 'Сохранения';
  if (catLower.includes('друг')) return 'Друзья';
  if (catLower.includes('слуш') || catLower.includes('трек')) return 'Прослушивания';

  return category.name.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim() || 'Услуга';
}

function detectTariffDescriptor(name: string, description: string = '', features: any = {}): string {
  const text = (name + ' ' + description).toLowerCase();

  const isLive = text.includes('живые') || text.includes('real') || text.includes('живая') || text.includes('human') || text.includes('реальные');
  const isPremium = text.includes('премиум') || text.includes('premium') || text.includes('hq') || text.includes('high quality') || text.includes('vip') || text.includes('элит');
  const isEconomy = text.includes('эконом') || text.includes('econom') || text.includes('дешев') || text.includes('cheap') || text.includes('low');
  const isInstant = text.includes('моментальн') || text.includes('instant') || text.includes('мгновенн') || text.includes('быстрый старт') || text.includes('fast');
  const isRU = text.includes('россия') || text.includes('рф') || text.includes('русские') || text.includes('ru');
  const isWarranty = text.includes('гаранти') || text.includes('refill') || text.includes('без списаний') || text.includes('no drop') || (features.warranty && features.warranty > 0);
  const isCustom = text.includes('свои') || text.includes('кастом') || text.includes('custom') || text.includes('заказн');
  const isPositive = text.includes('позитивн') || text.includes('positive') || text.includes('лайк') || text.includes('fire') || text.includes('огонь');
  const isNegative = text.includes('негативн') || text.includes('дизлайк') || text.includes('жалоб');

  // Warranty days
  const warrantyDays = features.warranty || (text.match(/(\d+)\s*(?:дней|дня|день|day|d)/i)?.[1]);

  if (isCustom) return 'Свои тексты';
  if (isPositive && !isLive) return 'Позитивные';
  if (isNegative) return 'Негативные';

  if (isLive && isRU) return 'Живые (РФ)';
  if (isLive) return 'Живые';

  if (isPremium && warrantyDays) return `Премиум (Гарантия ${warrantyDays}д)`;
  if (isPremium) return 'Премиум';

  if (isWarranty && warrantyDays) return `С гарантией ${warrantyDays} дней`;
  if (isWarranty) return 'С гарантией';

  if (isInstant) return 'Быстрый старт';
  if (isEconomy) return 'Эконом';

  if (text.includes('усиленн') || text.includes('boosted')) return 'Усиленный';
  if (text.includes('оптимальн') || text.includes('optimal')) return 'Оптимальный';

  return 'Стандарт';
}

async function main() {
  console.log('====================================================');
  console.log('  ✨ Applying Clean Format: "{Действие} - {Тариф}"  ');
  console.log('====================================================\n');

  const services = await db.service.findMany({
    where: { isActive: true },
    include: {
      category: {
        include: { network: true },
      },
    },
    orderBy: [{ categoryId: 'asc' }, { rate: 'asc' }],
  });

  console.log(`Auditing and formatting ${services.length} active services...\n`);

  // Group by category to ensure uniqueness of tariff names
  const byCategory = new Map<string, typeof services>();
  for (const s of services) {
    if (!byCategory.has(s.categoryId)) {
      byCategory.set(s.categoryId, []);
    }
    byCategory.get(s.categoryId)!.push(s);
  }

  let updatedCount = 0;
  const standardTierLadder = [
    'Стандарт',
    'Быстрый старт',
    'Оптимальный',
    'Усиленный',
    'Живые',
    'Премиум',
    'С гарантией 30 дней',
    'С гарантией 90 дней',
    'Элит',
    'VIP',
    'Максимальный',
    'Экстра'
  ];

  for (const [catId, catServices] of byCategory.entries()) {
    const actionWord = getActionWord(catServices[0].category);
    
    // Sort by price ascending
    catServices.sort((a, b) => a.rate - b.rate);

    // Track used names in this category
    const usedNames = new Set<string>();

    for (let i = 0; i < catServices.length; i++) {
      const s = catServices[i];
      let descriptor = detectTariffDescriptor(s.name, s.description || '', s.features || {});

      let formattedName = `${actionWord} - ${descriptor}`;

      // If collision occurs within the same category, pick from ladder or add distinctive badge
      if (usedNames.has(formattedName)) {
        // Try fallback options based on price index
        let resolved = false;
        for (const fallbackDescriptor of standardTierLadder) {
          const candidate = `${actionWord} - ${fallbackDescriptor}`;
          if (!usedNames.has(candidate)) {
            formattedName = candidate;
            resolved = true;
            break;
          }
        }

        if (!resolved) {
          formattedName = `${actionWord} - Тариф #${i + 1}`;
        }
      }

      usedNames.add(formattedName);

      if (formattedName !== s.name) {
        await db.service.update({
          where: { id: s.id },
          data: { name: formattedName },
        });
        updatedCount++;
      }
    }
  }

  console.log(`✅ Successfully updated ${updatedCount} service names to clean format!\n`);

  // Show sample of 30 services across various networks
  const sampleServices = await db.service.findMany({
    where: { isActive: true },
    take: 30,
    select: {
      numericId: true,
      name: true,
      category: {
        select: {
          name: true,
          network: { select: { name: true } },
        },
      },
    },
    orderBy: [{ categoryId: 'asc' }, { numericId: 'asc' }],
  });

  console.log('📋 Sample Clean Services:');
  sampleServices.forEach(s => {
    console.log(`  #${s.numericId} [${s.category?.network?.name} > ${s.category?.name}]: "${s.name}"`);
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
