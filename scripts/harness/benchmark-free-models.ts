import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

interface ModelBenchmark {
  id: string;
  name: string;
  context_length: number;
  status: 'ONLINE' | 'RATE_LIMITED_OR_BUSY' | 'OFFLINE';
  latencyMs?: number;
  sampleResponse?: string;
  description?: string;
}

async function benchmarkAllFreeModels() {
  console.log('🔍 Fetching live model catalog from OpenRouter...\n');

  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`
    }
  });

  if (!res.ok) {
    console.error('Failed to fetch models:', await res.text());
    return;
  }

  const json = await res.json();
  const allModels: any[] = json.data || [];

  // Filter free models
  const freeModels = allModels.filter(m => 
    m.id.endsWith(':free') || 
    (m.pricing && m.pricing.prompt === '0' && m.pricing.completion === '0')
  );

  console.log(`📋 Found ${freeModels.length} candidate free models on OpenRouter. Testing each live...\n`);

  const results: ModelBenchmark[] = [];

  for (const m of freeModels) {
    process.stdout.write(`Testing [${m.id}] ... `);
    const startTime = Date.now();

    try {
      const chatRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'OmniSMM Swarm Benchmark',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: m.id,
          messages: [
            { role: 'system', content: 'You are an AI benchmark tester.' },
            { role: 'user', content: 'Respond with exactly: "ONLINE_OK"' }
          ],
          temperature: 0.1,
          max_tokens: 30
        })
      });

      const latencyMs = Date.now() - startTime;

      if (chatRes.ok) {
        const cJson = await chatRes.json();
        const text = cJson.choices?.[0]?.message?.content?.trim() || '';
        console.log(`\x1b[32m✔ ONLINE (${latencyMs}ms)\x1b[0m`);
        results.push({
          id: m.id,
          name: m.name || m.id,
          context_length: m.context_length || 0,
          status: 'ONLINE',
          latencyMs,
          sampleResponse: text,
          description: m.description
        });
      } else {
        const status = chatRes.status;
        const errText = await chatRes.text();
        if (status === 429) {
          console.log(`\x1b[33m⚠ RATE LIMITED / HIGH DEMAND (HTTP 429)\x1b[0m`);
          results.push({
            id: m.id,
            name: m.name || m.id,
            context_length: m.context_length || 0,
            status: 'RATE_LIMITED_OR_BUSY',
            description: m.description
          });
        } else {
          console.log(`\x1b[31m✖ ERROR HTTP ${status}\x1b[0m`);
          results.push({
            id: m.id,
            name: m.name || m.id,
            context_length: m.context_length || 0,
            status: 'OFFLINE',
            description: m.description
          });
        }
      }
    } catch (err: any) {
      console.log(`\x1b[31m✖ Network Error: ${err.message}\x1b[0m`);
    }

    // Small 200ms delay between tests to respect openrouter burst rate
    await new Promise(r => setTimeout(r, 200));
  }

  const onlineModels = results.filter(r => r.status === 'ONLINE');
  const busyModels = results.filter(r => r.status === 'RATE_LIMITED_OR_BUSY');

  console.log(`\n======================================================`);
  console.log(`🏆 BENCHMARK RESULTS: ${onlineModels.length} ONLINE, ${busyModels.length} BUSY`);
  console.log(`======================================================\n`);

  fs.writeFileSync(
    path.resolve(process.cwd(), 'scripts/harness/free-models-benchmark.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), onlineModels, busyModels, all: results }, null, 2),
    'utf8'
  );
}

benchmarkAllFreeModels().catch(console.error);
