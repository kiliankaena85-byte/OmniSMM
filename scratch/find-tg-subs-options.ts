import * as fs from 'fs';

interface CuratedService {
  rank: number;
  platform: string;
  category: string;
  tier: string;
  providerName: string;
  extId: string;
  name: string;
  priceRUB_per1000: number;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  drip: boolean;
  qualityScore: number;
  reason: string;
}

const curated: CuratedService[] = JSON.parse(
  fs.readFileSync('scripts/curated-catalog.json', 'utf-8')
);

const tgSubs = curated.filter(s => 
  s.platform === 'TELEGRAM' && 
  s.category === '👨‍👩‍👧‍👦 Подписчики / Участники'
);

console.log(JSON.stringify(tgSubs, null, 2));
