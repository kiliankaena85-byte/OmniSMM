if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes(':5433')) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5435/smmplan_lite?schema=public&sslmode=disable';
}

async function remediate() {
  const { db } = await import('../src/lib/db');
  const { redis } = await import('../src/lib/redis');

  console.log('=== STARTING DATABASE REMEDIATION ===\n');

  // 1. Find categories
  const subscribersCat = await db.category.findFirst({
    where: { slug: 'telegram-subscribers' }
  });
  if (!subscribersCat) {
    throw new Error('Category telegram-subscribers not found!');
  }
  console.log(`[1] Found telegram-subscribers category: ${subscribersCat.id} (${subscribersCat.name})`);

  const storiesCat = await db.category.findFirst({
    where: { slug: 'telegram-stories' }
  });
  if (!storiesCat) {
    throw new Error('Category telegram-stories not found!');
  }
  console.log(`[2] Found telegram-stories category: ${storiesCat.id} (${storiesCat.name})`);

  // 2. Prepend "Telegram " to services 1642 and 1643
  const servicesToRename = await db.service.findMany({
    where: { externalId: { in: ['1642', '1643'] } }
  });
  for (const s of servicesToRename) {
    if (!/telegram|телеграм|\bтг\b/i.test(s.name)) {
      const newName = `Telegram ${s.name}`;
      await db.service.update({
        where: { id: s.id },
        data: { name: newName }
      });
      console.log(`[3] Renamed [#${s.numericId}] "${s.name}" -> "${newName}" (tenant: ${s.tenantId})`);
    } else {
      console.log(`[3] Service [#${s.numericId}] already has Telegram brand in name: "${s.name}"`);
    }
  }

  // 3. Move services 2072, 2077, 2079 to telegram-subscribers category with targetType: 'CHANNEL'
  const subServices = await db.service.findMany({
    where: { externalId: { in: ['2072', '2077', '2079'] } }
  });
  for (const s of subServices) {
    await db.service.update({
      where: { id: s.id },
      data: {
        categoryId: subscribersCat.id,
        targetType: 'CHANNEL'
      }
    });
    console.log(`[4] Moved [#${s.numericId} / ext: ${s.externalId}] "${s.name}" to telegram-subscribers with targetType: CHANNEL (tenant: ${s.tenantId})`);
  }

  // 4. Move service 1904 to telegram-stories category with targetType: 'STORY'
  const storiesServices = await db.service.findMany({
    where: { externalId: '1904' }
  });
  for (const s of storiesServices) {
    await db.service.update({
      where: { id: s.id },
      data: {
        categoryId: storiesCat.id,
        targetType: 'STORY'
      }
    });
    console.log(`[5] Moved [#${s.numericId} / ext: ${s.externalId}] "${s.name}" to telegram-stories with targetType: STORY (tenant: ${s.tenantId})`);
  }

  // 5. Update all 14 multi-post services to targetType: 'CHANNEL_POSTS'
  const multiPostExtIds = ['2304', '2305', '2306', '2307', '2308', '2733', '2734', '2735', '2672', '2673', '2674', '2675', '1642', '1643'];
  const multiPostUpdateRes = await db.service.updateMany({
    where: { externalId: { in: multiPostExtIds } },
    data: { targetType: 'CHANNEL_POSTS' }
  });
  console.log(`[6] Updated ${multiPostUpdateRes.count} multi-post services (extIds ${multiPostExtIds.join(', ')}) to targetType: CHANNEL_POSTS`);

  // 6. Clear Redis Cache Tags
  try {
    const keys = await redis.keys('*catalog*');
    const serviceKeys = await redis.keys('*service*');
    const viewKeys = await redis.keys('*view*');
    const allKeys = Array.from(new Set([...keys, ...serviceKeys, ...viewKeys]));
    if (allKeys.length > 0) {
      await redis.del(...allKeys);
      console.log(`[7] Invalidated ${allKeys.length} Redis cache keys`);
    } else {
      console.log(`[7] No matching Redis cache keys found to invalidate`);
    }
  } catch (err) {
    console.warn('[7] Redis cache invalidation warning (non-fatal):', err);
  }

  console.log('\n=== REMEDIATION COMPLETED SUCCESSFULLY ===');
}

remediate()
  .catch((err) => {
    console.error('Remediation error:', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
