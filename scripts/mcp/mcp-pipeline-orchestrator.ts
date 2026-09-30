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
import { probeServerHealth, McpServerConfig, ServerHealthResult } from './orchestrator/server-probes';

export { probeServerHealth };
export type { McpServerConfig, ServerHealthResult };

export interface McpPipelineConfig {
  version: string;
  servers: Record<string, McpServerConfig>;
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
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

export async function runMcpPipelineHealthCheck(): Promise<PipelineHealthSummary> {
  const config = loadMcpConfig();
  const results: ServerHealthResult[] = [];

  for (const [name, srv] of Object.entries(config.servers)) {
    const health = await probeServerHealth(name, srv);
    results.push(health);
  }

  return {
    timestamp: new Date().toISOString(),
    totalConfigured: results.length,
    healthyCount: results.filter(r => r.status === 'HEALTHY').length,
    unavailableCount: results.filter(r => r.status === 'UNAVAILABLE').length,
    disabledCount: results.filter(r => r.status === 'DISABLED').length,
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
