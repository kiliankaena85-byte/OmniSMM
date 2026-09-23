import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function queryOpenRouter(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set in environment (.env or .env.local)');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://smmplan.pro',
        'X-Title': 'OmniSMM Catalog Slugs, Icons & Dynamic URL Architecture Review',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 3000
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter HTTP ${res.status}: ${err.slice(0, 200)}`);
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content || '';
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

async function runSwarmPlanAudit() {
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log('🛡️  OPENROUTER ADVERSARIAL SWARM: CATALOG SLUGS, ICONS & URL DYNAMICS');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  const systemPrompt = `You are a Principal Frontend & Distributed Web Architect, SEO Technical Strategist, and Cyber-Security Auditor.
Your task is to conduct an uncompromising ADVERSARIAL AUDIT and PRE-MORTEM on an architectural proposal for the OmniSMM enterprise platform (Next.js 16 App Router, React 19, Tailwind CSS 4, Prisma 5, PostgreSQL, multi-tenant).

The architecture tackles three interconnected challenges:
1. Category Slug Architecture: Editable SEO-friendly slugs in admin vs Prisma @unique collision risk, transliteration, auto-generation, and backward-compatible 301/canonical redirection.
2. Double-Icon Elimination & Single Source of Truth: Eradicating duplicate icons (emojis in category name strings like '👥 Подписчики' + SVG <UniversalIcon />) via robust Unicode emoji stripping (cleanCategoryName) and explicit <IconPicker /> selector in admin.
3. Live Order Wizard URL Synchronization: Synchronizing URL in the browser bar on category/network selection (/services/[network]/[category]) with window.history.pushState / shallow router without triggering SSR unmounts, layout thrashing, or re-render waterfalls.

Evaluate strictly against:
- Database Integrity & Uniqueness: How to safely handle Category.slug when two networks might share similar names (e.g. telegram-subscribers vs vk-subscribers).
- SEO & Routing Resilience: What happens if an admin changes an existing slug? Will indexed pages break into 404s, or is there a fallback/redirect mechanism?
- UX / Visual Double-Icon Hygiene: Will cleanCategoryName accurately strip complex multicharacter Unicode emojis (e.g. ZWJ, skin-tones, variation selectors) without corrupting Russian Cyrillic typography?
- URL Sync & Performance Invariants: Does history.pushState preserve deep links, browser Back/Forward navigation, and Next.js 16 App Router server component caching?

Output format:
- Overall Verdict: [APPROVED WITH GUARDS / REJECTED]
- Critical Vulnerability & Edge Case Audit (Points 1-4)
- Mandatory Architectural Guards (Concrete constraints for implementation)
- Final Score: (0-100)`;

  const userPrompt = `PROPOSED IMPLEMENTATION ARCHITECTURE:

### 1. Category Slug Management & Collision Defense:
- Add 'slug' to categorySchema in src/actions/admin/catalog/categories.ts (Zod min 2, max 100, regex: /^[a-z0-9-_]+$/).
- Automatic transliteration helper (cyrillicToSlug) converts Russian category name (e.g. "Подписчики" -> "telegram-subscribers" or "subscribers").
- Duplicate Collision Guard: Check Prisma before insert/update. If slug exists for another category, auto-append short deterministic suffix or prompt admin.
- Public Route Fallback (/services/[network]/[category]): In page.tsx, search category by slug OR by networkSlug-categorySlug OR numericId/cuid for backward compatibility, preventing 404s on existing links.

### 2. Double-Icon Elimination & Icon Engine:
- Problem: Category names in DB often contain raw emojis ("👥 Подписчики", "🔥 Бусты"). Combined with <UniversalIcon icon="lucide:users" />, UI renders double icons.
- Solution:
  1. Enhanced cleanCategoryName(rawName): Strict Unicode regex (/([\\u2700-\\u27BF]|...|[\\uD83C-\\uDBFF\\uDC00-\\uDFFF])/g) removes leading/trailing emojis and symbols cleanly, keeping pure typography ("Подписчики").
  2. <IconPicker /> integrated into CategoryModal: Allows admin to explicitly pick Lucide icon (lucide:users), Brand icon (brand:telegram), or custom SVG with 1-click smart suggestions.
  3. Single Source of Truth: UI renders strictly ONE icon on the left (cat.icon || default) + ONE clean text label on the right.

### 3. Live Order Wizard URL Synchronization:
- In MobileStep2Category / FluxOrderClient / CategorySidebar:
  When a user selects a network and category, call history.pushState(null, '', \`/services/\${network.slug}/\${category.slug}\`) without triggering a full page reload or SSR re-render.
- On browser PopState (Back/Forward buttons), sync the active network/category in the React state.
- Direct visits to /services/[network]/[category] pre-populate the wizard with the matching network/category for instant checkout and 100% SEO indexing.

Please audit this architecture, identify potential failure modes, and provide concrete recommendations.`;

  const models = [
    'z-ai/glm-5.2:free',
    'minimax/minimax-m3:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free'
  ];

  let auditOutputs: { model: string; content: string }[] = [];

  for (const model of models) {
    console.log(`📡 Querying Auditor Model: [${model}]...`);
    try {
      const response = await queryOpenRouter(model, systemPrompt, userPrompt);
      console.log(`\n────────────────────────────────────────────────────────────────────────`);
      console.log(`📝 AUDIT REPORT FROM: [${model}]`);
      console.log(`────────────────────────────────────────────────────────────────────────\n`);
      console.log(response);
      console.log(`\n════════════════════════════════════════════════════════════════════════\n`);
      auditOutputs.push({ model, content: response });
    } catch (err: any) {
      console.error(`❌ Model [${model}] failed or rate-limited:`, err.message);
    }
  }

  if (auditOutputs.length === 0) {
    console.log('⚠️ Free models busy, trying fallback model openrouter/free...');
    try {
      const response = await queryOpenRouter('openrouter/free', systemPrompt, userPrompt);
      console.log(`\n────────────────────────────────────────────────────────────────────────`);
      console.log(`📝 AUDIT REPORT FROM: [openrouter/free]`);
      console.log(`────────────────────────────────────────────────────────────────────────\n`);
      console.log(response);
      auditOutputs.push({ model: 'openrouter/free', content: response });
    } catch (err: any) {
      console.error('❌ Fallback model failed:', err.message);
    }
  }
}

runSwarmPlanAudit().catch(console.error);
