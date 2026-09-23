import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function fetchFreeList() {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': 'Bearer ' + process.env.OPENROUTER_API_KEY }
    });
    const json = await res.json();
    const all = json.data || [];
    const free = all.filter((m: any) => m.id.endsWith(':free') || m.pricing?.prompt === '0');
    
    const filePath = path.resolve(process.cwd(), 'scripts/harness/openrouter-free-models-list.json');
    fs.writeFileSync(filePath, JSON.stringify(free, null, 2), 'utf-8');
    console.log(`Saved ${free.length} free models to ${filePath}`);

    // Print summary table
    for (const m of free) {
      console.log(`- ${m.id} | ${m.name} | ctx: ${m.context_length}`);
    }
  } catch (err: any) {
    console.error('Fetch error:', err.message);
  }
}

fetchFreeList();
