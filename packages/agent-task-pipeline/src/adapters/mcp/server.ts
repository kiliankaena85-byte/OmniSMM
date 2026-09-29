/**
 * server.ts
 * MCP Адаптер (Model Context Protocol Server - JSON-RPC 2.0).
 * 
 * Позволяет ЛЮБОМУ агенту (Claude, Cursor, Antigravity, VS Code) подключать
 * движок декомпозиции и арбитража задач как стандартные tools.
 * Реализован без тяжелых внешних зависимостей (Pure Node.js stdio JSON-RPC).
 */

import readline from 'readline';
import { WbsDecomposer } from '../../core/wbs-decomposer';
import { ActionArbiter } from '../../core/action-arbiter';
import { PentestSecurityAuditor } from '../../core/security-auditor';
import { BusinessRequest, ActionIntentProposal } from '../../core/types';

const decomposer = new WbsDecomposer();
const arbiter = new ActionArbiter();

const TOOLS = [
  {
    name: 'decompose_task',
    description: 'Декомпозирует крупную бизнес-задачу на атомарные шаги (не более 2 файлов на шаг) по правилу WBS.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Название задачи' },
        description: { type: 'string', description: 'Описание задачи' },
        candidateFiles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Список файлов, которые планируется затронуть'
        }
      },
      required: ['title']
    }
  },
  {
    name: 'decide_action',
    description: 'Детерминированная оценка рисков и принятие решения (PROCEED / REDIRECT_SAFE / ESCALATE) без расхода LLM токенов.',
    inputSchema: {
      type: 'object',
      properties: {
        actionId: { type: 'string' },
        intent: { type: 'string' },
        category: { 
          type: 'string', 
          enum: ['REFACTOR', 'BUGFIX', 'OPTIMIZATION', 'SCHEMA_MIGRATION', 'DEPENDENCY', 'DEPLOY', 'INFRASTRUCTURE'] 
        },
        options: { type: 'array' },
        context: { type: 'object' }
      },
      required: ['intent', 'category', 'options', 'context']
    }
  },
  {
    name: 'audit_security',
    description: 'Аудит кода на векторы пентест-атак (OWASP Top 10, Timing attacks, SSRF, IDOR, ExactMath) и генерация защитных требований.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Путь к файлу' },
        content: { type: 'string', description: 'Исходный код (опционально, если файл есть на диске)' }
      },
      required: ['filePath']
    }
  }
];

export function startMcpServer(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const msg = JSON.parse(trimmed);
      const id = msg.id;

      // Handle JSON-RPC methods
      if (msg.method === 'initialize') {
        sendResponse(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: '@omnismm/agent-task-pipeline',
            version: '1.0.0'
          }
        });
      } else if (msg.method === 'tools/list') {
        sendResponse(id, { tools: TOOLS });
      } else if (msg.method === 'tools/call') {
        const { name, arguments: toolArgs } = msg.params;

        if (name === 'decompose_task') {
          const req: BusinessRequest = {
            id: `REQ-${Date.now()}`,
            title: toolArgs.title,
            description: toolArgs.description || toolArgs.title,
            businessGoals: ['Выполнение требований']
          };
          const res = decomposer.decompose(req, toolArgs.candidateFiles || []);
          sendResponse(id, {
            content: [{ type: 'text', text: JSON.stringify(res, null, 2) }]
          });
        } else if (name === 'decide_action') {
          const proposal = toolArgs as ActionIntentProposal;
          const decision = arbiter.decide(proposal);
          sendResponse(id, {
            content: [{ type: 'text', text: JSON.stringify(decision, null, 2) }]
          });
        } else if (name === 'audit_security') {
          const fs = require('fs');
          const filePath = toolArgs.filePath;
          const fileContent = toolArgs.content || (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '');
          const report = PentestSecurityAuditor.generateAuditReport(filePath, fileContent);
          sendResponse(id, {
            content: [{ type: 'text', text: JSON.stringify(report, null, 2) }]
          });
        } else {
          sendError(id, -32601, `Tool not found: ${name}`);
        }
      } else {
        // Unknown or notification
        if (id !== undefined) {
          sendResponse(id, {});
        }
      }
    } catch (err) {
      sendError(null, -32700, `Parse error: ${err}`);
    }
  });
}

function sendResponse(id: unknown, result: unknown): void {
  const payload = JSON.stringify({ jsonrpc: '2.0', id, result });
  process.stdout.write(payload + '\n');
}

function sendError(id: unknown, code: number, message: string): void {
  const payload = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
  process.stdout.write(payload + '\n');
}

if (require.main === module) {
  startMcpServer();
}
