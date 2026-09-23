/**
 * P0 CATALOG FIX SCRIPT
 * Applies all critical fixes from the 8-pass audit.
 * YouTube Зрители (ext:2260-2263) — оставляем по решению владельца.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fix() {
  let fixed = 0;

  // ============================================
  // 1. FIX CLASSIFICATION ERRORS
  // ============================================
  console.log('\n=== 1. Исправление классификации ===');

  // Helper: find or create category in a network
  async function ensureCategory(networkName: string, categoryName: string): Promise<string> {
    const network = await prisma.network.findFirst({ where: { name: networkName } });
    if (!network) throw new Error(`Network ${networkName} not found`);
    
    let cat = await prisma.category.findFirst({ 
      where: { name: categoryName, networkId: network.id } 
    });
    if (!cat) {
      cat = await prisma.category.create({
        data: { name: categoryName, networkId: network.id }
      });
      console.log(`  ✅ Создана категория "${categoryName}" в ${networkName}`);
    }
    return cat.id;
  }

  // 1a: Instagram Сохранения (ext:991) → 📌 Сохранения
  const savesCatInsta = await ensureCategory('INSTAGRAM', '📌 Сохранения');
  let r = await prisma.service.updateMany({
    where: { externalId: '991' },
    data: { categoryId: savesCatInsta }
  });
  if (r.count) { fixed += r.count; console.log(`  ✅ Instagram Сохранения → 📌 Сохранения (${r.count})`); }

  // 1b: TikTok Сохранения видео (ext:1479) → 📌 Сохранения
  const savesCatTikTok = await ensureCategory('TIKTOK', '📌 Сохранения');
  r = await prisma.service.updateMany({
    where: { externalId: '1479' },
    data: { categoryId: savesCatTikTok }
  });
  if (r.count) { fixed += r.count; console.log(`  ✅ TikTok Сохранения → 📌 Сохранения (${r.count})`); }

  // 1c: Spotify Сохранения (ext:2366) → 📌 Сохранения
  const savesCatSpotify = await ensureCategory('SPOTIFY', '📌 Сохранения');
  r = await prisma.service.updateMany({
    where: { externalId: '2366' },
    data: { categoryId: savesCatSpotify }
  });
  if (r.count) { fixed += r.count; console.log(`  ✅ Spotify Сохранения → 📌 Сохранения (${r.count})`); }

  // 1d: Likee Подписчики (ext:2486, 2492) из "Лайки" → "Подписчики"
  const subsCatLikee = await ensureCategory('LIKEE', '👨‍👩‍👧‍👦 Подписчики / Участники');
  r = await prisma.service.updateMany({
    where: { externalId: { in: ['2486', '2492'] } },
    data: { categoryId: subsCatLikee }
  });
  if (r.count) { fixed += r.count; console.log(`  ✅ Likee Подписчики → Подписчики (${r.count})`); }

  // 1e: VK Play Зрители (ext:1829-1832) из "Прослушивания" → "Стримы"
  const streamsCatVK = await ensureCategory('VK', '🔴 Стримы');
  r = await prisma.service.updateMany({
    where: { externalId: { in: ['1829', '1830', '1831', '1832'] } },
    data: { categoryId: streamsCatVK }
  });
  if (r.count) { fixed += r.count; console.log(`  ✅ VK Play Зрители → 🔴 Стримы (${r.count})`); }

  // 1f: VK Play Подписчики (ext:1833) из "Прослушивания" → "Подписчики"
  const subsCatVK = await prisma.category.findFirst({ 
    where: { name: '👨‍👩‍👧‍👦 Подписчики / Участники', network: { name: 'VK' } } 
  });
  if (subsCatVK) {
    r = await prisma.service.updateMany({
      where: { externalId: '1833' },
      data: { categoryId: subsCatVK.id }
    });
    if (r.count) { fixed += r.count; console.log(`  ✅ VK Play Подписчики → Подписчики (${r.count})`); }
  }

  // 1g: Telegram Premium Участники + Просмотры (misclassified in Просмотры)
  // ext: 1763, 2079, 2077, 2072, 2068(dup) — these are Premium subscribers, not views
  const premCatTg = await prisma.category.findFirst({
    where: { name: '💎 Premium Подписчики', network: { name: 'TELEGRAM' } }
  });
  if (premCatTg) {
    r = await prisma.service.updateMany({
      where: { externalId: { in: ['1763', '2079', '2077', '2072'] } },
      data: { categoryId: premCatTg.id }
    });
    if (r.count) { fixed += r.count; console.log(`  ✅ TG Premium Участники из Просмотров → 💎 Premium Подписчики (${r.count})`); }
  }

  // 1h: Twitch Зрители "с просмотрами" (11 услуг) — they ARE streams, fix the classification rule
  // ext: 2803-2813, 2804 — already in Стримы, the audit flagged them incorrectly
  // These are actually correctly classified as Стримы, no action needed

  // 1i: VK Просмотры (ext:2382, 1803, 1804, 2755) misclassified in "Прослушивания" → "Просмотры"
  const viewsCatVK = await prisma.category.findFirst({
    where: { name: '👁 Просмотры / Охват', network: { name: 'VK' } }
  });
  if (!viewsCatVK) {
    const vkNet = await prisma.network.findFirst({ where: { name: 'VK' } });
    if (vkNet) {
      const newCat = await prisma.category.create({
        data: { name: '👁 Просмотры / Охват', networkId: vkNet.id }
      });
      r = await prisma.service.updateMany({
        where: { externalId: { in: ['2382', '1803', '1804', '2755'] } },
        data: { categoryId: newCat.id }
      });
      if (r.count) { fixed += r.count; console.log(`  ✅ VK Просмотры из Прослушиваний → 👁 Просмотры (${r.count})`); }
    }
  } else {
    r = await prisma.service.updateMany({
      where: { externalId: { in: ['2382', '1803', '1804', '2755'] } },
      data: { categoryId: viewsCatVK.id }
    });
    if (r.count) { fixed += r.count; console.log(`  ✅ VK Просмотры из Прослушиваний → 👁 Просмотры (${r.count})`); }
  }

  // 1j: Spotify комбо (ext:2372, 2373) → оставляем в Прослушиваниях (комбо = прослушивания)
  // No action — это комбо пакеты, их основная ценность — прослушивания

  // ============================================
  // 2. CAP INT_MAX → 10,000,000
  // ============================================
  console.log('\n=== 2. Ограничение INT_MAX ===');
  r = await prisma.service.updateMany({
    where: { maxQty: 2147483647 },
    data: { maxQty: 10000000 }
  });
  console.log(`  ✅ Ограничено max=10M для ${r.count} услуг`);
  fixed += r.count;

  // ============================================
  // 3. HIDE COMPLAINTS (isActive = false)
  // ============================================
  console.log('\n=== 3. Скрытие жалоб ===');
  r = await prisma.service.updateMany({
    where: { externalId: { in: ['2392', '2402', '2404', '2398', '2400', '2394', '2396'] } },
    data: { isActive: false }
  });
  console.log(`  ✅ Скрыто ${r.count} услуг-жалоб (isActive=false)`);
  fixed += r.count;

  // ============================================
  // 4. DELETE WIBES (dead platform)
  // ============================================
  console.log('\n=== 4. Удаление Wibes ===');
  r = await prisma.service.deleteMany({
    where: { externalId: { in: ['3068', '3072', '3073', '3071', '3070'] } }
  });
  console.log(`  ✅ Удалено ${r.count} услуг Wibes`);
  fixed += r.count;

  // ============================================
  // 5. HIDE UNCLEAR SERVICES
  // ============================================
  console.log('\n=== 5. Скрытие непонятных услуг ===');
  r = await prisma.service.updateMany({
    where: { externalId: '2284' },
    data: { isActive: false }
  });
  console.log(`  ✅ Скрыта "Активность для ID2283" (${r.count})`);
  fixed += r.count;

  // Also hide the "30 дней" orphan in OTHER
  r = await prisma.service.updateMany({
    where: { name: '30 дней', category: { network: { name: 'OTHER' } } },
    data: { isActive: false }
  });
  if (r.count) { console.log(`  ✅ Скрыта "30 дней" в OTHER (${r.count})`); fixed += r.count; }

  // ============================================
  // 6. CLEANUP: Remove empty categories
  // ============================================
  console.log('\n=== 6. Очистка пустых категорий ===');
  const emptyCats = await prisma.category.findMany({
    where: { services: { none: {} } }
  });
  if (emptyCats.length > 0) {
    await prisma.category.deleteMany({
      where: { id: { in: emptyCats.map(c => c.id) } }
    });
    console.log(`  ✅ Удалено ${emptyCats.length} пустых категорий`);
  }

  console.log(`\n🎯 ИТОГО ИСПРАВЛЕНО: ${fixed} записей`);
}

fix()
  .catch(e => console.error('ERROR:', e))
  .finally(() => prisma.$disconnect());
