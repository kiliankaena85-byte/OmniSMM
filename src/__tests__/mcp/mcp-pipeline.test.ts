import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  loadMcpConfig,
  probeServerHealth,
  runMcpPipelineHealthCheck
} from '@/../scripts/mcp/mcp-pipeline-orchestrator';

describe('MCP Pipeline Orchestrator & Governance (RAC-2026)', () => {
  const mcpConfigFile = path.resolve(process.cwd(), '.mcp/mcp-servers.json');
  const specFile = path.resolve(process.cwd(), 'docs/specs/SPEC-2026-09-13-mcp-ecosystem-pipeline.md');
  const brainstormFile = path.resolve(process.cwd(), 'docs/architecture/MCP_OPENROUTER_BRAINSTORM_2026.md');

  it('1.1 should have valid MCP manifest, specification, and brainstorm documents', () => {
    expect(fs.existsSync(mcpConfigFile)).toBe(true);
    expect(fs.existsSync(specFile)).toBe(true);
    expect(fs.existsSync(brainstormFile)).toBe(true);
  });

  it('1.2 should correctly load and validate .mcp/mcp-servers.json manifest', () => {
    const config = loadMcpConfig();
    expect(config.version).toBe('2026.1');
    expect(config.servers).toHaveProperty('layout-sentry');
    expect(config.servers).toHaveProperty('puppeteer-visual');
    expect(config.servers).toHaveProperty('typescript-lsp');

    // Validate tier classification
    for (const [key, srv] of Object.entries(config.servers)) {
      expect(['LEVEL_1_TYPES', 'LEVEL_2_VISUAL', 'LEVEL_3_DEVOPS']).toContain(srv.tier);
      expect(typeof srv.enabled).toBe('boolean');
      expect(typeof srv.description).toBe('string');
    }
  });

  it('2.1 should verify in-house layout-sentry MCP health and tools', async () => {
    const config = loadMcpConfig();
    const result = await probeServerHealth('layout-sentry', config.servers['layout-sentry']);

    expect(result.status).toBe('HEALTHY');
    expect(result.toolsCount).toBeGreaterThanOrEqual(3);
    expect(result.tier).toBe('LEVEL_2_VISUAL');
  });

  it('2.2 should execute full pipeline health check and report healthy status', async () => {
    const summary = await runMcpPipelineHealthCheck();

    expect(summary.totalConfigured).toBeGreaterThanOrEqual(4);
    expect(summary.healthyCount).toBeGreaterThanOrEqual(3);
    expect(summary.results.length).toBe(summary.totalConfigured);
  });

  it('3.1 should have mcp:pipeline script registered in package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.scripts['mcp:pipeline']).toBe('tsx scripts/mcp/mcp-pipeline-orchestrator.ts');
  });
});
