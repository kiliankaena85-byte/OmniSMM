import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NETWORKS = [
  { name: 'Telegram', slug: 'telegram', icon: 'send', aliases: ['telegram', 'tg', 'телеграм'] },
  { name: 'Instagram', slug: 'instagram', icon: 'instagram', aliases: ['instagram', 'insta', 'инстаграм', 'ig'] },
  { name: 'VKontakte', slug: 'vk', icon: 'users', aliases: ['vk', 'vkontakte', 'вк', 'вконтакте'] },
  { name: 'TikTok', slug: 'tiktok', icon: 'video', aliases: ['tiktok', 'тикток', 'tik-tok'] },
  { name: 'YouTube', slug: 'youtube', icon: 'youtube', aliases: ['youtube', 'ютуб', 'yt'] },
  { name: 'Twitter / X', slug: 'twitter', icon: 'twitter', aliases: ['twitter', 'x', 'твиттер'] },
  { name: 'Facebook', slug: 'facebook', icon: 'facebook', aliases: ['facebook', 'fb', 'фейсбук'] },
  { name: 'Twitch', slug: 'twitch', icon: 'twitch', aliases: ['twitch', 'твич'] },
  { name: 'Discord', slug: 'discord', icon: 'discord', aliases: ['discord', 'дискорд'] },
];

async function main() {
  console.log('🏗️ Smmplan Data Architect: Запуск трехуровневой нормализации...');

  // 1. Создаем сети
  console.log('Создаем базовые сети (Network)...');
  const networkMap = new Map<string, string>(); // slug -> id

  for (const net of NETWORKS) {
    const existing = await prisma.network.findUnique({ where: { slug: net.slug } });
    if (existing) {
      networkMap.set(net.slug, existing.id);
    } else {
      const created = await prisma.network.create({
        data: { name: net.name, slug: net.slug, icon: net.icon, isActive: true, sort: 0 }
      });
      networkMap.set(net.slug, created.id);
    }
  }

  // 2. Получаем все категории
  const categories = await prisma.category.findMany({
    include: { _count: { select: { services: true } } }
  });

  console.log(`🔍 Найдено ${categories.length} категорий. Начинаем анализ...`);

  let updated = 0;
  let emptyDeleted = 0;

  for (const cat of categories) {
    // Чистим пустые категории (без услуг)
    if (cat._count.services === 0) {
      await prisma.category.delete({ where: { id: cat.id } });
      emptyDeleted++;
      continue;
    }

    const lowerName = cat.name.toLowerCase();
    let matchedSlug: string | null = null;
    let cleanName = cat.name;

    // Ищем к какой сети принадлежит
    for (const net of NETWORKS) {
      // Ищем точное вхождение алиаса как отдельного слова или префикса
      for (const alias of net.aliases) {
        if (lowerName.includes(alias)) {
          matchedSlug = net.slug;
          // Пытаемся вырезать имя сети из начала или любой части
          const regex = new RegExp(`\\b${alias}\\b\\s*`, 'gi');
          cleanName = cleanName.replace(regex, '').trim();
          
          // Удаляем ведущие дефисы, слэши или скобки, если остались
          // eslint-disable-next-line no-useless-escape
          cleanName = cleanName.replace(/^[-\/\|\[\]\s]+/, '').trim();
          break;
        }
      }
      if (matchedSlug) break; // Нашли, выходим из цикла поиска сети
    }

    // Если сеть не найдена, кладем в специальную
    if (!matchedSlug) {
      const otherSlug = 'other';
      if (!networkMap.has(otherSlug)) {
        const otherNet = await prisma.network.create({
          data: { name: 'Другое', slug: otherSlug, isActive: true, sort: 99 }
        });
        networkMap.set(otherSlug, otherNet.id);
      }
      matchedSlug = otherSlug;
    }

    // Делаем имя категории с заглавной буквы
    cleanName = cleanName ? cleanName.charAt(0).toUpperCase() + cleanName.slice(1) : 'Разное';

    // Сохраняем обновления
    await prisma.category.update({
      where: { id: cat.id },
      data: {
        name: cleanName,
        networkId: networkMap.get(matchedSlug)
      }
    });

    updated++;
  }

  console.log(`✅ Нормализация завершена!`);
  console.log(`🗑️ Удалено пустых категорий: ${emptyDeleted}`);
  console.log(`✨ Привязано и очищено: ${updated}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
