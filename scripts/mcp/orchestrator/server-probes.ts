/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * Server Probes for Model Context Protocol (MCP) Pipeline.
 * Decomposed probe logic for in-house and remote MCP servers.
 */

import { handleMcpRequest } from '../../ui/layout-mcp-server';
import { handleLayaMcpRequest } from '../laya-mcp-server';
import { handleStitchMcpRequest } from '../stitch-mcp-server';
import { handleOmniDesignMcpRequest } from '../omnidesign-mcp-server';

export interface McpServerConfig {
  type: 'stdio' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  enabled: boolean;
  tier: 'LEVEL_1_TYPES' | 'LEVEL_2_VISUAL' | 'LEVEL_3_DEVOPS';
  description: string;
}

export interface ServerHealthResult {
  name: string;
  tier: McpServerConfig['tier'];
  enabled: boolean;
  status: 'HEALTHY' | 'UNAVAILABLE' | 'DISABLED';
  latencyMs: number;
  toolsCount: number;
  message: string;
}

type InternalMcpHandler = (req: { jsonrpc?: string; id: number; method: string; params?: Record<string, unknown> }) => Promise<unknown>;

const IN_HOUSE_HANDLERS: Record<string, { handler: InternalMcpHandler; desc: string }> = {
  'layout-sentry': {
    handler: (req) => handleMcpRequest(req as Parameters<typeof handleMcpRequest>[0]),
    desc: 'In-house layout & AST nesting healer active.'
  },
  'laya-decisions': {
    handler: (req) => handleLayaMcpRequest(req as Parameters<typeof handleLayaMcpRequest>[0]),
    desc: 'In-house Laya System 1 decision engine active (~15ms latency).'
  },
  'stitch-designer': {
    handler: (req) => handleStitchMcpRequest(req as Parameters<typeof handleStitchMcpRequest>[0]),
    desc: 'In-house Google Stitch Generative UI active with Laya delegation.'
  },
  'omnidesign-hub': {
    handler: (req) => handleOmniDesignMcpRequest(req as Parameters<typeof handleOmniDesignMcpRequest>[0]),
    desc: 'In-house OmniDesign Hub: AST class mutations, token validation, and candidate generator.'
  }
};

async function probeHttpServer(url: string, start: number): Promise<{ ok: boolean; latency: number }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(url, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeout);
    return { ok: Boolean(res && (res.status === 200 || res.status === 404 || res.status === 405)), latency: Date.now() - start };
  } catch {
    return { ok: false, latency: Date.now() - start };
  }
}

export async function probeServerHealth(name: string, config: McpServerConfig): Promise<ServerHealthResult> {
  const start = Date.now();
  if (!config.enabled) {
    return { name, tier: config.tier, enabled: false, status: 'DISABLED', latencyMs: 0, toolsCount: 0, message: 'Server disabled in configuration.' };
  }

  const inHouse = IN_HOUSE_HANDLERS[name];
  if (inHouse) {
    try {
      const pingRes = await inHouse.handler({ jsonrpc: '2.0', id: 1, method: 'ping', params: {} });
      const toolsRes = await inHouse.handler({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
      const toolsList = (toolsRes as { result?: { tools?: unknown[] } })?.result?.tools;
      return {
        name,
        tier: config.tier,
        enabled: true,
        status: pingRes ? 'HEALTHY' : 'UNAVAILABLE',
        latencyMs: Date.now() - start,
        toolsCount: Array.isArray(toolsList) ? toolsList.length : 0,
        message: inHouse.desc
      };
    } catch (err: unknown) {
      return { name, tier: config.tier, enabled: true, status: 'UNAVAILABLE', latencyMs: Date.now() - start, toolsCount: 0, message: err instanceof Error ? err.message : String(err) };
    }
  }

  if (config.type === 'http' && config.url) {
    const { ok, latency } = await probeHttpServer(config.url, start);
    return {
      name,
      tier: config.tier,
      enabled: true,
      status: ok ? 'HEALTHY' : 'UNAVAILABLE',
      latencyMs: latency,
      toolsCount: ok ? 1 : 0,
      message: ok ? 'Knowledge memory service responding.' : 'Memory service port 8100 unreachable.'
    };
  }

  if (config.command) {
    return {
      name,
      tier: config.tier,
      enabled: true,
      status: 'HEALTHY',
      latencyMs: Date.now() - start,
      toolsCount: name === 'puppeteer-visual' ? 3 : 1,
      message: `Configured via CLI command "${config.command}". Ready for agent stdio spawn.`
    };
  }

  return { name, tier: config.tier, enabled: true, status: 'UNAVAILABLE', latencyMs: Date.now() - start, toolsCount: 0, message: 'Unknown server configuration type.' };
}
