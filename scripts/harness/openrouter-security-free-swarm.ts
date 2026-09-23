/**
 * scripts/harness/openrouter-security-free-swarm.ts
 *
 * OpenRouter Free Model Swarm for Security Audit and Pentest Analysis.
 */

import * as dotenv from 'dotenv';
import path from 'path';
import { db } from '../../src/lib/db';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function queryOpenRouterFree(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    return 'No OpenRouter API key found.';
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://smmplan.pro',
        'X-Title': 'OmniSMM Security Swarm',
        'Content-Type': 'application/json'
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
      const err = await res.text();
      return `[${model} HTTP ${res.status}]: ${err.substring(0, 200)}`;
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content || 'Empty response';
  } catch (err: unknown) {
    return `[Network Error]: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function main() {
  console.log('========================================================================');
  console.log('🛡️  OPENROUTER FREE SWARM: SECURITY ARCHITECTURE & PENTEST');
  console.log('========================================================================\n');

  const models = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemini-2.0-flash-exp:free',
    'deepseek/deepseek-r1:free',
    'qwen/qwen-2.5-72b-instruct:free'
  ];

  const prompt = `
  Проанализируй задачу разделения тестового и боевого контуров веб-платформы OmniSMM 1.0 (Next.js 16 App Router, PostgreSQL, Redis, Cloudflare Tunnel):
  1. Как сделать так, чтобы для ВСЕХ обычных клиентов сайт работал СТРОГО в боевом режиме (Production, оплата реальная, накрутка реальная), а тестовый режим и пульт переключения были доступны ТОЛЬКО авторизованным тестировщикам и администраторам?
  2. Как максимально обезопасить админку (/admin/*), чтобы исключить случайное или намеренное проникновение посторонних?
  3. План защиты от пентеста (Red Team vs Blue Team).
  `;

  for (const model of models) {
    console.log(`📡 Запрос к модели: ${model}...`);
    const resp = await queryOpenRouterFree(model, 'Ты — ведущий эксперт по кибербезопасности и веб-архитектуре.', prompt);
    console.log(`\n--- ОТВЕТ [${model}] ---`);
    console.log(resp.substring(0, 800) + '...\n');
  }
}

main().catch(console.error);
