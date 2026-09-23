/**
 * scripts/cleanup-category-names.ts
 *
 * Normalizes all category display names in the DB to be concise and clean.
 * Removes redundant network suffixes (e.g. "Реакции Max" -> "Реакции",
 * "Подписчики Telegram" -> "Подписчики") while preserving unique slugs.
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('--- Cleaning up category display names ---');

  const categories = await db.category.findMany({
    include: { network: true },
  });

  let updatedCount = 0;

  for (const cat of categories) {
    if (!cat.network) continue;

    const netName = cat.network.name;
    const netSlug = cat.network.slug;

    // Check if category name contains redundant network name suffix or prefix
    // E.g. "Реакции Max", "Реакции Telegram", "Подписчики Telegram", "Max Реакции"
    let cleanName = cat.name.trim();

    // Regex to strip trailing network name: e.g. " Telegram", " Max", " (Telegram)"
    const trailingRegex = new RegExp(`\\s+${netName}$|\\s+${netSlug}$|\\s+\\(${netName}\\)$`, 'i');
    const leadingRegex = new RegExp(`^${netName}\\s+|^${netSlug}\\s+`, 'i');

    if (trailingRegex.test(cleanName)) {
      cleanName = cleanName.replace(trailingRegex, '').trim();
    } else if (leadingRegex.test(cleanName)) {
      cleanName = cleanName.replace(leadingRegex, '').trim();
    }

    if (cleanName !== cat.name) {
      console.log(`[${netName}] "${cat.name}" -> "${cleanName}"`);
      await db.category.update({
        where: { id: cat.id },
        data: { name: cleanName },
      });
      updatedCount++;
    }
  }

  console.log(`\n✅ Done! Updated ${updatedCount} categories to concise display names.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
