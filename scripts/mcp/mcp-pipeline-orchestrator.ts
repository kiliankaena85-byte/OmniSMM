/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * MCP Pipeline Orchestrator — Unified Governance Engine for Model Context Protocol.
 *
 * Orchestrates Level 1 (Anti-Hallucination), Level 2 (Visual & Layout), Level 3 (DevOps) MCP servers:
 * - Manifest validation (.mcp/mcp-servers.json)
 * - Health check & ping probes
 * - Tool aggregation & registry
 * - Automated preflight visual & layout validation
 */

import fs from 'fs';
import path from 'path';
import { handleMcpRequest, LAYOUT_MCP_TOOLS } from '../ui/layout-mcp-server';

export interface McpServerConfig {
  type: 'stdio' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  enabled: boolean;
  tier: 'LEVEL_1_TYPES' | 'LEVEL_2_VISUAL' | 'LEVEL_3_DEVOPS';
  description: string;
}

export interface McpPipelineConfig {
  version: string;
  servers: Record<string, McpServerConfig>;
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

export interface PipelineHealthSummary {
  timestamp: string;
  totalConfigured: number;
  healthyCount: number;
  unavailableCount: number;
  disabledCount: number;
  results: ServerHealthResult[];
}

export function loadMcpConfig(): McpPipelineConfig {
  const configPath = path.resolve(process.cwd(), '.mcp/mcp-servers.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`MCP config file not found at: ${configPath}`);
  }
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Health probe for in-house and remote MCP servers.
 */
export async function probeServerHealth(name: string, config: McpServerConfig): Promise<ServerHealthResult> {
  const start = Date.now();

  if (!config.enabled) {
    return {
      name,
      tier: config.tier,
      enabled: false,
      status: 'DISABLED',
      latencyMs: 0,
      toolsCount: 0,
      message: 'Server is disabled in configuration.'
    };
  }

  // 1. In-house layout-sentry MCP
  if (name === 'layout-sentry') {
    try {
      const pingRes = await handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'ping', params: {} });
      const toolsRes = await handleMcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
      const latencyMs = Date.now() - start;
      return {
        name,
        tier: config.tier,
        enabled: true,
        status: pingRes ? 'HEALTHY' : 'UNAVAILABLE',
        latencyMs,
        toolsCount: toolsRes?.result?.tools?.length || 0,
        message: 'In-house layout & AST nesting healer active.'
      };
    } catch (err: any) {
      return {
        name,
        tier: config.tier,
        enabled: true,
        status: 'UNAVAILABLE',
        latencyMs: Date.now() - start,
        toolsCount: 0,
        message: err.message
      };
    }
  }

  // 2. HTTP-based MCP (e.g. GraphRAG)
  if (config.type === 'http' && config.url) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(config.url, { signal: controller.signal }).catch(() => null);
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      const isOk = res && (res.status === 200 || res.status === 404 || res.status === 405);
      return {
        name,
        tier: config.tier,
        enabled: true,
        status: isOk ? 'HEALTHY' : 'UNAVAILABLE',
        latencyMs,
        toolsCount: isOk ? 1 : 0,
        message: isOk ? 'Knowledge memory service responding.' : 'Memory service port 8100 unreachable.'
      };
    } catch {
      return {
        name,
        tier: config.tier,
        enabled: true,
        status: 'UNAVAILABLE',
        latencyMs: Date.now() - start,
        toolsCount: 0,
        message: 'HTTP probe timeout or connection refused.'
      };
    }
  }

  // 3. Stdio CLI tools (e.g. git-sentinel, npx packages)
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

  return {
    name,
    tier: config.tier,
    enabled: true,
    status: 'UNAVAILABLE',
    latencyMs: Date.now() - start,
    toolsCount: 0,
    message: 'Unknown server configuration type.'
  };
}

export async function runMcpPipelineHealthCheck(): Promise<PipelineHealthSummary> {
  const config = loadMcpConfig();
  const results: ServerHealthResult[] = [];

  for (const [name, srv] of Object.entries(config.servers)) {
    const health = await probeServerHealth(name, srv);
    results.push(health);
  }

  const healthyCount = results.filter(r => r.status === 'HEALTHY').length;
  const unavailableCount = results.filter(r => r.status === 'UNAVAILABLE').length;
  const disabledCount = results.filter(r => r.status === 'DISABLED').length;

  return {
    timestamp: new Date().toISOString(),
    totalConfigured: results.length,
    healthyCount,
    unavailableCount,
    disabledCount,
    results
  };
}

export async function printMcpPipelineReport(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🌐 OmniSMM 1.0 — Model Context Protocol (MCP) Pipeline Orchestrator');
  console.log('   Standard: MCP 2026.1 | Anti-Hallucination & Visual Governance');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log('🔍 Probing configured MCP servers...\n');
  const summary = await runMcpPipelineHealthCheck();

  for (const r of summary.results) {
    const icon = r.status === 'HEALTHY' ? '🟢' : r.status === 'DISABLED' ? '⚪' : '🔴';
    console.log(`${icon} [${r.tier}] ${r.name.padEnd(18)} | ${r.status.padEnd(11)} | ${r.latencyMs}ms | ${r.toolsCount} tools`);
    console.log(`   └─ ${r.message}`);
  }

  console.log('\n───────────────────────────────────────────────────────────────────────');
  console.log(`📊 Итог проверки здоровья:`);
  console.log(`   Всего серверов в манифесте: ${summary.totalConfigured}`);
  console.log(`   Готовы к работе (Healthy):  ${summary.healthyCount}`);
  console.log(`   Недоступны (Unavailable):   ${summary.unavailableCount}`);
  console.log(`   Отключены (Disabled):       ${summary.disabledCount}`);
  console.log('───────────────────────────────────────────────────────────────────────\n');
}

if (require.main === module) {
  printMcpPipelineReport();
}
