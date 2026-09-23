import * as dotenv from 'dotenv';
dotenv.config();

const key = process.env.OPENROUTER_API_KEY;
console.log('Key length:', key?.length, 'Key prefix:', key?.slice(0, 12));

async function check() {
  const models = [
    'google/gemini-2.0-flash-001',
    'deepseek/deepseek-chat',
    'meta-llama/llama-3.3-70b-instruct',
    'qwen/qwen-2.5-72b-instruct',
    'mistralai/mistral-small-24b-instruct-2501',
    'anthropic/claude-3.5-haiku'
  ];

  for (const m of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'OmniSMM Check'
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: 'user', content: 'Say "OK: ' + m + ' is ready" in 6 words.' }]
        })
      });
      if (res.ok) {
        const json = await res.json();
        console.log('✅ Success with', m, '->', json.choices?.[0]?.message?.content?.trim());
      } else {
        const err = await res.text();
        console.log('❌ Failed', m, '->', err.slice(0, 120));
      }
    } catch (e: any) {
      console.log('❌ Error', m, e.message);
    }
  }
}
check();
