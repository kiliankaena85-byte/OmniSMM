import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function queryModel(model: string, prompt: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://smmplan.pro',
      'X-Title': 'OmniSMM Optimization Audit',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Ты — ведущий эксперт по веб-производительности (Web Performance & UX Architect).' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${model} HTTP ${res.status}: ${err}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content || '';
}

async function main() {
  console.log('Testing models on OpenRouter...');

  const models = [
    'thudm/glm-4-9b-chat:free',
    'thudm/glm-4-9b-chat',
    'minimax/minimax-m3:free',
    'minimax/minimax-01',
    'qwen/qwen-2.5-72b-instruct:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'mistralai/mistral-small-24b-instruct-2501:free'
  ];

  for (const m of models) {
    try {
      console.log(`Checking ${m}...`);
      const resp = await queryModel(m, 'Ответь одной строкой: "OK, готов к аудиту UX и производительности OmniSMM 1.0"');
      console.log(`✅ ${m} responded:`, resp.slice(0, 100));
    } catch (e: any) {
      console.log(`❌ ${m}:`, e.message.slice(0, 120));
    }
  }
}

main();
