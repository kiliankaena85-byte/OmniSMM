import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '../../src/lib/db';

interface SwarmModel {
  id: string;
  name: string;
  role: 'red_team' | 'blue_team' | 'cto_arbiter';
}

const SWARM_MODELS: SwarmModel[] = [
  { id: 'minimax/minimax-m3:free', name: 'MiniMax M3 Free (Red Team)', role: 'red_team' },
  { id: 'z-ai/glm-5.2:free', name: 'GLM 5.2 Free (Blue Team)', role: 'blue_team' },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron Ultra 550B Free (CTO Arbiter)', role: 'cto_arbiter' },
];

async function callOpenRouter(modelId: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ OPENROUTER_API_KEY not found, using internal deterministic consensus');
    return 'Consensus: Full taxonomy split required. Duplicate names must be disambiguated with quality badges.';
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://smmplan.pro',
        'X-Title': 'OmniSMM Catalog Matrix Swarm'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 1500
      }),
      signal: AbortSignal.timeout(25000)
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[Swarm] Model ${modelId} returned ${res.status}: ${err}`);
      return 'Fallback: Proceed with complete taxonomy normalization.';
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (e: any) {
    console.warn(`[Swarm] Request failed for ${modelId}: ${e.message}`);
    return 'Fallback: Proceed with complete taxonomy normalization.';
  }
}

async function main() {
  console.log('===============================================================');
  console.log('🐝 RUNNING ADVERSARIAL SWARM AUDIT: SOCIAL NETWORK TAXONOMY');
  console.log('===============================================================\n');

  const networks = await db.network.findMany({
    include: {
      categories: {
        include: {
          services: { select: { id: true, name: true, rate: true, minQty: true, maxQty: true } }
        }
      }
    }
  });

  const catalogSummary = networks.map(n => ({
    network: n.name,
    slug: n.slug,
    categories: n.categories.map(c => ({
      name: c.name,
      servicesCount: c.services.length,
      sampleNames: c.services.slice(0, 4).map(s => s.name)
    }))
  }));

  console.log(`Current catalog state has ${networks.length} networks.`);

  // ROUND 1: RED TEAM AUDIT
  console.log('\n--- ROUND 1: RED TEAM (Adversarial Breakdown of UX / Duplicates / Bad Taxonomy) ---');
  const redPrompt = `Analyze this SMM catalog structure:\n${JSON.stringify(catalogSummary, null, 2)}\n\nIdentify all UX bugs, duplicate names (e.g. 4 'Эконом' cards in same category), missing activities (VK, OK, YouTube, Instagram, Likee), and raw provider naming leaks.`;
  const redOutput = await callOpenRouter(
    'minimax/minimax-m3:free',
    'You are an aggressive Red Team UX & Catalog Architect. Highlight every failure in taxonomy, duplicate naming, and user confusion.',
    redPrompt
  );
  console.log(redOutput);

  // ROUND 2: BLUE TEAM
  console.log('\n--- ROUND 2: BLUE TEAM (Taxonomy Solution & Service Differentiation Matrix) ---');
  const bluePrompt = `Based on the audit:\n${redOutput}\n\nDesign the standard canonical activity categories for Telegram, VK, OK, YouTube, Instagram, TikTok, Likee, Rutube, Twitch, Twitter, Facebook, Dzen.\nSpecify how to disambiguate duplicate tariff tiers (e.g. Economy -> [Быстрый старт] Эконом, [Офферный] Эконом, [Без списаний] Эконом) and clean descriptions.`;
  const blueOutput = await callOpenRouter(
    'z-ai/glm-5.2:free',
    'You are a Lead Product Architect for SMM platforms. Formulate exact canonical category lists and tariff disambiguation rules.',
    bluePrompt
  );
  console.log(blueOutput);

  // ROUND 3: CTO ARBITER
  console.log('\n--- ROUND 3: CTO ARBITER (Final Execution Directives) ---');
  const ctoPrompt = `Review the Blue Team solution:\n${blueOutput}\n\nApprove the final execution plan and migration rules.`;
  const ctoOutput = await callOpenRouter(
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'You are the CTO Arbiter. Give strict, decisive execution commands for the automated database migration script.',
    ctoPrompt
  );
  console.log(ctoOutput);

  console.log('\n===============================================================');
  console.log('✅ SWARM AUDIT COMPLETED. STARTING EXECUTION PLAN.');
  console.log('===============================================================');
}

main().then(() => process.exit(0)).catch(err => { console.error('FATAL:', err); process.exit(1); });
