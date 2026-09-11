/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * 
 * CATALOG TAXONOMY CONSOLIDATOR
 * ==============================================================================
 * CLI инструмент консолидации каталога по стандарту `catalog-taxonomy-curator`.
 * 
 * Использование:
 *   npx tsx scripts/catalog-taxonomy-consolidator.ts --dry-run
 *   npx tsx scripts/catalog-taxonomy-consolidator.ts --apply
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CanonicalCategoryDef {
  activityType: string;
  name: string;
  slugSuffix: string;
  sort: number;
  matchKeywords: string[];
}

export const CANONICAL_TAXONOMY: Record<string, CanonicalCategoryDef[]> = {
  TELEGRAM: [
    { activityType: 'SUBSCRIBERS', name: 'Подписчики', slugSuffix: 'subscribers', sort: 10, matchKeywords: ['подписч', 'участник', 'фолловер', 'member', 'sub'] },
    { activityType: 'VIEWS', name: 'Просмотры', slugSuffix: 'views', sort: 20, matchKeywords: ['просмотр', 'охват', 'view', 'клики по рекламе'] },
    { activityType: 'REACTIONS', name: 'Реакции', slugSuffix: 'reactions', sort: 30, matchKeywords: ['реакц', 'эмодзи', 'reaction', 'emoji', 'лайк', 'like'] },
    { activityType: 'BOOSTS', name: 'Бусты', slugSuffix: 'boosts', sort: 40, matchKeywords: ['буст', 'boost', 'уровен', 'level'] },
    { activityType: 'BOTS', name: 'Боты и Рефералы', slugSuffix: 'bots', sort: 50, matchKeywords: ['старт бота', 'старты бота', 'реферал', 'активность ботов', 'запуск из поиска', 'умный поиск'] },
    { activityType: 'STARS', name: 'Звёзды', slugSuffix: 'stars', sort: 60, matchKeywords: ['звезд', 'stars', 'star'] },
    { activityType: 'COMMENTS', name: 'Комментарии и Опросы', slugSuffix: 'comments', sort: 70, matchKeywords: ['коммент', 'голос', 'опрос', 'отзыв', 'comment', 'poll', 'vote'] },
    { activityType: 'REPOSTS', name: 'Репосты', slugSuffix: 'reposts', sort: 80, matchKeywords: ['репост', 'поделит', 'repost', 'share'] },
    { activityType: 'STORIES', name: 'Истории', slugSuffix: 'stories', sort: 90, matchKeywords: ['истори', 'стори', 'story'] },
    { activityType: 'AUTO_VIEWS', name: 'Автопросмотры', slugSuffix: 'auto-views', sort: 100, matchKeywords: ['автопросмотр', 'авто - просмотр', 'будущие посты'] },
    { activityType: 'OTHER', name: 'Другое', slugSuffix: 'other', sort: 999, matchKeywords: ['жалоб'] },
  ],
  INSTAGRAM: [
    { activityType: 'SUBSCRIBERS', name: 'Подписчики', slugSuffix: 'subscribers', sort: 10, matchKeywords: ['подписч', 'фолловер', 'follower'] },
    { activityType: 'LIKES', name: 'Лайки', slugSuffix: 'likes', sort: 20, matchKeywords: ['лайк', 'нравится', 'сердечк', 'like'] },
    { activityType: 'VIEWS', name: 'Просмотры', slugSuffix: 'views', sort: 30, matchKeywords: ['просмотр', 'рилс', 'reels', 'видео', 'view'] },
    { activityType: 'COMMENTS', name: 'Комментарии', slugSuffix: 'comments', sort: 40, matchKeywords: ['коммент', 'comment'] },
    { activityType: 'STORIES', name: 'Истории', slugSuffix: 'stories', sort: 50, matchKeywords: ['истори', 'стори', 'story'] },
    { activityType: 'SAVES', name: 'Охваты и Сохранения', slugSuffix: 'saves', sort: 60, matchKeywords: ['сохранен', 'охват', 'посещен', 'статистик', 'save', 'reach'] },
    { activityType: 'STREAMS', name: 'Стримы', slugSuffix: 'streams', sort: 70, matchKeywords: ['стрим', 'эфир', 'live', 'зрител'] },
    { activityType: 'OTHER', name: 'Другое', slugSuffix: 'other', sort: 999, matchKeywords: [] },
  ],
  VK: [
    { activityType: 'SUBSCRIBERS', name: 'Подписчики и Друзья', slugSuffix: 'subscribers', sort: 10, matchKeywords: ['подписч', 'друг', 'вступлен', 'групп', 'паблик'] },
    { activityType: 'LIKES', name: 'Лайки', slugSuffix: 'likes', sort: 20, matchKeywords: ['лайк', 'нравится', 'like'] },
    { activityType: 'VIEWS', name: 'Просмотры', slugSuffix: 'views', sort: 30, matchKeywords: ['просмотр', 'запис', 'клип', 'видео', 'view'] },
    { activityType: 'REPOSTS', name: 'Репосты', slugSuffix: 'reposts', sort: 40, matchKeywords: ['репост', 'поделит', 'рассказ'] },
    { activityType: 'COMMENTS', name: 'Комментарии', slugSuffix: 'comments', sort: 50, matchKeywords: ['коммент', 'отзыв'] },
    { activityType: 'POLLS', name: 'Опросы и Голоса', slugSuffix: 'polls', sort: 60, matchKeywords: ['опрос', 'голос', 'голосован'] },
    { activityType: 'STREAMS', name: 'Стримы', slugSuffix: 'streams', sort: 70, matchKeywords: ['стрим', 'трансляц', 'эфир'] },
    { activityType: 'OTHER', name: 'Другое', slugSuffix: 'other', sort: 999, matchKeywords: [] },
  ],
  YOUTUBE: [
    { activityType: 'SUBSCRIBERS', name: 'Подписчики', slugSuffix: 'subscribers', sort: 10, matchKeywords: ['подписч', 'sub'] },
    { activityType: 'VIEWS', name: 'Просмотры', slugSuffix: 'views', sort: 20, matchKeywords: ['просмотр', 'видео', 'shorts', 'view', 'часы', 'репост', 'share'] },
    { activityType: 'LIKES', name: 'Лайки', slugSuffix: 'likes', sort: 30, matchKeywords: ['лайк', 'like'] },
    { activityType: 'COMMENTS', name: 'Комментарии', slugSuffix: 'comments', sort: 40, matchKeywords: ['коммент', 'comment'] },
    { activityType: 'STREAMS', name: 'Зрители на Стрим', slugSuffix: 'streams', sort: 50, matchKeywords: ['стрим', 'трансляц', 'stream', 'live'] },
    { activityType: 'OTHER', name: 'Другое', slugSuffix: 'other', sort: 999, matchKeywords: [] },
  ],
  TIKTOK: [
    { activityType: 'SUBSCRIBERS', name: 'Подписчики', slugSuffix: 'subscribers', sort: 10, matchKeywords: ['подписч', 'фолловер', 'follower'] },
    { activityType: 'VIEWS', name: 'Просмотры', slugSuffix: 'views', sort: 20, matchKeywords: ['просмотр', 'view'] },
    { activityType: 'LIKES', name: 'Лайки', slugSuffix: 'likes', sort: 30, matchKeywords: ['лайк', 'like'] },
    { activityType: 'COMMENTS', name: 'Комментарии', slugSuffix: 'comments', sort: 40, matchKeywords: ['коммент', 'comment'] },
    { activityType: 'REPOSTS', name: 'Репосты и Сохранения', slugSuffix: 'reposts', sort: 50, matchKeywords: ['репост', 'поделит', 'сохранен', 'share', 'save'] },
    { activityType: 'STREAMS', name: 'Стримы', slugSuffix: 'streams', sort: 60, matchKeywords: ['стрим', 'эфир', 'live'] },
    { activityType: 'OTHER', name: 'Другое', slugSuffix: 'other', sort: 999, matchKeywords: [] },
  ],
  DEFAULT: [
    { activityType: 'SUBSCRIBERS', name: 'Подписчики', slugSuffix: 'subscribers', sort: 10, matchKeywords: ['подписч', 'участник', 'фолловер', 'member', 'follow'] },
    { activityType: 'LIKES', name: 'Лайки', slugSuffix: 'likes', sort: 20, matchKeywords: ['лайк', 'нравится', 'like'] },
    { activityType: 'VIEWS', name: 'Просмотры', slugSuffix: 'views', sort: 30, matchKeywords: ['просмотр', 'охват', 'view', 'play', 'прослуш'] },
    { activityType: 'COMMENTS', name: 'Комментарии', slugSuffix: 'comments', sort: 40, matchKeywords: ['коммент', 'отзыв', 'comment'] },
    { activityType: 'REACTIONS', name: 'Реакции', slugSuffix: 'reactions', sort: 50, matchKeywords: ['реакц', 'эмодзи', 'reaction'] },
    { activityType: 'REPOSTS', name: 'Репосты', slugSuffix: 'reposts', sort: 60, matchKeywords: ['репост', 'поделит', 'share'] },
    { activityType: 'STREAMS', name: 'Стримы', slugSuffix: 'streams', sort: 70, matchKeywords: ['стрим', 'трансляц', 'эфир', 'зрител', 'stream', 'live'] },
    { activityType: 'BOTS', name: 'Боты', slugSuffix: 'bots', sort: 80, matchKeywords: ['бот', 'bot'] },
    { activityType: 'OTHER', name: 'Другое', slugSuffix: 'other', sort: 999, matchKeywords: [] },
  ]
};

function normalizePlatformSlug(slugOrName: string): string {
  const s = slugOrName.toUpperCase();
  if (s.includes('TELEGRAM')) return 'TELEGRAM';
  if (s.includes('INSTAGRAM') || s.includes('INSTA')) return 'INSTAGRAM';
  if (s.includes('VK') || s.includes('ВКОНТАКТЕ')) return 'VK';
  if (s.includes('YOUTUBE')) return 'YOUTUBE';
  if (s.includes('TIKTOK')) return 'TIKTOK';
  return 'DEFAULT';
}

function resolveCanonicalActivity(categoryName: string, networkKey: string): CanonicalCategoryDef {
  const defs = CANONICAL_TAXONOMY[networkKey] || CANONICAL_TAXONOMY.DEFAULT;
  const n = categoryName.toLowerCase();

  // 1. Звезды Telegram
  if (n.includes('звезд') || n.includes('star')) {
    const starDef = defs.find(d => d.activityType === 'STARS');
    if (starDef) return starDef;
  }

  // 2. Бусты / уровни
  if (n.includes('буст') || n.includes('boost') || n.includes('уровен')) {
    const boostDef = defs.find(d => d.activityType === 'BOOSTS');
    if (boostDef) return boostDef;
  }

  // 3. Боты / рефералы / старты
  if (n.includes('старт бота') || n.includes('старты бота') || n.includes('реферал') || n.includes('чат - бот') || n.includes('чат-бот') || n.includes('активность ботов') || n.includes('запуски бота') || n.includes('умный поиск')) {
    const botDef = defs.find(d => d.activityType === 'BOTS');
    if (botDef) return botDef;
  }

  // 4. Истории / сторис
  if (n.includes('истори') || n.includes('стори') || n.includes('stor')) {
    const storiesDef = defs.find(d => d.activityType === 'STORIES');
    if (storiesDef) return storiesDef;
  }

  // 5. Репосты / поделиться (проверяем ДО авто, чтобы "авто-репосты" шли в Репосты)
  if (n.includes('репост') || n.includes('поделит') || n.includes('share') || n.includes('repost')) {
    const repostDef = defs.find(d => d.activityType === 'REPOSTS');
    if (repostDef) return repostDef;
  }

  // 6. Авто-просмотры (проверяем ДО опросов, так как опрос входит в автОПРОСмотры!)
  if (n.includes('авто') && (n.includes('просмотр') || n.includes('пост'))) {
    const autoDef = defs.find(d => d.activityType === 'AUTO_VIEWS');
    if (autoDef) return autoDef;
    return defs.find(d => d.activityType === 'VIEWS') || defs[0];
  }

  // 7. Опросы / голоса (с защитой от автОПРОСмотры)
  if (((n.includes('опрос') && !n.includes('автопрос')) || n.includes('голос') || n.includes('poll') || n.includes('vote'))) {
    const pollDef = defs.find(d => d.activityType === 'POLLS') || defs.find(d => d.activityType === 'COMMENTS');
    if (pollDef) return pollDef;
  }

  // 6. Стримы / эфиры / зрители
  if (n.includes('стрим') || n.includes('трансляц') || n.includes('эфир') || n.includes('зрител') || n.includes('live')) {
    const streamDef = defs.find(d => d.activityType === 'STREAMS');
    if (streamDef) return streamDef;
    return defs.find(d => d.activityType === 'VIEWS') || defs[0];
  }

  // 7. Сохранения / охваты / статистика
  if (n.includes('сохранен') || n.includes('статистик') || n.includes('посещен')) {
    const saveDef = defs.find(d => d.activityType === 'SAVES');
    if (saveDef) return saveDef;
  }

  // 8. Репосты / поделиться
  if (n.includes('репост') || n.includes('поделит') || n.includes('share') || n.includes('repost')) {
    const repostDef = defs.find(d => d.activityType === 'REPOSTS');
    if (repostDef) return repostDef;
  }

  // 9. Авто-просмотры
  if (n.includes('авто') && (n.includes('просмотр') || n.includes('пост'))) {
    const autoDef = defs.find(d => d.activityType === 'AUTO_VIEWS');
    if (autoDef) return autoDef;
    return defs.find(d => d.activityType === 'VIEWS') || defs[0];
  }

  // 10. Реакции (и Лайки в Telegram)
  if (n.includes('реакц') || n.includes('эмодзи') || n.includes('reaction') || n.includes('emoji') || (networkKey === 'TELEGRAM' && (n.includes('лайк') || n.includes('like')))) {
    const reactDef = defs.find(d => d.activityType === 'REACTIONS');
    if (reactDef) return reactDef;
  }

  // 11. Комментарии
  if (n.includes('коммент') || n.includes('отзыв') || n.includes('comment') || n.includes('review')) {
    const commentDef = defs.find(d => d.activityType === 'COMMENTS');
    if (commentDef) return commentDef;
  }

  // 12. Лайки
  if (n.includes('лайк') || n.includes('нравится') || n.includes('like') || n.includes('heart')) {
    const likeDef = defs.find(d => d.activityType === 'LIKES') || defs.find(d => d.activityType === 'REACTIONS');
    if (likeDef) return likeDef;
  }

  // 13. Просмотры
  if (n.includes('просмотр') || n.includes('view') || n.includes('прослуш') || n.includes('play') || n.includes('охват')) {
    const viewDef = defs.find(d => d.activityType === 'VIEWS');
    if (viewDef) return viewDef;
  }

  // 14. Подписчики (default for channels, accounts, groups)
  if (n.includes('подписч') || n.includes('участник') || n.includes('фолловер') || n.includes('member') || n.includes('sub') || n.includes('follow') || n.includes('друг')) {
    const subDef = defs.find(d => d.activityType === 'SUBSCRIBERS');
    if (subDef) return subDef;
  }

  // 15. Прочие ключевые слова
  for (const def of defs) {
    for (const kw of def.matchKeywords) {
      if (n.includes(kw)) return def;
    }
  }

  // Fallback
  return defs.find(d => d.activityType === 'OTHER') || defs[defs.length - 1];
}

function getFitScore(catName: string, targetName: string): number {
  const c = catName.trim().toLowerCase();
  const t = targetName.toLowerCase();
  if (c === t) return 1000;
  if (c.startsWith(t)) return 500;
  if (c.includes(t)) return 100;
  return 0;
}

async function runConsolidator() {
  const isApply = process.argv.includes('--apply');
  console.log(`\n================================================================`);
  console.log(`🚀 OMNISMM CATALOG TAXONOMY CONSOLIDATOR (v1.0.0)`);
  console.log(`Mode: ${isApply ? '⚡ APPLY (MUTATING DATABASE)' : '🔍 DRY-RUN (INSPECTION ONLY)'}`);
  console.log(`================================================================\n`);

  const networks = await prisma.network.findMany({
    include: {
      categories: {
        include: {
          _count: { select: { services: true } }
        },
        orderBy: { name: 'asc' }
      }
    },
    orderBy: { name: 'asc' }
  });

  let totalCategoriesBefore = 0;
  let totalServices = 0;
  let targetCanonicalCount = 0;
  let plannedMerges = 0;

  const planPerNetwork: Record<string, Array<{
    canonicalName: string;
    canonicalActivityType: string;
    mergedCategories: Array<{ id: string; name: string; servicesCount: number }>;
  }>> = {};

  for (const net of networks) {
    const netKey = normalizePlatformSlug(net.slug || net.name);
    const canonicalDefs = CANONICAL_TAXONOMY[netKey] || CANONICAL_TAXONOMY.DEFAULT;
    
    // Группируем существующие категории по activityType
    const bucket = new Map<string, typeof net.categories>();
    for (const cat of net.categories) {
      totalCategoriesBefore++;
      totalServices += cat._count.services;

      const def = resolveCanonicalActivity(cat.name, netKey);
      const l = bucket.get(def.activityType) || [];
      l.push(cat);
      bucket.set(def.activityType, l);
    }

    planPerNetwork[net.name] = [];

    for (const [activityType, cats] of bucket.entries()) {
      const def = canonicalDefs.find(d => d.activityType === activityType)!;
      targetCanonicalCount++;

      // Выбираем категорию с наивысшим совпадением с каноническим названием
      cats.sort((a, b) => {
        const scoreA = getFitScore(a.name, def.name);
        const scoreB = getFitScore(b.name, def.name);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return b._count.services - a._count.services;
      });

      const canonicalWinner = cats[0];
      const otherDuplicates = cats.slice(1);
      plannedMerges += otherDuplicates.length;

      planPerNetwork[net.name].push({
        canonicalName: def.name,
        canonicalActivityType: def.activityType,
        mergedCategories: cats.map(c => ({ id: c.id, name: c.name, servicesCount: c._count.services }))
      });
    }
  }

  console.log(`📊 АНАЛИТИЧЕСКИЙ СРЕЗ:`);
  console.log(`- Социальных сетей: ${networks.length}`);
  console.log(`- Категорий ДО консолидации: ${totalCategoriesBefore}`);
  console.log(`- Категорий ПОСЛЕ консолидации: ${targetCanonicalCount} (📉 сокращение на ${Math.round((1 - targetCanonicalCount / totalCategoriesBefore) * 100)}%!)`);
  console.log(`- Всего услуг в каталоге: ${totalServices} (100% сохраняются)`);
  console.log(`- Категорий-дубликатов под слияние/удаление: ${plannedMerges}\n`);

  // Детальный вывод по Telegram и Instagram
  for (const [netName, items] of Object.entries(planPerNetwork)) {
    if (netName.includes('Telegram') || netName.includes('Instagram') || netName.includes('VK')) {
      console.log(`📌 ПЛАТФОРМА: ${netName.toUpperCase()}`);
      for (const item of items) {
        const totalSrv = item.mergedCategories.reduce((s, c) => s + c.servicesCount, 0);
        console.log(`  ⭐ Каноническая: "${item.canonicalName}" (${totalSrv} услуг, объединяет ${item.mergedCategories.length} категорий)`);
        if (item.mergedCategories.length > 1) {
          item.mergedCategories.slice(0, 5).forEach(c => {
            console.log(`     ↳ [${c.servicesCount} srv] "${c.name}"`);
          });
          if (item.mergedCategories.length > 5) {
            console.log(`     ↳ ... и еще ${item.mergedCategories.length - 5} категорий`);
          }
        }
      }
      console.log('');
    }
  }

  if (!isApply) {
    console.log(`----------------------------------------------------------------`);
    console.log(`💡 Это был DRY-RUN запуск. Никакие данные в БД не изменялись.`);
    console.log(`Для применения консолидации запустите:`);
    console.log(`  npx tsx scripts/catalog-taxonomy-consolidator.ts --apply\n`);
    return;
  }

  // EXECUTION MODE
  console.log(`\n⚙️ ПРИМЕНЕНИЕ КОНСОЛИДАЦИИ В БАЗЕ ДАННЫХ...`);
  let movedServices = 0;
  let deletedCats = 0;
  let renamedCats = 0;

  for (const net of networks) {
    const netKey = normalizePlatformSlug(net.slug || net.name);
    const canonicalDefs = CANONICAL_TAXONOMY[netKey] || CANONICAL_TAXONOMY.DEFAULT;
    
    const bucket = new Map<string, typeof net.categories>();
    for (const cat of net.categories) {
      const def = resolveCanonicalActivity(cat.name, netKey);
      const l = bucket.get(def.activityType) || [];
      l.push(cat);
      bucket.set(def.activityType, l);
    }

    for (const [activityType, cats] of bucket.entries()) {
      const def = canonicalDefs.find(d => d.activityType === activityType)!;
      const targetSlug = `${net.slug}-${def.slugSuffix}`;

      // 1. Приоритет выбора победителя:
      // Сначала ищем категорию, у которой слаг УЖЕ равен targetSlug
      // Затем точное совпадение имени
      // Затем сортировка по score и количеству услуг
      cats.sort((a, b) => {
        if (a.slug === targetSlug && b.slug !== targetSlug) return -1;
        if (b.slug === targetSlug && a.slug !== targetSlug) return 1;
        const exactA = a.name.toLowerCase().trim() === def.name.toLowerCase().trim() ? 1 : 0;
        const exactB = b.name.toLowerCase().trim() === def.name.toLowerCase().trim() ? 1 : 0;
        if (exactA !== exactB) return exactB - exactA;
        const scoreA = getFitScore(a.name, def.name);
        const scoreB = getFitScore(b.name, def.name);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return b._count.services - a._count.services;
      });

      const winner = cats[0];
      const dupes = cats.slice(1);

      // 2. Сначала переносим все услуги из дублей в winner
      for (const dupe of dupes) {
        if (dupe._count.services > 0) {
          const res = await prisma.service.updateMany({
            where: { categoryId: dupe.id },
            data: { categoryId: winner.id }
          });
          movedServices += res.count;
        }

        // Если у дубля был слаг targetSlug, временно освобождаем его
        if (dupe.slug === targetSlug) {
          await prisma.category.update({
            where: { id: dupe.id },
            data: { slug: `temp-${dupe.id}-${Date.now()}` }
          });
        }

        // Удаляем дубль
        await prisma.category.delete({
          where: { id: dupe.id }
        });
        deletedCats++;
      }

      // 3. Проверяем, свободен ли targetSlug в базе
      let resolvedSlug = targetSlug;
      if (winner.slug !== targetSlug) {
        const conflict = await prisma.category.findUnique({
          where: { slug: targetSlug }
        });
        if (conflict && conflict.id !== winner.id) {
          resolvedSlug = `${targetSlug}-${winner.id.slice(-4)}`;
        }
      }

      // 4. Обновляем победителя
      await prisma.category.update({
        where: { id: winner.id },
        data: {
          name: def.name,
          slug: resolvedSlug,
          activityType: def.activityType,
          sort: def.sort,
        }
      });
      renamedCats++;
    }
  }

  if (isApply) {
    await relocateMisplacedServices();
  }

  const finalCats = await prisma.category.count();
  const finalSrv = await prisma.service.count();

  console.log(`\n🎉 КОНСОЛИДАЦИЯ УСПЕШНО ЗАВЕРШЕНА!`);
  console.log(`- Перелинковано услуг: ${movedServices}`);
  console.log(`- Удалено категорий-дубликатов: ${deletedCats}`);
  console.log(`- Категорий в БД: ${finalCats} (было ${totalCategoriesBefore})`);
  console.log(`- Услуг в БД: ${finalSrv} (было ${totalServices}, 100% сохранены)`);
  console.log(`================================================================\n`);
}

async function relocateMisplacedServices() {
  console.log('🧹 [Taxonomy Hygiene] Проверка и исправление ошибочно распределенных услуг...');
  
  // 1. Telegram: перемещаем лайки в Реакции, а звезды в Звёзды
  const tgNet = await prisma.network.findFirst({ 
    where: { slug: { contains: 'telegram', mode: 'insensitive' } } 
  });
  if (tgNet) {
    const tgSubs = await prisma.category.findFirst({ where: { networkId: tgNet.id, name: 'Подписчики' }, include: { services: true } });
    const tgReact = await prisma.category.findFirst({ where: { networkId: tgNet.id, name: 'Реакции' } });
    let tgStars = await prisma.category.findFirst({ 
      where: { networkId: tgNet.id, name: { in: ['Звёзды', 'Звезды'] } } 
    });
    if (!tgStars) {
      tgStars = await prisma.category.create({
        data: {
          name: 'Звёзды',
          slug: 'telegram-stars',
          networkId: tgNet.id,
          activityType: 'STARS',
          sort: 60,
          tenantId: 'smmplan'
        }
      });
      console.log('  ↳ [TG] Создана каноническая категория "Звёзды"');
    }

    if (tgSubs) {
      for (const s of tgSubs.services) {
        const lower = s.name.toLowerCase();
        if (tgReact && (lower.includes('лайк') || lower.includes('реакц'))) {
          await prisma.service.update({ where: { id: s.id }, data: { categoryId: tgReact.id } });
          console.log(`  ↳ [TG] Перемещена услуга "${s.name}" из "Подписчики" в "Реакции"`);
        } else if (tgStars && (lower.includes('звезд') || lower.includes('star'))) {
          await prisma.service.update({ where: { id: s.id }, data: { categoryId: tgStars.id } });
          console.log(`  ↳ [TG] Перемещена услуга "${s.name}" из "Подписчики" в "Звёзды"`);
        }
      }
    }
  }

  // 2. YouTube: перемещаем репосты, просмотры, видео и вывод в Просмотры
  const ytNet = await prisma.network.findFirst({ 
    where: { slug: { contains: 'youtube', mode: 'insensitive' } } 
  });
  if (ytNet) {
    const ytSubs = await prisma.category.findFirst({ where: { networkId: ytNet.id, name: 'Подписчики' }, include: { services: true } });
    const ytViews = await prisma.category.findFirst({ where: { networkId: ytNet.id, name: 'Просмотры' } });
    if (ytSubs && ytViews) {
      for (const s of ytSubs.services) {
        const lower = s.name.toLowerCase();
        if (
          lower.includes('репост') || 
          lower.includes('просмотр') || 
          lower.includes('лайк') ||
          lower.includes('видео') ||
          lower.includes('video') ||
          lower.includes('прогрев') ||
          lower.includes('вывод')
        ) {
          await prisma.service.update({ where: { id: s.id }, data: { categoryId: ytViews.id } });
          console.log(`  ↳ [YT] Перемещена услуга "${s.name}" из "Подписчики" в "Просмотры"`);
        }
      }
    }
  }
}

runConsolidator()
  .catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
