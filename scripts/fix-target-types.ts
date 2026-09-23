import { PrismaClient } from '@prisma/client';

/**
 * Migration script: Fix targetType for existing services.
 * 
 * ROOT CAUSE: Prisma @default("POST") + no explicit targetType during seed/import
 * caused ALL services to have targetType='POST', including Subscribers, Boosts, etc.
 * 
 * This script infers correct targetType from the category name.
 */

const CHANNEL_KEYWORDS = [
  'подписчик', 'участник', 'subscriber', 'follower',
  'буст', 'boost',
  'груп', 'group',
  'друз', 'friend',
  'premium участ',
];

const STORY_KEYWORDS = ['стори', 'story', 'stories', 'истори'];
const CUSTOM_KEYWORDS = ['звёзд', 'звезд', 'star'];

function inferTargetType(categoryName: string): string {
  const lower = categoryName.toLowerCase();
  if (CHANNEL_KEYWORDS.some(k => lower.includes(k))) return 'CHANNEL';
  if (STORY_KEYWORDS.some(k => lower.includes(k))) return 'STORY';
  if (CUSTOM_KEYWORDS.some(k => lower.includes(k))) return 'CUSTOM';
  return 'POST';
}

async function main() {
  const db = new PrismaClient();
  
  try {
    // Get all services with their category names
    const services = await db.service.findMany({
      select: { 
        id: true, 
        name: true, 
        targetType: true,
        category: { select: { name: true } }
      }
    });

    let updated = 0;
    let skipped = 0;

    for (const s of services) {
      const catName = s.category?.name || '';
      const correctType = inferTargetType(catName);
      
      if (s.targetType !== correctType) {
        await db.service.update({
          where: { id: s.id },
          data: { targetType: correctType }
        });
        console.log(`✅ ${s.name} | ${s.targetType} → ${correctType} (category: ${catName})`);
        updated++;
      } else {
        skipped++;
      }
    }

    console.log(`\n=== MIGRATION COMPLETE ===`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped (already correct): ${skipped}`);
    console.log(`Total: ${services.length}`);

    // Verify
    const counts = await db.service.groupBy({
      by: ['targetType'],
      _count: true
    });
    console.log('\n=== NEW DISTRIBUTION ===');
    counts.forEach(c => console.log(`${c.targetType}: ${c._count} services`));

  } finally {
    await db.$disconnect();
  }
}

main().catch(console.error);
