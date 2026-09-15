const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '../project-docs/academy-engine');
const biblePath = path.join(dir, 'MASTER_BIBLE.md');
const bible = fs.existsSync(biblePath) ? fs.readFileSync(biblePath, 'utf8') : '';

const modules = [
  'mod01_orders.md',
  'mod02_refills_goodwill.md',
  'mod03_finance_54fz.md',
  'mod04_security_152fz.md',
  'mod05_legal_defense.md',
  'mod06_api_resellers.md',
  'mod07_platform_traps.md',
  'mod08_antifraud_escalation.md',
  'mod09_loyalty_paradox.md',
  'mod10_human_first_ai_safety.md',
  'mod11_serm_reputation.md',
  'mod12_qa_certification_kpi.md'
];

let masterDoc = '# 🏛️ ПОЛНОЕ РУКОВОДСТВО И АКАДЕМИЯ ОПЕРАЦИОННОЙ БЕЗОПАСНОСТИ SMMPLAN (v2026)\n';
masterDoc += '*Единый корпоративный стандарт клиентского сервиса, юридической защиты и финансового комплаенса*\n\n';
masterDoc += '---\n\n';
masterDoc += bible + '\n\n---\n\n';
masterDoc += '# 📚 УЧЕБНЫЕ МОДУЛИ АКАДЕМИИ\n\n';

for (const m of modules) {
  const filePath = path.join(dir, 'modules', m);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    masterDoc += content + '\n\n---\n\n';
  }
}

const outPath = path.resolve(__dirname, '../project-docs/SUPPORT_ACADEMY_MASTER_2026.md');
fs.writeFileSync(outPath, masterDoc, 'utf8');
console.log('MASTER_DOCUMENT_ASSEMBLED:', outPath);
