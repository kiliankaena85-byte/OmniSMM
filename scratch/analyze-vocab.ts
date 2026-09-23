import { redis } from './src/lib/redis';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const p = await prisma.provider.findFirst();
  if (!p) return;
  const cacheKey = `provider:${p.id}:shadow_catalog`;
  const cachedStr = await redis.get(cacheKey);
  if (!cachedStr) return;
  
  const services = JSON.parse(cachedStr);
  const wordFreq: Record<string, number> = {};
  
  services.forEach((s: any) => {
      const name = String(s.name || '').toLowerCase();
      // Simple regex to extract words and common tags like [RU], HQ, NO DROP
      const words = name.match(/([a-z]+|[A-Z]+|\[.*?\]|\d+k?)/g) || [];
      words.forEach(w => {
          if (w.length > 2 || w.startsWith('[')) {
              wordFreq[w] = (wordFreq[w] || 0) + 1;
          }
      });
  });

  const sorted = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 100);
  console.log("Top 100 terms in Provider Catalog:");
  sorted.forEach(([w, c]) => console.log(`${w}: ${c}`));
}

run().catch(console.error).finally(()=>prisma.$disconnect());
