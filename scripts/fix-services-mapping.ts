import { db } from '../src/lib/db';
import { inferTargetTypeFromCategory } from '../src/utils/target-type';

async function main() {
  console.log('🚀 Starting Deep Catalog Fixer...');
  const networks = await db.network.findMany({ include: { categories: true } });
  
  const vkNetwork = networks.find(n => n.name.toLowerCase() === 'vkontakte' || n.name.toLowerCase() === 'vk');
  const vkViewsCategory = vkNetwork?.categories.find(c => c.name.toLowerCase().includes('просмотры'));
  const tgNetwork = networks.find(n => n.name.toLowerCase().includes('telegram'));

  console.log(`Found VK Network: ${vkNetwork?.id || 'NO_VK'}`);
  
  const services = await db.service.findMany({
    include: { category: { include: { network: true } } }
  });

  let categoryFixedCount = 0;
  let targetTypeFixedCount = 0;

  for (const s of services) {
    let newCategoryId = s.categoryId;
    const nameLower = s.name.toLowerCase();
    const currentCatLower = s.category.name.toLowerCase();

    // 1. VK AutoViews misplaced in Telegram/Polls
    if (nameLower.includes('просмотр') || nameLower.includes('автопросмотр')) {
      if (currentCatLower.includes('опрос') || currentCatLower.includes('голос')) {
        if (vkViewsCategory && (nameLower.includes('vk') || nameLower.includes('вк'))) {
          newCategoryId = vkViewsCategory.id;
          console.log(`[FIX CATEGORY] Moving "${s.name}" -> VK/Views (was ${s.category.name})`);
        }
      }
    }

    // 2. Normalizing TargetType (e.g. Subs=CHANNEL, Likes=POST)
    // First, infer based on category name
    let correctTargetType = inferTargetTypeFromCategory(s.category.name);
    // If the service name itself dictates it's a channel sub, override
    if (nameLower.includes('подписчик') || nameLower.includes('канал')) correctTargetType = 'CHANNEL';
    if (nameLower.includes('реакци') || nameLower.includes('лайк') || nameLower.includes('просмотр')) correctTargetType = 'POST';

    let targetTypeData = {};
    if (s.targetType !== correctTargetType) {
      targetTypeData = { targetType: correctTargetType };
      console.log(`[FIX TARGET] "${s.name}": ${s.targetType} -> ${correctTargetType}`);
      targetTypeFixedCount++;
    }

    if (newCategoryId !== s.categoryId || Object.keys(targetTypeData).length > 0) {
      await db.service.update({
        where: { id: s.id },
        data: {
          categoryId: newCategoryId,
          ...targetTypeData
        }
      });
      if (newCategoryId !== s.categoryId) categoryFixedCount++;
    }
  }

  console.log(`\n✅ Finished fixing!`);
  console.log(`Categories fixed: ${categoryFixedCount}`);
  console.log(`TargetTypes normalized: ${targetTypeFixedCount}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
