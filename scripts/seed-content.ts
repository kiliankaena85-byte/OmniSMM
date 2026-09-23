import { db } from '@/lib/db';
import { pillarPages, glossaryTerms, clusterArticles } from '../src/data/seo';

async function main() {
  console.log('🌱 [Seed Content] Starting SEO pillars, clusters & glossary seeding...');

  // 1. Seed Pillars (ContentType: PAGE)
  for (const pillar of pillarPages) {
    console.log(`Processing Pillar: ${pillar.slug}...`);

    await db.contentItem.upsert({
      where: { slug: pillar.slug },
      create: {
        slug: pillar.slug,
        title: pillar.title,
        excerpt: pillar.excerpt,
        contentHtml: pillar.contentHtml,
        type: 'PAGE',
        isPublished: true,
        publishedAt: new Date(),
        authorName: 'Команда SMMplan',
        metaTitle: pillar.metaTitle,
        metaDescription: pillar.excerpt,
        readTimeMinutes: pillar.readTimeMinutes,
      },
      update: {
        title: pillar.title,
        excerpt: pillar.excerpt,
        contentHtml: pillar.contentHtml,
        type: 'PAGE',
        isPublished: true,
        authorName: 'Команда SMMplan',
        metaTitle: pillar.metaTitle,
        metaDescription: pillar.excerpt,
        readTimeMinutes: pillar.readTimeMinutes,
      },
    });

    // Also sync to Article model if present in codebase for knowledge integration
    try {
      await db.article.upsert({
        where: { slug: pillar.slug },
        create: {
          slug: pillar.slug,
          title: pillar.title,
          description: pillar.excerpt,
          content: pillar.contentHtml,
          status: 'PUBLISHED',
          category: pillar.category,
          authorName: 'Команда SMMplan',
          authorRole: 'Редакция SMMplan',
          priority: 10,
        },
        update: {
          title: pillar.title,
          description: pillar.excerpt,
          content: pillar.contentHtml,
          status: 'PUBLISHED',
          category: pillar.category,
          authorName: 'Команда SMMplan',
          authorRole: 'Редакция SMMplan',
        },
      });
    } catch (e) {
      console.warn(`Article model sync skipped for ${pillar.slug}:`, e);
    }
  }

  // 2. Seed Cluster Articles (ContentType: PAGE)
  for (const cluster of clusterArticles) {
    console.log(`Processing Cluster: ${cluster.slug}...`);

    await db.contentItem.upsert({
      where: { slug: cluster.slug },
      create: {
        slug: cluster.slug,
        title: cluster.title,
        excerpt: cluster.excerpt,
        contentHtml: cluster.contentHtml,
        type: 'PAGE',
        isPublished: true,
        publishedAt: new Date(),
        authorName: 'Команда SMMplan',
        metaTitle: cluster.metaTitle,
        metaDescription: cluster.excerpt,
        readTimeMinutes: cluster.readTimeMinutes,
      },
      update: {
        title: cluster.title,
        excerpt: cluster.excerpt,
        contentHtml: cluster.contentHtml,
        type: 'PAGE',
        isPublished: true,
        authorName: 'Команда SMMplan',
        metaTitle: cluster.metaTitle,
        metaDescription: cluster.excerpt,
        readTimeMinutes: cluster.readTimeMinutes,
      },
    });

    try {
      await db.article.upsert({
        where: { slug: cluster.slug },
        create: {
          slug: cluster.slug,
          title: cluster.title,
          description: cluster.excerpt,
          content: cluster.contentHtml,
          status: 'PUBLISHED',
          category: cluster.category,
          authorName: 'Команда SMMplan',
          authorRole: 'Редакция SMMplan',
          priority: 5,
        },
        update: {
          title: cluster.title,
          description: cluster.excerpt,
          content: cluster.contentHtml,
          status: 'PUBLISHED',
          category: cluster.category,
          authorName: 'Команда SMMplan',
          authorRole: 'Редакция SMMplan',
        },
      });
    } catch (e) {
      console.warn(`Article model sync skipped for ${cluster.slug}:`, e);
    }
  }

  // 3. Seed Glossary (ContentType: GLOSSARY_TERM)
  for (const term of glossaryTerms) {
    const slug = term.slug; // e.g. 'glossary/smm' or 'glossary/drip-feed'
    console.log(`Processing Glossary Term: ${slug}...`);

    await db.contentItem.upsert({
      where: { slug },
      create: {
        slug,
        title: term.term,
        excerpt: term.definition,
        contentHtml: term.contentHtml,
        type: 'GLOSSARY_TERM',
        isPublished: true,
        publishedAt: new Date(),
        authorName: 'Команда SMMplan',
        metaTitle: `${term.term} — Что это такое? | Словарь SMM`,
        metaDescription: term.definition,
        readTimeMinutes: term.readTimeMinutes,
      },
      update: {
        title: term.term,
        excerpt: term.definition,
        contentHtml: term.contentHtml,
        type: 'GLOSSARY_TERM',
        isPublished: true,
        authorName: 'Команда SMMplan',
        metaTitle: `${term.term} — Что это такое? | Словарь SMM`,
        metaDescription: term.definition,
        readTimeMinutes: term.readTimeMinutes,
      },
    });
  }

  console.log('✅ [Seed Content] Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ [Seed Content] Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
