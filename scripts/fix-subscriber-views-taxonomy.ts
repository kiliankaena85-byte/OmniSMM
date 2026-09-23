import { PrismaClient } from '@prisma/client';

async function main() {
  let dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5435/smmplan_lite?schema=public&sslmode=disable';

  // Test if default URL has services, otherwise try port 5435
  let prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  let count = await prisma.service.count().catch(() => 0);
  if (count === 0) {
    const fallbackUrl = 'postgresql://postgres:postgres@127.0.0.1:5435/smmplan_lite?schema=public&sslmode=disable';
    if (dbUrl !== fallbackUrl) {
      await prisma.$disconnect().catch(() => {});
      dbUrl = fallbackUrl;
      prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
      count = await prisma.service.count().catch(() => 0);
    }
  }

  console.log(`🚀 Starting Comprehensive Taxonomy Remediation on DB (${dbUrl.replace(/:[^:@]+@/, ':***@')}). Total services: ${count}...`);

  // Helper to ensure category exists
  const categoryCache = new Map<string, string>(); // key: networkId_activityType_tenantId -> categoryId

  async function getOrCreateCategory(networkId: string, networkName: string, networkSlug: string, activityType: string, tenantId: string): Promise<string> {
    const cacheKey = `${networkId}_${activityType}_${tenantId}`;
    if (categoryCache.has(cacheKey)) return categoryCache.get(cacheKey)!;

    let cat = await prisma.category.findFirst({
      where: {
        networkId,
        tenantId: { in: [tenantId, 'all'] },
        OR: [
          { activityType },
          ...(activityType === 'SUBSCRIBERS' ? [{ name: { contains: 'подписч', mode: 'insensitive' as const } }] : []),
          ...(activityType === 'VIEWS' ? [{ name: { contains: 'просмотр', mode: 'insensitive' as const } }] : []),
          ...(activityType === 'LIKES' ? [{ name: { contains: 'лайк', mode: 'insensitive' as const } }] : []),
          ...(activityType === 'COMMENTS' ? [{ name: { contains: 'коммент', mode: 'insensitive' as const } }] : []),
          ...(activityType === 'REACTIONS' ? [{ name: { contains: 'реакц', mode: 'insensitive' as const } }] : []),
          ...(activityType === 'STREAMS' ? [{ name: { contains: 'стрим', mode: 'insensitive' as const } }] : []),
        ]
      },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });

    if (cat) {
      if (!cat.activityType) {
        await prisma.category.update({ where: { id: cat.id }, data: { activityType } });
      }
      categoryCache.set(cacheKey, cat.id);
      return cat.id;
    }

    // Auto-create category
    const displayNames: Record<string, string> = {
      SUBSCRIBERS: 'Подписчики',
      VIEWS: 'Просмотры',
      LIKES: 'Лайки',
      COMMENTS: 'Комментарии',
      REACTIONS: 'Реакции',
      REPOSTS: 'Репосты',
      AUTO_VIEWS: 'Автопросмотры',
      AUTO_LIKES: 'Автолайки',
      STREAMS: 'Стримы',
    };
    const name = displayNames[activityType] || activityType;
    const baseSlug = `${networkSlug}-${activityType.toLowerCase().replace(/_/g, '-')}`;
    let finalSlug = baseSlug;
    let n = 0;
    while (await prisma.category.findUnique({ where: { slug: finalSlug } })) {
      n++;
      finalSlug = `${baseSlug}-${n}`;
    }

    const created = await prisma.category.create({
      data: {
        name,
        slug: finalSlug,
        networkId,
        tenantId,
        activityType,
        sort: activityType === 'SUBSCRIBERS' ? 10 : activityType === 'LIKES' ? 20 : 30,
      }
    });

    categoryCache.set(cacheKey, created.id);
    return created.id;
  }

  // 1. Fetch all services
  const allServices = await prisma.service.findMany({
    include: {
      category: {
        include: {
          network: true,
        }
      }
    }
  });

  let fixedCount = 0;

  for (const s of allServices) {
    const n = s.name.toLowerCase();
    const currentAct = s.category?.activityType || '';
    const currentCatName = (s.category?.name || '').toLowerCase();
    const net = s.category?.network;

    if (!net) continue;

    let targetAct: string | null = null;
    let newTargetType: string | null = null;

    // Check Subscribers misplaced
    if (/подписч|member|follower|читател|фолловер/i.test(n) && !/авто.*просмотр|просмотр.*подпис/i.test(n)) {
      if (currentAct !== 'SUBSCRIBERS' || currentCatName.includes('просмотр') || currentCatName.includes('лайк') || currentCatName.includes('коммент')) {
        targetAct = 'SUBSCRIBERS';
        newTargetType = 'CHANNEL';
      } else if (s.targetType === 'POST') {
        newTargetType = 'CHANNEL';
      }
    }
    // Check Views misplaced
    else if (/просмотр|view|гляделок|глаз/i.test(n) && !/подписч|member|реакц|лайк/i.test(n)) {
      const isAuto = /авто|auto|будущ/i.test(n);
      const expected = isAuto ? 'AUTO_VIEWS' : 'VIEWS';
      if (currentAct !== expected && currentAct !== 'VIEWS' && currentAct !== 'AUTO_VIEWS' && currentAct !== 'AUTO_SERVICES') {
        targetAct = expected;
        newTargetType = 'POST';
      }
    }
    // Check Likes misplaced
    else if (/лайк|like|сердеч/i.test(n) && !/подписч|просмотр|репост/i.test(n)) {
      const isAuto = /авто|auto|будущ/i.test(n);
      const expected = isAuto ? 'AUTO_LIKES' : 'LIKES';
      if (currentAct !== expected && currentAct !== 'LIKES' && currentAct !== 'AUTO_LIKES' && currentAct !== 'AUTO_SERVICES') {
        targetAct = expected;
      }
    }
    // Check Comments misplaced
    else if (/коммент|отзыв|comment/i.test(n) && !/подписч|лайк|просмотр/i.test(n)) {
      if (currentAct !== 'COMMENTS' && currentAct !== 'AUTO_COMMENTS') {
        targetAct = 'COMMENTS';
      }
    }
    // Check Reactions misplaced
    else if (/реакци|emoji|reaction/i.test(n) && !/подписч/i.test(n)) {
      if (currentAct !== 'REACTIONS' && currentAct !== 'AUTO_REACTIONS') {
        targetAct = 'REACTIONS';
      }
    }
    // Check Streams / Battle misplaced
    else if (/стрим|stream|live|эфир|баттл|battle/i.test(n) && !/подписч/i.test(n)) {
      if (currentAct !== 'STREAMS') {
        targetAct = 'STREAMS';
        newTargetType = 'CUSTOM';
      }
    }

    if (targetAct || (newTargetType && newTargetType !== s.targetType)) {
      const tenant = s.tenantId || 'smmplan';
      const updateData: { categoryId?: string; targetType?: string } = {};

      if (targetAct) {
        const targetCatId = await getOrCreateCategory(net.id, net.name, net.slug, targetAct, tenant);
        if (targetCatId !== s.categoryId) {
          updateData.categoryId = targetCatId;
        }
      }

      if (newTargetType && newTargetType !== s.targetType) {
        updateData.targetType = newTargetType;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.service.update({
          where: { id: s.id },
          data: updateData
        });
        console.log(`✅ Fixed service: "${s.name}" (ID: ${s.id}, Tenant: ${s.tenantId}) -> Moved to ${targetAct || currentAct}, targetType: ${newTargetType || s.targetType}`);
        fixedCount++;
      }
    }
  }

  console.log(`\n🎉 Remediation completed! Fixed ${fixedCount} misplaced services.`);

  // 2. Ensure smmplan has Telegram Views services
  // Check active Telegram Views services for smmplan
  const telegramViewsCat = await prisma.category.findFirst({
    where: { network: { slug: 'telegram' }, activityType: 'VIEWS' }
  });

  if (telegramViewsCat) {
    const smmplanViewsCount = await prisma.service.count({
      where: { categoryId: telegramViewsCat.id, tenantId: 'smmplan', isActive: true }
    });

    console.log(`Telegram Views services for smmplan: ${smmplanViewsCount}`);

    if (smmplanViewsCount < 10) {
      console.log('Cloning active Telegram Views services from flux to smmplan...');
      const fluxViews = await prisma.service.findMany({
        where: { categoryId: telegramViewsCat.id, tenantId: 'flux', isActive: true }
      });

      let clonedCount = 0;
      for (const f of fluxViews) {
        const existingSmmplan = await prisma.service.findFirst({
          where: { externalId: f.externalId, tenantId: 'smmplan' }
        });

        if (existingSmmplan) continue;

        const baseSlug = f.slug ? `${f.slug}-smmplan` : `telegram-views-${f.externalId}`;
        let finalSlug = baseSlug;
        let count = 0;
        while (await prisma.service.findFirst({ where: { tenantId: 'smmplan', slug: finalSlug } })) {
          count++;
          finalSlug = `${baseSlug}-${count}`;
        }

        await prisma.service.create({
          data: {
            name: f.name,
            slug: finalSlug,
            description: f.description,
            categoryId: telegramViewsCat.id,
            tenantId: 'smmplan',
            providerId: f.providerId,
            rate: f.rate,
            costPer1kRub: f.costPer1kRub,
            providerCurrency: f.providerCurrency,
            markup: f.markup,
            minQty: f.minQty,
            maxQty: f.maxQty,
            externalId: f.externalId,
            targetType: f.targetType || 'POST',
            isActive: true,
          }
        });
        clonedCount++;
      }
      console.log(`✅ Cloned ${clonedCount} Telegram Views services for smmplan.`);
    }
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal error in remediation:', err);
  process.exit(1);
});
