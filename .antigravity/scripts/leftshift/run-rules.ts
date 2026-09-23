import fs from 'fs';
import path from 'path';
import { runAllRulesOnContent, StaticFinding } from './rules/index';

function walkDir(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

export function runStaticRulesOnCodebase(targetDir?: string): { findings: StaticFinding[]; timestamp: string } {
  const dir = targetDir || path.resolve(process.cwd(), 'src');
  const files = walkDir(dir);
  const findings: StaticFinding[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const fileFindings = runAllRulesOnContent(content, file);
    findings.push(...fileFindings);
  }

  return {
    findings,
    timestamp: new Date().toISOString()
  };
}

if (require.main === module) {
  console.log('=== ALSH STATIC RULES RUNNER ===');
  const res = runStaticRulesOnCodebase();
  const outDir = path.resolve(process.cwd(), '.antigravity/reports');
  fs.mkdirSync(outDir, { recursive: true });

  const outFile = path.join(outDir, 'leftshift-baseline-findings.json');
  fs.writeFileSync(outFile, JSON.stringify(res, null, 2));

  console.log(`Scanned codebase. Total static findings: ${res.findings.length}`);
  console.log(`Report written to ${outFile}`);

  if (res.findings.some(f => f.severity === 'CRITICAL' || f.severity === 'HIGH')) {
    console.log('\nCRITICAL / HIGH findings present in codebase.');
  }
}
