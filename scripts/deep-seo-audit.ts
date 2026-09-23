import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runDeepSeoAudit() {
  console.log('================================================================');
  console.log('🔍 ГЛУБОКИЙ АУДИТ SEO & AEO (SMMplan 2026)');
  console.log('================================================================\n');

  const testUrls = [
    'http://localhost:3000/',
    'http://localhost:3000/services',
    'http://localhost:3000/services/vk',
    'http://localhost:3000/services/vk/vk-podpischiki-uchastniki',
    'http://localhost:3000/services/telegram',
    'http://localhost:3000/services/telegram/telegram-prosmotry-ohvat'
  ];

  const results: any[] = [];

  for (const url of testUrls) {
    try {
      const res = await fetch(url);
      const html = await res.text();

      const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : null;

      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
      const description = descMatch ? descMatch[1] : null;

      const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
      const canonical = canonicalMatch ? canonicalMatch[1] : null;

      const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
      const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];

      results.push({
        url,
        status: res.status,
        title: title || '❌ Отсутствует',
        titleLength: title ? title.length : 0,
        description: description || '❌ Отсутствует',
        descLength: description ? description.length : 0,
        canonical: canonical || '❌ Отсутствует',
        h1Count: h1Matches.length,
        h1Text: h1Matches.map(h => h.replace(/<[^>]*>/g, '').trim()),
        jsonLdCount: jsonLdMatches.length,
        hasFaqSchema: html.includes('"@type":"FAQPage"') || html.includes('"@type": "FAQPage"'),
        hasBreadcrumbSchema: html.includes('"@type":"BreadcrumbList"') || html.includes('"@type": "BreadcrumbList"'),
        hasServiceSchema: html.includes('"@type":"Service"') || html.includes('"@type": "Service"'),
        hasMetaWarning: html.includes('Meta Platforms Inc.'),
      });
    } catch (e: any) {
      results.push({ url, status: 'ERROR', error: e.message });
    }
  }

  console.log(JSON.stringify(results, null, 2));

  // Catalog Analysis
  const totalNetworks = await prisma.network.count();
  const totalCategories = await prisma.category.count();
  const totalServices = await prisma.service.count({ where: { isActive: true } });

  console.log('\n--- СТАТИСТИКА КАТАЛОГА ДЛЯ ИНДЕКСАЦИИ ---');
  console.log(`Сетей: ${totalNetworks}`);
  console.log(`Категорий: ${totalCategories}`);
  console.log(`Активных услуг: ${totalServices}`);
}

runDeepSeoAudit().catch(console.error).finally(() => prisma.$disconnect());
