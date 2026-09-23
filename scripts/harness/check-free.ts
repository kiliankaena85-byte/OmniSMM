import * as dotenv from 'dotenv';
dotenv.config();

async function check() {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
    }
  });
  const data = await res.json();
  const freeModels = data.data.filter((m: any) => m.id.endsWith(':free') || m.pricing?.prompt === '0');
  console.log('Available Free Models:', freeModels.map((m: any) => m.id));
}
check();
