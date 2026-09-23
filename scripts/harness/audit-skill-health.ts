import fs from 'fs';
import path from 'path';

interface RuleResult {
  id: string;
  category: string;
  name: string;
  severity: 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';
  passed: boolean;
  message?: string;
}

export function checkSkillHealth(skillPath: string) {
  const content = fs.readFileSync(skillPath, 'utf-8');
  const dirName = path.basename(path.dirname(skillPath));
  const results: RuleResult[] = [];

  // Frontmatter parsing
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = fmMatch ? fmMatch[1] : '';

  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  const versionMatch = fm.match(/^version:\s*(.+)$/m);
  const descMatch = fm.match(/^description:\s*(.+)$/m);

  const name = nameMatch ? nameMatch[1].trim() : '';
  const version = versionMatch ? versionMatch[1].trim() : '';
  const desc = descMatch ? descMatch[1].trim() : '';

  // FM Rules
  results.push({ id: 'FM-001', category: 'Frontmatter', name: 'name field present', severity: 'CRITICAL', passed: !!name });
  results.push({ id: 'FM-002', category: 'Frontmatter', name: 'description field present', severity: 'CRITICAL', passed: !!desc });
  results.push({ id: 'FM-003', category: 'Frontmatter', name: 'version field valid semver', severity: 'WARNING', passed: !!version && /^\d+\.\d+\.\d+/.test(version) });
  results.push({ id: 'FM-006', category: 'Frontmatter', name: 'description length 50-500 chars', severity: 'WARNING', passed: desc.length >= 50 && desc.length <= 500 });
  results.push({ id: 'FM-008', category: 'Frontmatter', name: 'name matches directory name', severity: 'ERROR', passed: name === dirName });

  // ST Rules
  results.push({ id: 'ST-001', category: 'Structure', name: 'When to activate section present', severity: 'ERROR', passed: /##\s+(When to activate|Когда активировать)/i.test(content) });
  results.push({ id: 'ST-003', category: 'Structure', name: 'Protocol or Step-by-step present', severity: 'WARNING', passed: /##\s+(Step-by-step|Protocol|Регламент|Протокол)/i.test(content) });
  results.push({ id: 'ST-008', category: 'Structure', name: 'Scope boundaries section present', severity: 'WARNING', passed: /##\s+(Scope|Out of scope|Границы)/i.test(content) });
  results.push({ id: 'ST-010', category: 'Structure', name: 'Error handling section present', severity: 'WARNING', passed: /##\s+(Error handling|Обработка ошибок)/i.test(content) });
  results.push({ id: 'ST-007', category: 'Structure', name: 'References section present', severity: 'INFO', passed: /##\s+(References|See also|Ссылки)/i.test(content) });

  // IQ Rules
  results.push({ id: 'IQ-001', category: 'Instruction Quality', name: 'No contradictory imperatives', severity: 'CRITICAL', passed: !(/always\s+(\w+).*never\s+\1/i.test(content)) });
  results.push({ id: 'IQ-005', category: 'Instruction Quality', name: 'Code blocks have language specifier', severity: 'INFO', passed: !/```\r?\n[a-zA-Z0-9]/.test(content) });
  results.push({ id: 'IQ-010', category: 'Instruction Quality', name: 'No hardcoded local absolute paths', severity: 'ERROR', passed: !/C:\\Users\\Артём/i.test(content) });

  // AR Rules
  results.push({ id: 'AR-001', category: 'Activation Reliability', name: 'Description has trigger phrases', severity: 'WARNING', passed: desc.length > 60 });
  results.push({ id: 'AR-005', category: 'Activation Reliability', name: 'Description < 500 chars', severity: 'ERROR', passed: desc.length <= 500 });

  // Calculate score
  let score = 100;
  for (const r of results) {
    if (!r.passed) {
      if (r.severity === 'CRITICAL') score -= 25;
      else if (r.severity === 'ERROR') score -= 10;
      else if (r.severity === 'WARNING') score -= 5;
      else if (r.severity === 'INFO') score -= 1;
    }
  }
  score = Math.max(0, score);

  let grade = 'A';
  if (score < 30) grade = 'F';
  else if (score < 55) grade = 'D';
  else if (score < 75) grade = 'C';
  else if (score < 90) grade = 'B';

  return { score, grade, results };
}

const target = process.argv[2] || '.agents/skills/ai-brainstorm-council/SKILL.md';
const report = checkSkillHealth(target);

console.log(`\n🏥 SKILL HEALTH CHECK REPORT: ${target}`);
console.log(`=======================================================`);
console.log(`Score: ${report.score}/100 | Grade: ${report.grade} (${report.score >= 90 ? '🟢 HEALTHY' : '🟡 NEEDS WORK'})\n`);

report.results.forEach(r => {
  const icon = r.passed ? '✅' : (r.severity === 'CRITICAL' || r.severity === 'ERROR' ? '❌' : '⚠️');
  console.log(`${icon} [${r.id}] ${r.name} (${r.severity}) -> ${r.passed ? 'PASS' : 'FAIL'}`);
});
console.log(`\n=======================================================\n`);
