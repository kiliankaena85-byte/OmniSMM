import * as dotenv from 'dotenv';
dotenv.config();

const key = process.env.OPENROUTER_API_KEY;

async function checkMore() {
  const models = [
    'nvidia/nemotron-3.5-lightning:free',
    'inclusionai/ling-3.0-flash-fin:free',
    'minimax/minimax-m2.7:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'
  ];

  for (const m of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'OmniSMM Verification'
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: 'user', content: 'Say "OK: ' + m + '"' }]
        })
      });
      if (res.ok) {
        const json = await res.json();
        console.log('✅ Success with', m, '->', json.choices?.[0]?.message?.content?.slice(0, 80));
      } else {
        const err = await res.text();
        console.log('❌ Failed', m, '->', err.slice(0, 100));
      }
    } catch (e: any) {
      console.log('❌ Error', m, e.message);
    }
  }
}
checkMore();
