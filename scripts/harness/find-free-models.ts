import * as dotenv from 'dotenv';
dotenv.config();

const key = process.env.OPENROUTER_API_KEY;

async function findFree() {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    const json = await res.json();
    if (!json.data) {
      console.log('No data:', json);
      return;
    }
    const free = json.data.filter((m: any) => 
      (m.pricing?.prompt === 0 || m.pricing?.prompt === '0') &&
      (m.pricing?.completion === 0 || m.pricing?.completion === '0') ||
      m.id?.includes(':free')
    );
    console.log('Found free models count:', free.length);
    for (const m of free.slice(0, 20)) {
      console.log('-', m.id);
    }
  } catch (e: any) {
    console.error('Error fetching models:', e.message);
  }
}
findFree();
