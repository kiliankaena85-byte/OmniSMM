/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * OmniDesign MCP Hub — Model Context Protocol (MCP) Server.
 *
 * Единый сервер MCP дизайн-инженерии по стандарту JSON-RPC 2.0 через stdio:
 * - inspect_jsx_nodes: Нативная AST-инспекция тегов, классов и data-omni-path.
 * - tag_component_tree: Детерминированная инъекция иерархических путей.
 * - mutate_classes: Zero-Token мутация классов через tailwind-merge (0 токенов).
 * - validate_design_tokens: Проверка стандарта Obsidian Slate & Cobalt Matrix.
 * - generate_design_candidate: Сборка чистых React 19 / HeroUI v3 компонентов (<= 200 строк).
 */

import readline from 'readline';
import { JsonRpcRequest, JsonRpcResponse } from './omnidesign/types';
import { OMNIDESIGN_MCP_TOOLS, executeOmniDesignTool } from './omnidesign/tools';

export { OMNIDESIGN_MCP_TOOLS } from './omnidesign/tools';

export async function handleOmniDesignMcpRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
  const { id = null, method, params } = request;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'omnidesign-hub',
            version: '2.0.0',
            description: 'OmniDesign Hub: AST visual inspection, Zero-Token class mutation, design token audit, and candidate generation.',
          },
        },
      };

    case 'notifications/initialized':
      return { jsonrpc: '2.0', id, result: {} };

    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: OMNIDESIGN_MCP_TOOLS },
      };

    case 'tools/call': {
      if (!params || !params.name) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: 'Invalid params: tool name is required' },
        };
      }
      try {
        const toolName = params.name;
        const args = (params.arguments || {}) as Record<string, unknown>;
        const data = await executeOmniDesignTool(toolName, args);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
            data,
          },
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32603, message: errorMessage },
        };
      }
    }

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

export function createOmniDesignStdioServer(
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout
): readline.Interface {
  const rl = readline.createInterface({
    input,
    output,
    terminal: false,
  });

  rl.on('line', async (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const request = JSON.parse(trimmed) as JsonRpcRequest;
      const response = await handleOmniDesignMcpRequest(request);
      output.write(JSON.stringify(response) + '\n');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      output.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: `Parse error: ${errorMessage}` },
        }) + '\n'
      );
    }
  });

  return rl;
}

export async function startOmniDesignStdioServer(): Promise<void> {
  createOmniDesignStdioServer(process.stdin, process.stdout);
}

if (require.main === module) {
  startOmniDesignStdioServer();
}
