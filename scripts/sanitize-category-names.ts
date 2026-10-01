import 'dotenv/config';
import { db } from '../src/lib/db';
import { cleanCategoryName } from '../src/components/ui/CategoryIcon';

async function main() {
  console.log('=== Sanitizing Category Names in Database ===');
  
  const categories = await db.category.findMany({
    include: {
      network: {
        select: { id: true, name: true, slug: true }
      }
    }
  });

  console.log(`Fetched ${categories.length} categories.`);
  let updatedCount = 0;

  for (const cat of categories) {
    const cleaned = cleanCategoryName(cat.name, cat.network?.name);
    if (cleaned !== cat.name) {
      console.log(`[${cat.network?.name || 'ALL'}] "${cat.name}" -> "${cleaned}"`);
      await db.category.update({
        where: { id: cat.id },
        data: { name: cleaned }
      });
      updatedCount++;
    }
  }

  console.log(`\nSuccessfully sanitized ${updatedCount} category names in PostgreSQL.`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
    process.exit(0);
  });
