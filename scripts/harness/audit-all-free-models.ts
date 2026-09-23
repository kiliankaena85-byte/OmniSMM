import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

interface ModelInfo {
  id: string;
  name: string;
  context_length: number;
  description: string;
  architecture?: any;
}

async function testSingleModel(m: ModelInfo) {
  const t0 = Date.now();
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://smmplan.pro',
        'X-Title': 'OmniSMM Free Swarm Audit',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: m.id,
        messages: [{ role: 'user', content: 'Say "READY: <YOUR_SPECIALTY>" in 5 words.' }],
        temperature: 0.1
      })
    });
    const latency = Date.now() - t0;
    if (res.ok) {
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim() || '';
      return { id: m.id, name: m.name, ctx: m.context_length, status: 'ONLINE', latency, reply, desc: m.description };
    } else {
      const err = await res.text();
      return { id: m.id, name: m.name, ctx: m.context_length, status: `HTTP_${res.status}`, latency, reply: err.slice(0, 100), desc: m.description };
    }
  } catch (e: any) {
    return { id: m.id, name: m.name, ctx: m.context_length, status: 'ERROR', latency: Date.now() - t0, reply: e.message, desc: m.description };
  }
}

async function main() {
  const raw = fs.readFileSync(path.resolve(process.cwd(), 'scripts/harness/openrouter-free-models-list.json'), 'utf-8');
  const models: ModelInfo[] = JSON.parse(raw);

  console.log(`Auditing ${models.length} free models on OpenRouter...`);
  const results = [];

  for (const m of models) {
    const r = await testSingleModel(m);
    console.log(`[${r.status}] ${r.id} (${r.latency}ms) -> ${r.reply.slice(0, 80)}`);
    results.push(r);
  }

  const outPath = path.resolve(process.cwd(), 'scripts/harness/openrouter-free-models-audit-results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nResults written to ${outPath}`);
}

main();
