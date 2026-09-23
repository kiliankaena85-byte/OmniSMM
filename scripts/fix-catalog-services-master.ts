/**
 * scripts/fix-catalog-services-master.ts
 *
 * Comprehensive Master Catalog Optimization & Healing Script:
 * 1. Deactivates orphan/archive services without providers.
 * 2. Differentiates duplicate tariff names within the same category by appending
 *    speed/warranty/quality metadata (e.g. "[Тариф 1 • Базовый • до 5k/д]").
 * 3. Enforces correct TargetType & CustomDataType across all services based on
 *    their category (COMMENTS -> TEXTAREA, POLLS -> NUMBER, etc.).
 * 4. Enforces Safety Floor Markup (markup >= 1.30) on all active services.
 * 5. Revalidates and clears catalog caches.
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('====================================================');
  console.log('  🚀 SMMplan Catalog Master Healing & Enhancement   ');
  console.log('====================================================\n');

  // ── 1. Deactivate orphan / archive services without linked providers ────────
  console.log('📦 Step 1: Deactivating orphan services without providers...');
  const allServices = await db.service.findMany({
    select: { id: true, name: true, providerId: true, isActive: true },
  });

  const orphanIds = allServices
    .filter(s => !s.providerId || s.name.includes('[АРХИВ]'))
    .map(s => s.id);

  if (orphanIds.length > 0) {
    const res = await db.service.updateMany({
      where: { id: { in: orphanIds } },
      data: { isActive: false },
    });
    console.log(`   ✅ Deactivated ${res.count} orphan/archive services.\n`);
  } else {
    console.log('   ✅ No orphan services found.\n');
  }

  // ── 2. Enforce TargetType & CustomDataType invariants ────────────────────────
  console.log('🎯 Step 2: Calibrating TargetType & CustomDataType...');
  const allActiveServices = await db.service.findMany({
    where: { isActive: true },
    include: {
      category: {
        include: { network: true },
      },
    },
  });

  let targetTypeFixCount = 0;

  for (const s of allActiveServices) {
    const normCat = (s.category?.activityType || '').toUpperCase();
    const serviceName = s.name.toLowerCase();

    let targetType = s.targetType || 'POST';
    let customDataType = s.customDataType || 'NONE';

    // Custom Data Type calibration
    if (normCat === 'COMMENTS' || serviceName.includes('коммент') || serviceName.includes('отзыв')) {
      if (serviceName.includes('свой') || serviceName.includes('custom') || serviceName.includes('заказн')) {
        customDataType = 'TEXTAREA';
      }
    } else if (normCat === 'POLLS' || serviceName.includes('опрос') || serviceName.includes('голос') || serviceName.includes('викторин')) {
      customDataType = 'NUMBER';
    }

    // Target Type calibration
    if (['SUBSCRIBERS', 'GROUPS', 'FRIENDS', 'PREMIUM', 'BOTS', 'REFERRALS', 'BOOSTS'].includes(normCat)) {
      targetType = 'CHANNEL';
    } else if (normCat === 'STORIES' || serviceName.includes('сторис') || serviceName.includes('story')) {
      targetType = 'STORY';
    } else if (normCat === 'POLLS') {
      targetType = 'POLL';
    } else if (customDataType === 'TEXTAREA' || normCat === 'STARS') {
      targetType = 'CUSTOM';
    }

    if (targetType !== s.targetType || customDataType !== s.customDataType) {
      await db.service.update({
        where: { id: s.id },
        data: { targetType, customDataType },
      });
      targetTypeFixCount++;
    }
  }
  console.log(`   ✅ Calibrated TargetType/CustomData for ${targetTypeFixCount} services.\n`);

  // ── 3. Enforce Safety Floor Markup (markup >= 1.30) ───────────────────────────
  console.log('💰 Step 3: Checking Safety Floor Markup (minimum 1.30x)...');
  const lowMarkupServices = await db.service.findMany({
    where: {
      isActive: true,
      markup: { lt: 1.30 },
    },
  });

  if (lowMarkupServices.length > 0) {
    for (const s of lowMarkupServices) {
      const newMarkup = 1.30;
      const newPricePer1000 = Math.round(s.rate * newMarkup * 100);
      await db.service.update({
        where: { id: s.id },
        data: {
          markup: newMarkup,
          pricePer1000Cents: newPricePer1000,
        },
      });
    }
    console.log(`   ✅ Adjusted ${lowMarkupServices.length} services to safety floor markup (1.30x).\n`);
  } else {
    console.log('   ✅ All active services meet or exceed the 1.30x safety floor markup.\n');
  }

  // ── 4. Differentiate duplicate tariff names within the same category ────────
  console.log('🏷️  Step 4: Differentiating duplicate tariff names...');
  const servicesByCategory = new Map<string, typeof allActiveServices>();

  for (const s of allActiveServices) {
    const key = `${s.tenantId}:${s.categoryId}`;
    if (!servicesByCategory.has(key)) {
      servicesByCategory.set(key, []);
    }
    servicesByCategory.get(key)!.push(s);
  }

  let differentiatedCount = 0;
  const tierNames = ['Базовый', 'Оптимальный', 'Усиленный', 'Максимальный', 'Премиум', 'Экстра', 'Ультра', 'VIP', 'VIP+', 'Элит'];

  for (const [, catServices] of servicesByCategory.entries()) {
    // Strip trailing bracket badges to find true base name collisions
    const byBaseName = new Map<string, typeof catServices>();
    for (const s of catServices) {
      // Strip all trailing bracket patterns e.g. "[базовый]", "[тариф 1 • базовый]"
      const cleanBase = s.name.replace(/\s*\[.*?\]\s*$/gi, '').trim().toLowerCase();
      if (!byBaseName.has(cleanBase)) {
        byBaseName.set(cleanBase, []);
      }
      byBaseName.get(cleanBase)!.push(s);
    }

    for (const [, duplicates] of byBaseName.entries()) {
      if (duplicates.length <= 1) continue;

      // Sort duplicates by rate (cheapest to most expensive)
      duplicates.sort((a, b) => a.rate - b.rate);

      for (let i = 0; i < duplicates.length; i++) {
        const item = duplicates[i];
        const feats = (item.features || {}) as Record<string, unknown>;

        // Build a unique descriptive badge
        const badgeParts: string[] = [];

        // Guaranteed unique tier rank
        badgeParts.push(tierNames[i] || `Тариф ${i + 1}`);

        // Warranty badge
        const warranty = typeof item.warranty === 'number' ? item.warranty : typeof feats.warranty === 'number' ? feats.warranty : 0;
        if (warranty > 0) {
          badgeParts.push(`Гарантия ${warranty}д`);
        }

        // Speed badge
        const velocity = typeof item.velocity === 'number' ? item.velocity : typeof feats.velocity === 'number' ? feats.velocity : 0;
        if (velocity > 0) {
          const formattedVel = velocity >= 1000 ? `${Math.round(velocity / 1000)}k` : String(velocity);
          badgeParts.push(`до ${formattedVel}/д`);
        }

        // Geo badge
        const geo = typeof feats.geo === 'string' && feats.geo !== 'WORLDWIDE' ? feats.geo : null;
        if (geo) {
          badgeParts.push(geo);
        }

        // Min-Max limits badge if distinctive
        if (item.minQty > 10) {
          badgeParts.push(`от ${item.minQty}`);
        }

        const badgeString = `[${badgeParts.join(' • ')}]`;
        const baseName = item.name.replace(/\s*\[.*?\]\s*$/gi, '').trim();
        const newName = `${baseName} ${badgeString}`;

        if (newName !== item.name) {
          await db.service.update({
            where: { id: item.id },
            data: { name: newName },
          });
          differentiatedCount++;
        }
      }
    }
  }
  console.log(`   ✅ Differentiated ${differentiatedCount} duplicate service names with unique quality badges.\n`);

  console.log('====================================================');
  console.log('  🎉 All Catalog Optimizations Successfully Applied! ');
  console.log('====================================================');
}

main()
  .catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
