import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function probeModel(model: string): Promise<{ model: string; status: string; latencyMs: number; reply?: string }> {
  const t0 = Date.now();
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://smmplan.pro',
        'X-Title': 'OmniSMM Model Probe',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Say "ACTIVE" and state your primary capability in 5 words.' }]
      })
    });
    const latencyMs = Date.now() - t0;
    if (res.ok) {
      const data = await res.json();
      return { model, status: 'ONLINE', latencyMs, reply: data.choices?.[0]?.message?.content?.trim() };
    } else {
      const err = await res.text();
      return { model, status: `HTTP_${res.status}`, latencyMs, reply: err.slice(0, 80) };
    }
  } catch (e: any) {
    return { model, status: 'ERR', latencyMs: Date.now() - t0, reply: e.message };
  }
}

async function main() {
  const models = [
    'thinkingmachines/inkling-small:free',
    'thinkingmachines/inkling:free',
    'z-ai/glm-5.2:free',
    'minimax/minimax-m3:free',
    'cohere/north-mini-code:free',
    'poolside/laguna-s-2.1:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'nvidia/nemotron-3.5-lightning:free',
    'inclusionai/ling-3.0-flash-fin:free',
    'google/gemma-4-31b-it:free'
  ];

  console.log('Testing Swarm Candidates...');
  for (const m of models) {
    const res = await probeModel(m);
    console.log(`${res.status === 'ONLINE' ? '✅' : '❌'} [${res.latencyMs}ms] ${res.model} -> ${res.status}: ${res.reply}`);
  }
}

main();
