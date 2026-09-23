import { PrismaClient } from '@prisma/client';
import { slugify } from '../src/utils/slugify';

const prisma = new PrismaClient();

async function cleanAllCategorySlugs() {
  const categories = await prisma.category.findMany({
    include: { network: true }
  });

  console.log(`Обновление ${categories.length} категорий...`);

  for (const cat of categories) {
    const netSlug = cat.network?.slug || 'generic';
    let baseSlug = slugify(cat.name);
    if (!baseSlug || baseSlug.length === 0) {
      baseSlug = `cat-${cat.id.slice(-6)}`;
    }

    let fullSlug = `${netSlug}-${baseSlug}`;

    // Ensure uniqueness
    const existing = await prisma.category.findFirst({
      where: { slug: fullSlug, id: { not: cat.id } }
    });

    if (existing) {
      fullSlug = `${fullSlug}-${cat.id.slice(-4)}`;
    }

    await prisma.category.update({
      where: { id: cat.id },
      data: { slug: fullSlug }
    });

    console.log(`[${netSlug}] "${cat.name}" -> slug: "${fullSlug}"`);
  }

  console.log('✅ Все слоги категорий успешно обновлены на уникальные и читаемые!');
}

cleanAllCategorySlugs().catch(console.error).finally(() => prisma.$disconnect());
