import * as dotenv from 'dotenv';
dotenv.config();

const key = process.env.OPENROUTER_API_KEY;

async function checkFreeModels() {
  const models = [
    'z-ai/glm-5.2:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'thinkingmachines/inkling-small:free',
    'google/gemma-4-31b-it:free',
    'minimax/minimax-m3:free'
  ];

  for (const m of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'OmniSMM Pricing Verification'
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: 'user', content: 'Reply with "VERIFIED_ONLINE: ' + m + '"' }]
        })
      });
      if (res.ok) {
        const json = await res.json();
        console.log('✅ Success with', m, '->', json.choices?.[0]?.message?.content?.slice(0, 100));
      } else {
        const err = await res.text();
        console.log('❌ Failed', m, '->', err.slice(0, 120));
      }
    } catch (e: any) {
      console.log('❌ Error', m, e.message);
    }
  }
}
checkFreeModels();
