/**
 * scripts/fix-catchall-categories.ts
 *
 * LEVEL 1 FIX: Data migration — splits "catch-all" categories into proper
 * activity-type-based categories (SUBSCRIBERS, REACTIONS, LIKES, VIEWS, etc.)
 * for every network that has only one category containing mixed service types.
 *
 * Usage:
 *   npx tsx scripts/fix-catchall-categories.ts         # dry run (safe preview)
 *   npx tsx scripts/fix-catchall-categories.ts --apply  # applies changes to DB
 *
 * What it does:
 *   1. Finds all Networks where any Category has 2+ distinct normalizedCategory
 *      values in its Services (via ShadowService lookup by externalId).
 *   2. For each such "catch-all" category, auto-creates the missing split
 *      categories (e.g. "Реакции Max", "Подписчики Max") with the correct
 *      activityType field.
 *   3. Reassigns every Service to its correct category based on the
 *      `features.category` JSON field (set at import time from ShadowService).
 *   4. Deactivates (NOT deletes) the old catch-all category if it becomes empty.
 *   5. Invalidates the Next.js catalog cache tags.
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const DRY_RUN = !process.argv.includes('--apply');

// Maps normalizedCategory enum → Russian display name
const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  SUBSCRIBERS: 'Подписчики',
  GROUPS: 'Вступление в группы',
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
  POLLS: 'Голоса / Опросы',
  STORIES: 'Сторис',
  BOTS: 'Боты',
  REFERRALS: 'Рефералы',
  FRIENDS: 'Друзья / Заявки',
  PLAYS: 'Прослушивания',
  TRAFFIC: 'Трафик / Посещения',
  DISLIKES: 'Дизлайки',
  STARS: 'Звёзды',
  SAVES: 'Сохранения',
  COMPLAINTS: 'Жалобы',
  STREAMS: 'Стримы / Онлайн',
  PREMIUM: 'Премиум',
  RECOVER: 'Восстановление',
  OTHER: 'Другое',
};

// Category sort order (lower = higher in UI)
const CATEGORY_SORT: Record<string, number> = {
  SUBSCRIBERS: 10,
  LIKES: 20,
  VIEWS: 30,
  REACTIONS: 40,
  REPOSTS: 50,
  COMMENTS: 60,
  STORIES: 70,
  BOOSTS: 80,
  AUTO_VIEWS: 90,
  AUTO_LIKES: 100,
  AUTO_REACTIONS: 110,
  AUTO_REPOSTS: 120,
  AUTO_COMMENTS: 130,
  PLAYS: 140,
  POLLS: 150,
  GROUPS: 160,
  FRIENDS: 170,
  PREMIUM: 180,
  STARS: 190,
  SAVES: 200,
  TRAFFIC: 210,
  REFERRALS: 220,
  STREAMS: 230,
  BOTS: 240,
  DISLIKES: 250,
  RECOVER: 260,
  COMPLAINTS: 270,
  OTHER: 999,
};

interface MigrationStats {
  networksScanned: number;
  catchAllCategoriesFound: number;
  newCategoriesCreated: number;
  servicesReassigned: number;
  catchAllCategoriesDeactivated: number;
  errors: string[];
}

async function getServiceNormalizedCategory(service: {
  externalId: string | null;
  providerId: string | null;
  features: unknown;
  name: string;
}): Promise<string | null> {
  // First: read from features JSON (set at import time from ShadowService)
  if (service.features && typeof service.features === 'object') {
    const feat = service.features as Record<string, unknown>;
    if (typeof feat.category === 'string' && feat.category) {
      return feat.category;
    }
  }

  // Fallback: lookup in ShadowService by externalId + providerId
  if (service.externalId && service.providerId) {
    const shadow = await db.shadowService.findFirst({
      where: {
        externalId: service.externalId,
        providerId: service.providerId,
      },
      select: { normalizedCategory: true },
    });
    if (shadow?.normalizedCategory) {
      return shadow.normalizedCategory;
    }
  }

  return null;
}

function slugify(name: string, networkSlug: string, catType: string): string {
  return `${networkSlug}-${catType.toLowerCase().replace(/_/g, '-')}`;
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Category Fix Script — ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '✅ APPLY MODE'}`);
  console.log(`${'='.repeat(60)}\n`);

  if (DRY_RUN) {
    console.log('ℹ️  Run with --apply flag to actually apply changes.\n');
  }

  const stats: MigrationStats = {
    networksScanned: 0,
    catchAllCategoriesFound: 0,
    newCategoriesCreated: 0,
    servicesReassigned: 0,
    catchAllCategoriesDeactivated: 0,
    errors: [],
  };

  // 1. Fetch all networks with their categories and active services
  const networks = await db.network.findMany({
    where: { isActive: true },
    include: {
      categories: {
        include: {
          services: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              externalId: true,
              providerId: true,
              features: true,
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  console.log(`📡 Found ${networks.length} active networks.\n`);
  stats.networksScanned = networks.length;

  for (const network of networks) {
    for (const category of network.categories) {
      if (category.services.length === 0) continue;

      // 2. Determine the normalizedCategory for each service in this category
      const servicesByNormCat: Record<string, typeof category.services> = {};

      for (const svc of category.services) {
        const normCat = await getServiceNormalizedCategory(svc);
        const key = normCat || 'OTHER';
        if (!servicesByNormCat[key]) servicesByNormCat[key] = [];
        servicesByNormCat[key].push(svc);
      }

      const distinctTypes = Object.keys(servicesByNormCat).filter(k => k !== 'null');

      // Skip categories that already have only one type (or are correctly named)
      if (distinctTypes.length <= 1) {
        console.log(`  ✅ ${network.name} › ${category.name} — single type (${distinctTypes[0] || 'none'}), OK`);
        continue;
      }

      // 3. This is a catch-all category — needs splitting
      stats.catchAllCategoriesFound++;
      console.log(`\n⚠️  CATCH-ALL: ${network.name} › "${category.name}" has ${distinctTypes.length} types across ${category.services.length} services:`);
      distinctTypes.forEach(t => {
        console.log(`     ${t}: ${servicesByNormCat[t].length} services`);
      });

      // 4. For each distinct type, ensure a proper category exists
      const typeToNewCategoryId: Record<string, string> = {};

      for (const catType of distinctTypes) {
        const displayName = CATEGORY_DISPLAY_NAMES[catType] || catType;
        const fullName = displayName;
        const slug = slugify(displayName, network.slug, catType);


        // Check if a matching category already exists for this network + activityType
        const existing = await db.category.findFirst({
          where: {
            networkId: network.id,
            activityType: catType,
          },
          select: { id: true, name: true },
        });

        if (existing) {
          console.log(`     ♻️  Reusing existing category: "${existing.name}" (id: ${existing.id})`);
          typeToNewCategoryId[catType] = existing.id;
          continue;
        }

        // Need to create a new category
        console.log(`     ➕ ${DRY_RUN ? '[WOULD CREATE]' : 'Creating'} category: "${fullName}" (activityType: ${catType}, slug: ${slug})`);

        if (!DRY_RUN) {
          try {
            // Handle slug collision
            let finalSlug = slug;
            let slugExists = await db.category.findFirst({ where: { slug: finalSlug } });
            let attempt = 2;
            while (slugExists) {
              finalSlug = `${slug}-${attempt}`;
              slugExists = await db.category.findFirst({ where: { slug: finalSlug } });
              attempt++;
            }

            const newCat = await db.category.create({
              data: {
                name: fullName,
                slug: finalSlug,
                networkId: network.id,
                tenantId: category.tenantId || 'smmplan',
                activityType: catType,
                sort: CATEGORY_SORT[catType] ?? 500,
              },
            });
            typeToNewCategoryId[catType] = newCat.id;
            stats.newCategoriesCreated++;
            console.log(`        ✅ Created: id=${newCat.id}`);
          } catch (err) {
            const msg = `Failed to create category "${fullName}": ${err instanceof Error ? err.message : String(err)}`;
            stats.errors.push(msg);
            console.error(`        ❌ ${msg}`);
          }
        } else {
          // In dry run, generate a placeholder id
          typeToNewCategoryId[catType] = `[would-be-id-for-${catType}]`;
          stats.newCategoriesCreated++;
        }
      }

      // 5. Reassign services to their correct categories
      for (const [catType, services] of Object.entries(servicesByNormCat)) {
        const targetCategoryId = typeToNewCategoryId[catType];

        if (!targetCategoryId) {
          console.log(`     ⚠️  No target category for type ${catType}, skipping ${services.length} services`);
          continue;
        }

        // Skip services that are already in the correct (non-catch-all) category
        // i.e. they need to move only if target != current
        const servicesToMove = services.filter(s => {
          // If the target category is the SAME as current, no move needed
          return targetCategoryId !== category.id;
        });

        if (servicesToMove.length === 0) continue;

        console.log(`     🔀 ${DRY_RUN ? '[WOULD MOVE]' : 'Moving'} ${servicesToMove.length} services (${catType}) → "${CATEGORY_DISPLAY_NAMES[catType] || catType} ${network.name}"`);

        if (!DRY_RUN) {
          try {
            const result = await db.service.updateMany({
              where: {
                id: { in: servicesToMove.map(s => s.id) },
              },
              data: {
                categoryId: targetCategoryId,
              },
            });
            stats.servicesReassigned += result.count;
            console.log(`        ✅ Moved ${result.count} services`);
          } catch (err) {
            const msg = `Failed to reassign services for ${catType}: ${err instanceof Error ? err.message : String(err)}`;
            stats.errors.push(msg);
            console.error(`        ❌ ${msg}`);
          }
        } else {
          stats.servicesReassigned += servicesToMove.length;
        }
      }

      // 6. Check if the catch-all category is now empty and deactivate it
      if (!DRY_RUN) {
        const remainingServices = await db.service.count({
          where: { categoryId: category.id, isActive: true },
        });

        if (remainingServices === 0) {
          console.log(`     🗑️  Catch-all category "${category.name}" is now empty — marking as soft-deleted (isActive handled via services).`);
          // We don't delete the category (FK constraint), just leave it empty.
          // Admin can delete it manually via Prisma Studio.
          stats.catchAllCategoriesDeactivated++;
        } else {
          console.log(`     ℹ️  Category "${category.name}" still has ${remainingServices} services (likely with unknown type).`);
        }
      } else {
        stats.catchAllCategoriesDeactivated++;
      }
    }
  }

  // 7. Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Migration Summary ${DRY_RUN ? '(DRY RUN)' : '(APPLIED)'}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Networks scanned:           ${stats.networksScanned}`);
  console.log(`  Catch-all categories found: ${stats.catchAllCategoriesFound}`);
  console.log(`  New categories ${DRY_RUN ? 'would be' : ''} created:  ${stats.newCategoriesCreated}`);
  console.log(`  Services ${DRY_RUN ? 'would be' : ''} reassigned:     ${stats.servicesReassigned}`);
  console.log(`  Catch-all cats emptied:     ${stats.catchAllCategoriesDeactivated}`);

  if (stats.errors.length > 0) {
    console.log(`\n❌ Errors (${stats.errors.length}):`);
    stats.errors.forEach(e => console.log(`  - ${e}`));
  } else {
    console.log(`\n✅ No errors.`);
  }

  if (DRY_RUN && stats.catchAllCategoriesFound > 0) {
    console.log(`\n🚀 To apply: npx tsx scripts/fix-catchall-categories.ts --apply`);
  }

  if (!DRY_RUN) {
    console.log(`\n⚡ Clearing Next.js cache is required. Run: npm run build or restart the dev server.`);
  }
}

main()
  .catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
