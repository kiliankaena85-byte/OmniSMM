import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { db } from '../../src/lib/db';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('\x1b[31m❌ Ошибка: OPENROUTER_API_KEY не найден в .env!\x1b[0m');
  process.exit(1);
}

async function callOpenRouter(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://smmplan.pro',
      'X-Title': 'SMMplan Swarm Catalog Auditor'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function runSwarmCatalogAudit() {
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log('  🛡️ OPENROUTER ADVERSARIAL SWARM: CATALOG & TAXONOMY DEEP AUDIT (ROUND TABLE)');
  console.log('════════════════════════════════════════════════════════════════════════════════\n');

  // 1. Fetch entire database catalog
  const networks = await db.network.findMany({
    where: { isActive: true },
    orderBy: { sort: 'asc' },
    include: {
      categories: {
        orderBy: { sort: 'asc' },
        include: {
          services: {
            where: { isActive: true, isQuarantined: false },
            orderBy: { rate: 'asc' }
          }
        }
      }
    }
  });

  const catalogDump = networks.map(n => ({
    network: n.name,
    slug: n.slug,
    categoriesCount: n.categories.length,
    categories: n.categories.map(c => ({
      categoryId: c.id,
      categoryName: c.name,
      categorySlug: c.slug,
      servicesCount: c.services.length,
      services: c.services.map(s => ({
        id: s.id,
        numericId: s.numericId,
        name: s.name,
        targetType: s.targetType,
        rate: s.rate,
        currency: s.providerCurrency,
        markup: s.markup,
        pricePer1kRub: Math.round(s.rate * s.markup * (s.providerCurrency === 'RUB' ? 1.0 : 90.0)),
        pricePerUnitRub: Number(((s.rate * s.markup * (s.providerCurrency === 'RUB' ? 1.0 : 90.0)) / 1000).toFixed(4)),
        minQty: s.minQty,
        maxQty: s.maxQty
      }))
    }))
  }));

  const catalogJson = JSON.stringify(catalogDump, null, 2);
  console.log(`Extracted database catalog: ${networks.length} networks, ${catalogDump.reduce((a, n) => a + n.categories.length, 0)} categories, ${catalogDump.reduce((a, n) => a + n.categories.reduce((b, c) => b + c.services.length, 0), 0)} services.\n`);

  // Round 1: Red Team Attack (Adversarial Critic)
  console.log('🔥 [ROUND 1] Red Team Adversarial Attack (GLM 5.2 Free)...');
  const redTeamSystem = `Ты — Red Team Adversarial Data Intelligence Auditor. Твоя задача — жестко и бескомпромиссно атаковать каталог услуг SMMplan/SMMflux и найти ЛЮБЫЕ несоответствия:
1. Пустые соцсети или категории (должно быть 0!).
2. Услуги, лежащие не в тех категориях (например, лайки в подписчиках, просмотры в комментариях, боты в бустах).
3. Несоответствие targetType: подписчики должны быть PROFILE/CHANNEL/GROUP, просмотры/лайки/реакции/комменты — POST, боты — BOT.
4. Ценовые аномалии: неадекватные розничные цены (слишком дешевые < 0.001 ₽ или безумно дорогие > 500 ₽ за 1 лайк/просмотр).
5. Логические ошибки в названиях и лимитах (minQty > maxQty).

Форматируй ответ строго в Markdown со структурированным списком конкретных дефектов с ID услуг.`;

  const redTeamAttack = await callOpenRouter(
    'z-ai/glm-5.2:free',
    redTeamSystem,
    `Проанализируй полный дамп каталога БД:\n\n${catalogJson}`
  );

  console.log('\n--- RED TEAM AUDIT REPORT ---');
  console.log(redTeamAttack.slice(0, 1500) + '...\n');

  // Round 2: Blue Team Defense & Triage
  console.log('🛡️ [ROUND 2] Blue Team Verification & Defense (Nemotron 3 Ultra 550B Free)...');
  const blueTeamSystem = `Ты — Blue Team Systems Architect. Твоя задача — проанализировать критику Red Team:
1. Проверить каждый пункт Red Team: является ли это реальным багом или штатным поведением.
2. Предложить конкретные исправления в базе данных (SQL/Prisma) для подтвержденных дефектов.
3. Отсеять ложные срабатывания (False Positives).`;

  const blueTeamDefense = await callOpenRouter(
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    blueTeamSystem,
    `Дамп каталога:\n${catalogJson}\n\nКритика Red Team:\n${redTeamAttack}`
  );

  console.log('\n--- BLUE TEAM AUDIT REPORT ---');
  console.log(blueTeamDefense.slice(0, 1500) + '...\n');

  // Round 3: CTO Arbiter Synthesis
  console.log('⚖️ [ROUND 3] CTO Arbiter Final Verdict & Decision Matrix (Inkling Small Free)...');
  const ctoSystem = `Ты — CTO Arbiter платформы OmniSMM 1.0. На основе дискуссии Red Team и Blue Team вынеси окончательный вердикт:
1. Общая оценка качества каталога (от 0 до 100).
2. Четкий список действий P0 (Блокирующие баги) и P1 (Рекомендуемые улучшения).
3. Точные директивы для базы данных.`;

  const ctoVerdict = await callOpenRouter(
    'thinkingmachines/inkling-small:free',
    ctoSystem,
    `Дамп каталога:\n${catalogJson}\n\nRed Team:\n${redTeamAttack}\n\nBlue Team:\n${blueTeamDefense}`
  );

  console.log('\n════════════════════════════════════════════════════════════════════════════════');
  console.log('  👑 CTO ARBITER FINAL VERDICT');
  console.log('════════════════════════════════════════════════════════════════════════════════\n');
  console.log(ctoVerdict);

  fs.writeFileSync('scripts/harness/catalog-swarm-verdict.md', `# SWARM CATALOG AUDIT VERDICT\n\n## Red Team\n${redTeamAttack}\n\n## Blue Team\n${blueTeamDefense}\n\n## CTO Verdict\n${ctoVerdict}`);
}

runSwarmCatalogAudit()
  .catch(console.error)
  .finally(() => db.$disconnect());
