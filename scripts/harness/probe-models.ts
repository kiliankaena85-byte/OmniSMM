import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function query(model: string) {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://smmplan.pro',
        'X-Title': 'OmniSMM Test',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Say "READY: ' + model + '" in 4 words.' }]
      })
    });
    if (res.ok) {
      const j = await res.json();
      console.log(`✅ ACTIVE: ${model} -> ${j.choices?.[0]?.message?.content}`);
      return true;
    } else {
      const err = await res.text();
      console.log(`❌ ${model} (${res.status}): ${err.slice(0, 80)}`);
      return false;
    }
  } catch (e: any) {
    console.log(`❌ ERROR ${model}: ${e.message}`);
    return false;
  }
}

async function testAll() {
  const list = [
    'minimax/minimax-m3:free',
    'zhipuai/glm-4-9b-chat',
    'zhipuai/glm-4',
    'thudm/chatglm3-6b',
    'deepseek/deepseek-r1-distill-llama-70b:free',
    'deepseek/deepseek-r1-distill-qwen-32b:free',
    'qwen/qwen-2.5-coder-32b-instruct:free',
    'meta-llama/llama-3.2-3b-instruct:free',
    'meta-llama/llama-3.1-8b-instruct:free',
    'google/gemini-2.0-flash-thinking-exp:free',
    'google/gemini-2.0-pro-exp-02-05:free'
  ];

  for (const m of list) {
    await query(m);
  }
}

testAll();
