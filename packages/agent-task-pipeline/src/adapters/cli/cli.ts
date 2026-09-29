#!/usr/bin/env node
/**
 * cli.ts
 * Консольный адаптер для вызова пайплайна из любого шелла / терминала / CI/CD.
 */

import fs from 'fs';
import { WbsDecomposer } from '../../core/wbs-decomposer';
import { ActionArbiter } from '../../core/action-arbiter';
import { PentestSecurityAuditor } from '../../core/security-auditor';
import { BusinessRequest, ActionIntentProposal } from '../../core/types';

function runCli(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'decompose') {
    const inputIdx = args.indexOf('--input');
    const filesIdx = args.indexOf('--files');

    let request: BusinessRequest;
    if (inputIdx !== -1 && args[inputIdx + 1]) {
      const raw = args[inputIdx + 1];
      request = fs.existsSync(raw) ? JSON.parse(fs.readFileSync(raw, 'utf-8')) : JSON.parse(raw);
    } else {
      request = {
        id: `REQ-${Date.now()}`,
        title: args[1] || 'Новая задача',
        description: args[1] || 'Автоматическая декомпозиция',
        businessGoals: ['Реализация функционала'],
      };
    }

    const files = filesIdx !== -1 && args[filesIdx + 1] ? args[filesIdx + 1].split(',') : [];
    const decomposer = new WbsDecomposer();
    const result = decomposer.decompose(request, files);

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  if (command === 'decide') {
    const proposalIdx = args.indexOf('--proposal');
    if (proposalIdx === -1 || !args[proposalIdx + 1]) {
      console.error('Ошибка: укажите --proposal <json-or-file>');
      process.exit(1);
    }

    const raw = args[proposalIdx + 1];
    const proposal: ActionIntentProposal = fs.existsSync(raw)
      ? JSON.parse(fs.readFileSync(raw, 'utf-8'))
      : JSON.parse(raw);

    const arbiter = new ActionArbiter();
    const decision = arbiter.decide(proposal);

    console.log(JSON.stringify(decision, null, 2));
    process.exit(decision.verdict === 'REJECT' ? 1 : 0);
  }

  if (command === 'audit-security') {
    const file = args[1] || (args.indexOf('--file') !== -1 ? args[args.indexOf('--file') + 1] : null);
    if (!file || !fs.existsSync(file)) {
      console.error('Ошибка: укажите существующий файл: task-pipeline audit-security <file.ts>');
      process.exit(1);
    }
    const content = fs.readFileSync(file, 'utf-8');
    const report = PentestSecurityAuditor.generateAuditReport(file, content);

    console.log(JSON.stringify(report, null, 2));
    process.exit(report.isImmune ? 0 : 1);
  }

  console.log(`
Использование:
  task-pipeline decompose --input <path.json> [--files "file1.ts,file2.ts"]
  task-pipeline decide --proposal <path.json>
  task-pipeline audit-security <file.ts>
`);
}

runCli();
