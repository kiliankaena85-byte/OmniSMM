import { PrismaClient } from '@prisma/client';
import { inferTargetTypeFromCategory } from './src/utils/target-type';

async function main() {
  const prisma = new PrismaClient();
  try {
    const services = await prisma.service.findMany({
      include: { category: true }
    });

    console.log('--- DB TARGETTYPE AUDIT SUMMARY ---');
    console.log(`Total Services in DB: ${services.length}`);

    // Group by stored targetType
    const storedCounts: Record<string, number> = {};
    for (const s of services) {
      storedCounts[s.targetType] = (storedCounts[s.targetType] || 0) + 1;
    }
    console.log('\nStored targetType distribution:');
    console.log(storedCounts);

    // Analyze mismatches against inferTargetTypeFromCategory
    const mismatches: any[] = [];
    const correct: any[] = [];

    for (const s of services) {
      const catName = s.category?.name || '';
      const inferred = inferTargetTypeFromCategory(catName);
      if (s.targetType !== inferred) {
        mismatches.push({
          id: s.id,
          numericId: s.numericId,
          name: s.name,
          categoryName: catName,
          stored: s.targetType,
          inferred,
        });
      } else {
        correct.push(s);
      }
    }

    console.log(`\nMismatches against inferTargetTypeFromCategory: ${mismatches.length}`);
    console.log(`Correct mappings: ${correct.length}`);

    // Break down mismatches by category
    const mismatchByCat: Record<string, Array<{ id: string; name: string; stored: string; inferred: string }>> = {};
    for (const m of mismatches) {
      if (!mismatchByCat[m.categoryName]) {
        mismatchByCat[m.categoryName] = [];
      }
      mismatchByCat[m.categoryName].push({
        id: m.id,
        name: m.name,
        stored: m.stored,
        inferred: m.inferred,
      });
    }

    console.log('\nMismatch categories:');
    for (const [cat, items] of Object.entries(mismatchByCat)) {
      console.log(`Category: "${cat}" - ${items.length} mismatches`);
      console.log(`  Sample stored: "${items[0].stored}", expected inferred: "${items[0].inferred}"`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
