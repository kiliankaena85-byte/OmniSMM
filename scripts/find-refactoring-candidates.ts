import fs from 'fs';
import path from 'path';

function getFiles(dir: string, files: string[] = []): string[] {
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      if (item !== 'node_modules' && item !== '.next' && item !== '.git') getFiles(full, files);
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

const all = getFiles('src')
  .filter(f => !f.includes('proxy.ts') && !f.includes('__tests__') && !f.includes('.test.') && !f.includes('.d.ts'))
  .map(f => {
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n').length;
    const rel = f.replace(/\\/g, '/');
    let scope: 'SMMplan' | 'SMMflux' | 'OmniSMM Core / Admin' = 'OmniSMM Core / Admin';
    if (rel.toLowerCase().includes('flux') || rel.includes('ab-lovable')) {
      scope = 'SMMflux';
    } else if (rel.includes('landing') || rel.includes('PreLaunch') || rel.includes('plan-')) {
      scope = 'SMMplan';
    }
    return { path: rel, lines, scope };
  })
  .sort((a, b) => b.lines - a.lines);

console.log('=== SMMPLAN CANDIDATES (>200 lines) ===');
all.filter(f => f.scope === 'SMMplan' && f.lines > 200).slice(0, 10).forEach(f => console.log(`${f.lines} | ${f.path}`));

console.log('\n=== SMMFLUX CANDIDATES (>200 lines) ===');
all.filter(f => f.scope === 'SMMflux' && f.lines > 200).slice(0, 10).forEach(f => console.log(`${f.lines} | ${f.path}`));

console.log('\n=== OMNISMM CORE / ADMIN CANDIDATES (>350 lines) ===');
all.filter(f => f.scope === 'OmniSMM Core / Admin' && f.lines > 350).slice(0, 15).forEach(f => console.log(`${f.lines} | ${f.path}`));
