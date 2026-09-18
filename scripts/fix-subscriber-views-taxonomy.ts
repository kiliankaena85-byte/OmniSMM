import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runRemediation() {
  console.log('🚀 Starting DB Remediation for Subscriber Services improperly categorized as Views...');
  
  // Find categories that have 'VIEWS' activity type or 'просмотр' in name
  const viewsCategories = await prisma.category.findMany({
    where: {
      OR: [
        { activityType: 'VIEWS' },
        { name: { contains: 'просмотр', mode: 'insensitive' } },
        { name: { contains: 'views', mode: 'insensitive' } },
      ],
    },
    include: {
      network: true,
    },
  });

  const viewsCategoryIds = viewsCategories.map(c => c.id);
  
  console.log(`Found ${viewsCategories.length} VIEWS categories.`);

  // Find all services in these categories that are actually subscribers
  const misplacedServices = await prisma.service.findMany({
    where: {
      categoryId: { in: viewsCategoryIds },
      OR: [
        { name: { contains: 'подписч', mode: 'insensitive' } },
        { name: { contains: 'member', mode: 'insensitive' } },
        { targetType: 'CHANNEL' },
      ],
    },
    include: {
      category: {
        include: {
          network: true,
        },
      },
    },
  });

  console.log(`Found ${misplacedServices.length} misplaced subscriber services in VIEWS categories.`);

  if (misplacedServices.length === 0) {
    console.log('✅ No remediation needed.');
    return;
  }

  // Group by network and tenant to find/create the target SUBSCRIBERS categories
  const targetCategoryCache = new Map<string, string>(); // key: networkId_tenantId -> categoryId

  let fixedCount = 0;

  for (const service of misplacedServices) {
    const networkId = service.category.network?.id;
    if (!networkId) {
      console.warn(`⚠️ Service ${service.id} has no network, skipping...`);
      continue;
    }
    
    const tenantId = service.tenantId || service.category.tenantId || 'smmplan';
    const cacheKey = `${networkId}_${tenantId}`;

    let targetCatId = targetCategoryCache.get(cacheKey);

    if (!targetCatId) {
      // Look up existing SUBSCRIBERS category for this network/tenant
      let subCat = await prisma.category.findFirst({
        where: {
          networkId: networkId,
          tenantId: { in: [tenantId, 'all'] },
          OR: [
            { activityType: 'SUBSCRIBERS' },
            { name: { contains: 'Подписчики', mode: 'insensitive' } },
          ],
        },
      });

      if (!subCat) {
        // Create one if it doesn't exist
        console.log(`Creating SUBSCRIBERS category for network ${service.category.network?.name}...`);
        const networkSlug = service.category.network?.slug || 'unknown';
        const baseSlug = `${networkSlug}-subscribers`;
        
        let finalSlug = baseSlug;
        let counter = 0;
        while (await prisma.category.findFirst({ where: { slug: finalSlug, tenantId: { in: [tenantId, 'all'] } } })) {
          counter++;
          finalSlug = `${baseSlug}-${counter}`;
        }
        
        subCat = await prisma.category.create({
          data: {
            name: 'Подписчики',
            slug: finalSlug,
            networkId: networkId,
            tenantId: tenantId,
            activityType: 'SUBSCRIBERS',
            sort: 10,
          }
        });
      }
      
      targetCatId = subCat.id;
      targetCategoryCache.set(cacheKey, targetCatId);
    }

    // Update the service
    await prisma.service.update({
      where: { id: service.id },
      data: { categoryId: targetCatId },
    });
    
    console.log(`✅ Fixed: "${service.name}" -> Moved from "${service.category.name}" to category ID ${targetCatId}`);
    fixedCount++;
  }

  console.log(`\n🎉 Remediation complete! Fixed ${fixedCount} services.`);
}

runRemediation()
  .catch(e => {
    console.error('Fatal error during remediation:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
