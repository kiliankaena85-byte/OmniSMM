import fs from 'fs';
import path from 'path';

function getDirSize(dirPath: string, maxDepth = 4, currentDepth = 0): number {
  if (currentDepth > maxDepth) return 0;
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          total += getDirSize(fullPath, maxDepth, currentDepth + 1);
        } else if (entry.isFile()) {
          total += fs.statSync(fullPath).size;
        }
      } catch {}
    }
  } catch {}
  return total;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function scanSubdirs(parentDir: string, minSizeMB = 100): { name: string; path: string; size: number; formatted: string }[] {
  const results: { name: string; path: string; size: number; formatted: string }[] = [];
  if (!fs.existsSync(parentDir)) return results;
  try {
    const items = fs.readdirSync(parentDir, { withFileTypes: true });
    for (const item of items) {
      if (!item.isDirectory()) continue;
      const fullPath = path.join(parentDir, item.name);
      const size = getDirSize(fullPath);
      if (size >= minSizeMB * 1024 * 1024) {
        results.push({
          name: item.name,
          path: fullPath,
          size,
          formatted: formatBytes(size),
        });
      }
    }
  } catch {}
  return results.sort((a, b) => b.size - a.size);
}

const userProfile = process.env.USERPROFILE || 'C:\\Users\\Артём';

console.log('========================================');
console.log(' 1. DRIVE C: AUDIT OF APPDATA & CACHES  ');
console.log('========================================');

console.log('\n--- C:\\Users\\...\\.gemini Subfolders ---');
const geminiSubs = scanSubdirs(path.join(userProfile, '.gemini'), 50);
geminiSubs.forEach(s => console.log(`  ${s.name.padEnd(30)} : ${s.formatted}`));

const brainPath = path.join(userProfile, '.gemini', 'antigravity', 'brain');
if (fs.existsSync(brainPath)) {
  const brainConvs = fs.readdirSync(brainPath);
  console.log(`  [Total Antigravity Brain Sessions: ${brainConvs.length}]`);
}

console.log('\n--- C:\\Users\\...\\AppData\\Local (Top Folders > 200 MB) ---');
const localSubs = scanSubdirs(path.join(userProfile, 'AppData', 'Local'), 200);
localSubs.slice(0, 15).forEach(s => console.log(`  ${s.name.padEnd(30)} : ${s.formatted}`));

console.log('\n--- C:\\Users\\...\\AppData\\Roaming (Top Folders > 200 MB) ---');
const roamingSubs = scanSubdirs(path.join(userProfile, 'AppData', 'Roaming'), 200);
roamingSubs.slice(0, 10).forEach(s => console.log(`  ${s.name.padEnd(30)} : ${s.formatted}`));

console.log('\n--- Windows System Caches ---');
const winUpdates = getDirSize('C:\\Windows\\SoftwareDistribution\\Download');
console.log(`  Windows Update Download Cache : ${formatBytes(winUpdates)}`);

console.log('\n========================================');
console.log(' 2. DRIVE D: AUDIT OF TOP DIRECTORIES   ');
console.log('========================================');

const dSubs = scanSubdirs('D:\\', 200);
dSubs.forEach(s => console.log(`  ${s.name.padEnd(35)} : ${s.formatted}`));

console.log('\n--- D:\\ Large Standalone Files (> 100 MB) ---');
try {
  const rootFiles = fs.readdirSync('D:\\', { withFileTypes: true });
  for (const f of rootFiles) {
    if (f.isFile()) {
      const st = fs.statSync(path.join('D:\\', f.name));
      if (st.size > 100 * 1024 * 1024) {
        console.log(`  ${f.name.padEnd(45)} : ${formatBytes(st.size)}`);
      }
    }
  }
} catch {}
