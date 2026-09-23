import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

interface ExpertResult {
  role: string;
  model: string;
  focus: string;
  analysis: string;
}

const EXPERTS = [
  {
    role: 'Principal CRO & Funnel Architect (Global SMM & SaaS Benchmarks)',
    model: 'google/gemma-4-31b-it:free',
    fallbackModels: ['nvidia/nemotron-3.5-lightning:free', 'z-ai/glm-5.2:free', 'mistralai/mistral-small-24b-instruct-2501:free'],
    systemPrompt: `You are the Principal Conversion Rate Optimization (CRO) and Funnel Architect for a high-volume SMM service platform.
The Founder observed a critical flaw:
'UX is terrible for conversion. The stages are illogical. If a user picks a service and pastes an invalid link, they go through all 4 steps to checkout, and ONLY THEN at checkout are they told the link does not match the service! The client wasted time and effort. We must save client time and make mobile ordering on the home page maximally intuitive, logical, and user-friendly.'

Analyze this issue and provide concrete solutions in Russian:
1. Fatal Funnel Flaws: Why 'Deferred Validation' (error on step 4 instead of step 1) destroys mobile conversion by 60-80%.
2. The 'Reverse vs Adaptive' Funnel: What is the optimal sequence of steps?
   Option A: Smart Link First (Paste link -> AI instantly determines Telegram/VK/Insta + Type Post/Channel -> Auto-filters only 100% compatible services).
   Option B: Goal / Service First (Pick platform -> Pick Goal -> Insert link with instant live inline validation).
3. The 'Zero-Dead-End' rule: How to guarantee the user NEVER sees an error screen or blocked payment modal?`,
    userPrompt: `Develop the high-converting mobile ordering funnel architecture in Russian with specific UX/UI recommendations.`
  },
  {
    role: 'Lead Mobile UX/UI Product Designer (iOS HIG & Material 3 / Touch-First)',
    model: 'nvidia/nemotron-3.5-lightning:free',
    fallbackModels: ['google/gemma-4-31b-it:free', 'z-ai/glm-5.2:free'],
    systemPrompt: `You are the Lead Mobile UX/UI Designer specializing in friction-free e-commerce and 1-Thumb mobile ergonomics.
The user is on a smartphone (iPhone/Android, 375-430px width). They want to promote their channel or post in 30 seconds.
Current issues:
- Link gets clipped in fields.
- User reaches Step 4 before knowing their link was incompatible.
- Clunky multi-step wizard creates cognitive fatigue.

Provide specific UX/UI design specifications in Russian:
1. Above-The-Fold 1-Screen Magic: How to make the entire order flow visible in 1-2 thumb scrolls without multi-page friction.
2. Smart Auto-Detection UI: When a link is pasted into the top input, how should the UI visually transform in real time? (Show social icon, auto-badge 'Канал' or 'Пост', highlight recommended tariffs).
3. Fallback for users WITHOUT a link copied: How to provide 1-tap quick buttons for users who want to browse before pasting a link.
4. Input ergonomics: Full URL display without truncating, 1-tap paste button from clipboard, clean steppers.`,
    userPrompt: `Provide a detailed UI/UX specification and wireframe breakdown for the mobile home page ordering card in Russian.`
  },
  {
    role: 'Behavioral Economist & Customer Psychology Specialist',
    model: 'z-ai/glm-5.2:free',
    fallbackModels: ['nvidia/nemotron-3.5-lightning:free', 'google/gemma-4-31b-it:free'],
    systemPrompt: `You are a Behavioral Economist and Consumer Psychology Specialist (Kahneman, Cialdini, Schwartz 'Paradox of Choice').
Context: Users ordering SMM services on mobile.
Problem: When users face 50 confusing tariffs with technical jargon, then get hit with a late validation error at checkout, they experience intense regret and abandon the cart permanently.

Analyze in Russian:
1. Paradox of Choice & Cognitive Load: Why showing dozens of raw tariffs on mobile kills conversion. How to apply the 'Rule of 3' (Эконом / Оптимальный (Хит) / Премиум).
2. Sunk Cost & Frustration: The psychology of being rejected at Step 4. How proactive guidance creates trust ('Мы проверили вашу ссылку: это Telegram-канал, вот 3 лучших тарифа для роста').
3. Micro-commitments & Social Proof: How to make the user feel safe from the very first tap.`,
    userPrompt: `Formulate psychological triggers, tariff simplification, and instant reassurance patterns for mobile ordering in Russian.`
  }
];

async function callModelWithFallback(exp: typeof EXPERTS[0]): Promise<string> {
  const modelCandidates = [exp.model, ...exp.fallbackModels];
  for (const m of modelCandidates) {
    try {
      console.log(`Querying expert [${exp.role}] via model: ${m}...`);
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'OmniSMM Mobile UX Swarm',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: 'system', content: exp.systemPrompt },
            { role: 'user', content: exp.userPrompt }
          ],
          temperature: 0.3
        })
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content && content.trim().length > 100) {
          console.log(`✅ Expert [${exp.role}] responded successfully (${content.length} chars)!`);
          return content;
        }
      } else {
        const err = await res.text();
        console.warn(`⚠️ Model ${m} failed: ${err.slice(0, 100)}`);
      }
    } catch (e: any) {
      console.warn(`⚠️ Network error with ${m}: ${e.message}`);
    }
  }
  return 'Failed to obtain analysis from all candidate models.';
}

async function runSwarm() {
  console.log('🚀 Starting OpenRouter Mobile UX Brainstorm Swarm...');
  const results: ExpertResult[] = [];

  for (const exp of EXPERTS) {
    const analysis = await callModelWithFallback(exp);
    results.push({
      role: exp.role,
      model: exp.model,
      focus: exp.systemPrompt,
      analysis
    });
  }

  const outPath = path.resolve(process.cwd(), 'scripts/harness/openrouter-mobile-ux-report.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`🎉 Swarm complete! Report saved to ${outPath}`);
}

runSwarm();
