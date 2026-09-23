import 'dotenv/config';
import { db } from '../src/lib/db';
import { SmartAnalyzerLogic } from '../src/services/providers/smart-analyzer.logic';

function maskDbUrl(url?: string): string {
  if (!url) return 'UNDEFINED';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`;
  } catch {
    return url.replace(/:[^:@]+@/, ':***@');
  }
}

async function main() {
  const isApply = process.argv.includes('--apply');
  const maskedUrl = maskDbUrl(process.env.DATABASE_URL);
  console.log(`[Doctor] Connected DB (masked): ${maskedUrl}`);
  console.log(`[Doctor] Mode: ${isApply ? 'APPLY (Mutations ENABLED)' : 'DRY-RUN (Read-Only)'}`);

  // Find all categories with networkId === null that have active, non-quarantined services
  const orphanCategories = await db.category.findMany({
    where: {
      networkId: null,
      services: {
        some: {
          isActive: true,
          isQuarantined: false
        }
      }
    },
    include: {
      services: {
        where: { isActive: true, isQuarantined: false },
        select: { id: true, name: true }
      }
    }
  });

  console.log(`[Doctor] Found ${orphanCategories.length} orphan categories with active services.`);

  if (orphanCategories.length === 0) {
    console.log('[Doctor] No orphan categories found requiring relinking.');
    return;
  }

  const plan: Array<{
    categoryId: string;
    categoryName: string;
    targetNetworkSlug: string;
    targetNetworkName: string;
  }> = [];

  for (const cat of orphanCategories) {
    const analysis = SmartAnalyzerLogic.detectSync(cat.name, '', cat.name);
    const platformName = analysis.platform || 'Other';
    const platformSlug = (analysis.platformSlug || platformName).toLowerCase();

    plan.push({
      categoryId: cat.id,
      categoryName: cat.name,
      targetNetworkSlug: platformSlug,
      targetNetworkName: platformName
    });
  }

  console.log('\n--- Relinking Plan ---');
  for (const item of plan) {
    console.log(`Category: "${item.categoryName}" (${item.categoryId}) -> Network: "${item.targetNetworkName}" [${item.targetNetworkSlug}]`);
  }

  if (!isApply) {
    console.log('\n[Doctor] DRY-RUN complete. No database mutations were performed. Pass --apply to execute mutations.');
    return;
  }

  console.log('\n[Doctor] Executing mutations via transaction...');

  await db.$transaction(async (tx) => {
    for (const item of plan) {
      let network = await tx.network.findFirst({
        where: { slug: item.targetNetworkSlug }
      });

      if (!network) {
        network = await tx.network.create({
          data: {
            name: item.targetNetworkName,
            slug: item.targetNetworkSlug,
            tenantId: 'all',
            isActive: true,
            sort: 0
          }
        });
        console.log(`[Doctor TX] Created Network: ${network.name} (${network.slug})`);
      }

      await tx.category.update({
        where: { id: item.categoryId },
        data: { networkId: network.id }
      });
      console.log(`[Doctor TX] Linked Category "${item.categoryName}" -> Network "${network.name}"`);
    }
  });

  console.log('[Doctor] Relinking successfully applied!');
}

main().catch(console.error).finally(() => db.$disconnect());
