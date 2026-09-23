import fs from 'fs';

const data = JSON.parse(fs.readFileSync('smmtoolbox_enriched.json', 'utf8'));

const platforms = new Set();
const categories = new Set();
let count = 0;

for (const item of data) {
    if (item.platform) platforms.add(item.platform);
    if (item.category) categories.add(item.category);
    count++;
}

console.log(`Total services: ${count}`);
console.log(`Platforms (${platforms.size}):`, Array.from(platforms));
console.log(`Categories (${categories.size}):`);
const catArr = Array.from(categories) as string[];
catArr.sort();
catArr.forEach(c => console.log(`  - ${c}`));

// Count per platform
const countsPerPlatform: Record<string, number> = {};
for (const item of data) {
    if (!countsPerPlatform[item.platform]) countsPerPlatform[item.platform] = 0;
    countsPerPlatform[item.platform]++;
}
console.log("\nCounts per platform:");
console.log(countsPerPlatform);
