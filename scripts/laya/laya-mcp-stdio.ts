/**
 * Laya Decision Engine — Stdio MCP Server
 * Standard Model Context Protocol JSON-RPC 2.0 Interface
 */

import readline from 'readline';
import { LocalLayaEngine } from './laya-client.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function sendResponse(id: string | number | null, result: unknown, error?: { code: number; message: string }) {
  const response = {
    jsonrpc: '2.0',
    id,
    ...(error ? { error } : { result })
  };
  process.stdout.write(JSON.stringify(response) + '\n');
}

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const message = JSON.parse(trimmed) as {
      jsonrpc?: string;
      id?: string | number;
      method?: string;
      params?: {
        name?: string;
        arguments?: Record<string, unknown>;
      };
    };

    const id = message.id ?? null;

    if (message.method === 'initialize') {
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'laya-decision-engine',
          version: '1.0.0'
        }
      });
      return;
    }

    if (message.method === 'tools/list') {
      sendResponse(id, {
        tools: [
          {
            name: 'laya_decide',
            description: 'Fast System 1 multi-task decision gate (15-35ms) evaluating density, WCAG, and touch safety',
            inputSchema: {
              type: 'object',
              properties: {
                candidateLayout: { type: 'string', description: 'TSX / HTML / CSS code of candidate UI layout' },
                context: { type: 'string', description: 'Optional context string (e.g. "viewport: mobile")' }
              },
              required: ['candidateLayout']
            }
          },
          {
            name: 'laya_classify',
            description: 'Classifies design DNA and detects AI-slop cliches (purple neon, bento emoji, pulse pill)',
            inputSchema: {
              type: 'object',
              properties: {
                candidateLayout: { type: 'string', description: 'Candidate UI code' }
              },
              required: ['candidateLayout']
            }
          },
          {
            name: 'laya_score',
            description: 'Returns calibrated continuous scores (0.0 - 1.0) for density, hierarchy, WCAG, and mobile touch',
            inputSchema: {
              type: 'object',
              properties: {
                candidateLayout: { type: 'string', description: 'Candidate UI code' }
              },
              required: ['candidateLayout']
            }
          },
          {
            name: 'laya_check',
            description: 'Fast ternary gate check (YES / NO) for specific gate: zeroSlopPass, wcagAaPass, mobileSafePass',
            inputSchema: {
              type: 'object',
              properties: {
                candidateLayout: { type: 'string', description: 'Candidate UI code' },
                gateName: { type: 'string', description: 'Name of the gate to test' }
              },
              required: ['candidateLayout', 'gateName']
            }
          }
        ]
      });
      return;
    }

    if (message.method === 'tools/call') {
      const toolName = message.params?.name;
      const args = message.params?.arguments || {};
      const layout = String(args.candidateLayout || '');
      const context = args.context ? String(args.context) : undefined;

      let result: unknown = null;

      if (toolName === 'laya_decide') {
        result = LocalLayaEngine.decide(layout, context);
      } else if (toolName === 'laya_classify') {
        result = LocalLayaEngine.classifyDna(layout);
      } else if (toolName === 'laya_score') {
        result = LocalLayaEngine.score(layout);
      } else if (toolName === 'laya_check') {
        const gate = String(args.gateName || 'readyForSynthesis');
        const decision = LocalLayaEngine.decide(layout, context);
        result = {
          gate,
          pass: decision.gates[gate as keyof typeof decision.gates] ?? false
        };
      } else {
        sendResponse(id, null, { code: -32601, message: `Tool '${toolName}' not found` });
        return;
      }

      sendResponse(id, {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      });
      return;
    }

    // Default response for unhandled notifications/methods
    if (id !== null) {
      sendResponse(id, {});
    }
  } catch (err) {
    sendResponse(null, null, { code: -32700, message: `Parse error: ${(err as Error).message}` });
  }
});
