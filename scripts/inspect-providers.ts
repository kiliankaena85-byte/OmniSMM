import * as fs from 'fs';

const curated = JSON.parse(fs.readFileSync('scripts/curated-catalog.json', 'utf-8'));
const providerNames = new Set(curated.map((s: any) => s.providerName));
console.log('Unique Provider Names in curated-catalog.json:', Array.from(providerNames));
