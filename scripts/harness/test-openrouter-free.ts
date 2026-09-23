import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function testFreeModels() {
  const models = [
    'deepseek/deepseek-r1:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen-2.5-72b-instruct:free',
    'google/gemini-2.0-flash-exp:free',
    'mistralai/mistral-small-24b-instruct-2501:free'
  ];

  for (const m of models) {
    try {
      console.log(`Checking OpenRouter model: ${m}...`);
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'OmniSMM Test',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: 'user', content: 'Say "OK: OmniSMM Plan Approved" in 5 words.' }]
        })
      });

      if (res.ok) {
        const json = await res.json();
        console.log(`✅ Success with ${m}:`, json.choices?.[0]?.message?.content);
        return m;
      } else {
        const err = await res.text();
        console.log(`❌ Failed ${m}:`, err.slice(0, 100));
      }
    } catch (e: any) {
      console.log(`❌ Error ${m}:`, e.message);
    }
  }
}

testFreeModels();
