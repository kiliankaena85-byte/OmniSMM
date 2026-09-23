import * as fs from 'fs';

interface NormalizedService {
  providerName: string;
  originalName: string;
  normalizedName: string;
  platform: string;
  category: string;
}

function main() {
  const data: NormalizedService[] = JSON.parse(fs.readFileSync('scripts/all-providers-data.json', 'utf-8'));
  
  const platformCategories: Record<string, Record<string, string[]>> = {};
  
  for (const s of data) {
    if (!platformCategories[s.platform]) platformCategories[s.platform] = {};
    if (!platformCategories[s.platform][s.category]) platformCategories[s.platform][s.category] = [];
    platformCategories[s.platform][s.category].push(s.originalName);
  }

  const out: string[] = [];
  out.push('# SMM Category Distribution\n');
  
  for (const platform of ['TELEGRAM', 'VK', 'INSTAGRAM', 'YOUTUBE', 'TIKTOK', 'TWITCH', 'MAX']) {
    if (!platformCategories[platform]) continue;
    out.push(`## Platform: ${platform}`);
    for (const category in platformCategories[platform]) {
      const items = platformCategories[platform][category].sort();
      out.push(`### ${category}: ${items.length} items`);
      for (let i = 0; i < Math.min(10, items.length); i++) {
        out.push(`- ${items[i]}`);
      }
      if (items.length > 10) out.push('- ...');
      out.push('');
    }
  }

  fs.writeFileSync('scripts/category-distribution.md', out.join('\n'));
}

main();
