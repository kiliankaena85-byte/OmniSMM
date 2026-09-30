import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PassThrough } from 'stream';
import { handleOmniDesignMcpRequest, createOmniDesignStdioServer, OMNIDESIGN_MCP_TOOLS } from '../../../scripts/mcp/omnidesign-mcp-server';
import { JsonRpcRequest } from '../../../scripts/mcp/omnidesign/types';

describe('OmniDesign MCP Hub (omnidesign-mcp-server)', () => {
  const testDir = path.resolve(process.cwd(), '.planning/test_mcp');
  const sampleFilePath = path.join(testDir, 'SampleCard.tsx');

  const sampleCardCode = `"use client";

import React from "react";

export function SampleCard() {
  return (
    <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
      <h2 className="text-xl font-bold text-white mb-2">Card Heading</h2>
      <p className="text-sm text-slate-400 mb-4">Description text</p>
      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">
        Submit
      </button>
    </div>
  );
}
`;

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    fs.writeFileSync(sampleFilePath, sampleCardCode, 'utf-8');
  });

  afterEach(() => {
    if (fs.existsSync(sampleFilePath)) {
      fs.unlinkSync(sampleFilePath);
    }
    if (fs.existsSync(testDir)) {
      try {
        fs.rmdirSync(testDir);
      } catch {
        // ignore if not empty
      }
    }
  });

  describe('Protocol Handshake & Routing', () => {
    it('1. should handle initialize method correctly', async () => {
      const req: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      };
      const res = await handleOmniDesignMcpRequest(req);
      expect(res.id).toBe(1);
      expect(res.error).toBeUndefined();
      expect(res.result?.serverInfo?.name).toBe('omnidesign-hub');
      expect(res.result?.protocolVersion).toBe('2024-11-05');
      expect(res.result?.capabilities?.tools).toBeDefined();
    });

    it('2. should handle ping and notifications/initialized', async () => {
      const pingRes = await handleOmniDesignMcpRequest({
        jsonrpc: '2.0',
        id: 'ping-1',
        method: 'ping',
      });
      expect(pingRes.error).toBeUndefined();
      expect(pingRes.result).toEqual({});

      const initRes = await handleOmniDesignMcpRequest({
        jsonrpc: '2.0',
        id: null,
        method: 'notifications/initialized',
      });
      expect(initRes.error).toBeUndefined();
    });

    it('3. should return JSON-RPC error -32601 for unknown method', async () => {
      const res = await handleOmniDesignMcpRequest({
        jsonrpc: '2.0',
        id: 99,
        method: 'unknown_method_xyz',
      });
      expect(res.error).toBeDefined();
      expect(res.error?.code).toBe(-32601);
      expect(res.error?.message).toContain('Method not found');
    });

    it('4. should return JSON-RPC error -32602 when tools/call has no tool name', async () => {
      const res = await handleOmniDesignMcpRequest({
        jsonrpc: '2.0',
        id: 100,
        method: 'tools/call',
      });
      expect(res.error).toBeDefined();
      expect(res.error?.code).toBe(-32602);
    });
  });

  describe('tools/list', () => {
    it('5. should list all 5 OmniDesign tools with complete schemas', async () => {
      const req: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      };
      const res = await handleOmniDesignMcpRequest(req);
      expect(res.error).toBeUndefined();
      const tools = res.result?.tools;
      expect(Array.isArray(tools)).toBe(true);
      expect(tools?.length).toBe(5);

      const toolNames = tools?.map((t) => t.name);
      expect(toolNames).toContain('inspect_jsx_nodes');
      expect(toolNames).toContain('tag_component_tree');
      expect(toolNames).toContain('mutate_classes');
      expect(toolNames).toContain('validate_design_tokens');
      expect(toolNames).toContain('generate_design_candidate');

      for (const t of tools ?? []) {
        expect(t.description.length).toBeGreaterThan(10);
        expect(t.inputSchema.type).toBe('object');
        expect(t.inputSchema.properties).toBeDefined();
      }
    });
  });

  describe('tools/call: inspect_jsx_nodes', () => {
    it('6. should inspect nodes from raw TSX code', async () => {
      const req: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'inspect_jsx_nodes',
          arguments: {
            code: '<div className="hero"><h1 className="title">Title</h1><button className="btn">Click</button></div>',
          },
        },
      };
      const res = await handleOmniDesignMcpRequest(req);
      expect(res.error).toBeUndefined();
      const data = res.result?.data as { totalNodes: number; nodes: Array<{ tag: string; className: string; structuralPath: string }> };
      expect(data.totalNodes).toBe(3);
      expect(data.nodes[0].tag).toBe('div');
      expect(data.nodes[0].className).toBe('hero');
      expect(data.nodes[0].structuralPath).toBe('div[0]');
      expect(data.nodes[1].tag).toBe('h1');
      expect(data.nodes[1].structuralPath).toBe('div[0]/h1[0]');
      expect(data.nodes[2].tag).toBe('button');
      expect(data.nodes[2].structuralPath).toBe('div[0]/button[0]');
    });

    it('7. should inspect nodes from file path', async () => {
      const req: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'inspect_jsx_nodes',
          arguments: {
            filePath: sampleFilePath,
          },
        },
      };
      const res = await handleOmniDesignMcpRequest(req);
      expect(res.error).toBeUndefined();
      const data = res.result?.data as { totalNodes: number; nodes: Array<{ tag: string; line: number }> };
      expect(data.totalNodes).toBe(4); // div, h2, p, button
      expect(data.nodes.map((n) => n.tag)).toEqual(['div', 'h2', 'p', 'button']);
    });
  });

  describe('tools/call: tag_component_tree', () => {
    it('8. should inject hierarchical data-omni-path attributes', async () => {
      const req: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'tag_component_tree',
          arguments: {
            code: '<div><header><nav></nav></header><main><section></section></main></div>',
            componentName: 'AppShell',
          },
        },
      };
      const res = await handleOmniDesignMcpRequest(req);
      expect(res.error).toBeUndefined();
      const data = res.result?.data as { componentName: string; taggedCode: string };
      expect(data.componentName).toBe('AppShell');
      expect(data.taggedCode).toContain('data-omni-path="AppShell/div[0]"');
      expect(data.taggedCode).toContain('data-omni-path="AppShell/div[0]/header[0]"');
      expect(data.taggedCode).toContain('data-omni-path="AppShell/div[0]/header[0]/nav[0]"');
    });
  });

  describe('tools/call: mutate_classes', () => {
    it('9. should mutate classes in memory with tailwind-merge conflict resolution', async () => {
      const req: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'mutate_classes',
          arguments: {
            code: '<div className="p-4 bg-slate-900 text-white"><button className="bg-blue-600 px-3">Go</button></div>',
            structuralPath: 'button[0]',
            mutation: {
              removeClasses: ['bg-blue-600'],
              addClasses: ['bg-primary', 'px-5'],
            },
          },
        },
      };
      const res = await handleOmniDesignMcpRequest(req);
      expect(res.error).toBeUndefined();
      const data = res.result?.data as { success: boolean; modifiedCode: string; newClasses: string };
      expect(data.success).toBe(true);
      expect(data.newClasses).toContain('bg-primary');
      expect(data.newClasses).toContain('px-5');
      expect(data.newClasses).not.toContain('bg-blue-600');
      expect(data.newClasses).not.toContain('px-3'); // replaced by px-5 via twMerge
      expect(data.modifiedCode).toContain('className="bg-primary px-5"');
    });

    it('10. should mutate classes directly on disk in file', async () => {
      const req: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'mutate_classes',
          arguments: {
            filePath: sampleFilePath,
            structuralPath: 'button',
            mutation: {
              removeClasses: ['bg-blue-600'],
              addClasses: ['bg-primary', 'hover:bg-primary/90'],
            },
          },
        },
      };
      const res = await handleOmniDesignMcpRequest(req);
      expect(res.error).toBeUndefined();
      const data = res.result?.data as { success: boolean; newClasses: string };
      expect(data.success).toBe(true);
      expect(data.newClasses).toContain('bg-primary');

      const updatedFile = fs.readFileSync(sampleFilePath, 'utf-8');
      expect(updatedFile).toContain('bg-primary');
      expect(updatedFile).not.toContain('bg-blue-600');
    });
  });

  describe('tools/call: validate_design_tokens', () => {
    it('11. should detect acid-neon slop gradients and raw colors as violations', async () => {
      const slopCode = `
        <div className="bg-black text-white p-6">
          <div className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 shadow-[0_0_50px_rgba(255,0,255,0.5)]">
            <span className="text-black bg-white">Raw</span>
          </div>
        </div>
      `;
      const req: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'validate_design_tokens',
          arguments: {
            code: slopCode,
          },
        },
      };
      const res = await handleOmniDesignMcpRequest(req);
      expect(res.error).toBeUndefined();
      const data = res.result?.data as { valid: boolean; violationsCount: number; violations: Array<{ matched: string; reason: string }> };
      expect(data.valid).toBe(false);
      expect(data.violationsCount).toBeGreaterThanOrEqual(3);

      const matchedStrings = data.violations.map((v) => v.matched);
      expect(matchedStrings.some((m) => m.includes('from-purple-600 via-fuchsia-600 to-pink-600'))).toBe(true);
      expect(matchedStrings).toContain('bg-black');
    });

    it('12. should pass validation on Obsidian Slate & Cobalt Matrix compliant code', async () => {
      const compliantCode = `
        <div className="min-h-screen bg-[#0B0E14] text-foreground p-6">
          <div className="bg-card/40 border border-border/40 rounded-2xl p-6">
            <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded-md text-xs">
              Live Matrix
            </span>
            <h1 className="text-2xl font-bold text-foreground mt-4">Safe Title</h1>
            <p className="text-muted-foreground text-sm mt-2">Safe description</p>
          </div>
        </div>
      `;
      const req: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'validate_design_tokens',
          arguments: {
            code: compliantCode,
          },
        },
      };
      const res = await handleOmniDesignMcpRequest(req);
      expect(res.error).toBeUndefined();
      const data = res.result?.data as { valid: boolean; violationsCount: number; violations: unknown[] };
      expect(data.valid).toBe(true);
      expect(data.violationsCount).toBe(0);
      expect(data.violations).toHaveLength(0);
    });
  });

  describe('tools/call: generate_design_candidate', () => {
    it('13. should generate compliant SMMflux Obsidian Slate component within 200 lines', async () => {
      const req: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'generate_design_candidate',
          arguments: {
            componentName: 'FluxFeatureCard',
            brand: 'smmflux',
            category: 'card',
            title: 'Realtime Boost Engine',
            description: 'Automatic instant fulfillment with SLA 99.98%',
          },
        },
      };
      const res = await handleOmniDesignMcpRequest(req);
      expect(res.error).toBeUndefined();
      const data = res.result?.data as {
        componentName: string;
        candidateCode: string;
        lineCount: number;
        adheresToMaxLines: boolean;
        tokenValidation: { valid: boolean; violationsCount: number };
      };
      expect(data.componentName).toBe('FluxFeatureCard');
      expect(data.candidateCode).toContain('"use client"');
      expect(data.candidateCode).toContain('FluxCard');
      expect(data.candidateCode).toContain('Cobalt Matrix');
      expect(data.candidateCode).toContain('bg-[#0B0E14]');
      expect(data.adheresToMaxLines).toBe(true);
      expect(data.lineCount).toBeLessThanOrEqual(200);
      expect(data.tokenValidation.valid).toBe(true);
      expect(data.tokenValidation.violationsCount).toBe(0);
    });

    it('14. should generate compliant SMMplan API Fintech card within 200 lines', async () => {
      const req: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'generate_design_candidate',
          arguments: {
            componentName: 'PlanEndpointCard',
            brand: 'smmplan',
            category: 'card',
            title: 'Orders API Gateway',
            description: 'High-throughput endpoint for bulk resellers',
          },
        },
      };
      const res = await handleOmniDesignMcpRequest(req);
      expect(res.error).toBeUndefined();
      const data = res.result?.data as {
        componentName: string;
        candidateCode: string;
        lineCount: number;
        adheresToMaxLines: boolean;
        tokenValidation: { valid: boolean; violationsCount: number };
      };
      expect(data.componentName).toBe('PlanEndpointCard');
      expect(data.candidateCode).toContain('PlanCard');
      expect(data.candidateCode).toContain('SMMplan API');
      expect(data.adheresToMaxLines).toBe(true);
      expect(data.lineCount).toBeLessThanOrEqual(200);
      expect(data.tokenValidation.valid).toBe(true);
    });

    it('15. should generate compliant wizard and hud components within 200 lines', async () => {
      const wizardRes = await handleOmniDesignMcpRequest({
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'generate_design_candidate',
          arguments: { componentName: 'CheckoutWizard', category: 'wizard', brand: 'smmflux' },
        },
      });
      expect(wizardRes.error).toBeUndefined();
      const wizardData = wizardRes.result?.data as { candidateCode: string; adheresToMaxLines: boolean; tokenValidation: { valid: boolean } };
      expect(wizardData.candidateCode).toContain('CheckoutWizard');
      expect(wizardData.candidateCode).toContain('bg-[#0B0E14]');
      expect(wizardData.adheresToMaxLines).toBe(true);
      expect(wizardData.tokenValidation.valid).toBe(true);

      const hudRes = await handleOmniDesignMcpRequest({
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/call',
        params: {
          name: 'generate_design_candidate',
          arguments: { componentName: 'SystemHud', category: 'hud', brand: 'smmplan' },
        },
      });
      expect(hudRes.error).toBeUndefined();
      const hudData = hudRes.result?.data as { candidateCode: string; adheresToMaxLines: boolean; tokenValidation: { valid: boolean } };
      expect(hudData.candidateCode).toContain('SystemHud');
      expect(hudData.adheresToMaxLines).toBe(true);
      expect(hudData.tokenValidation.valid).toBe(true);
    });
  });

  describe('Edge Cases & Resilient Error Paths', () => {
    it('16. should reject inspect_jsx_nodes with non-existent filePath', async () => {
      const res = await handleOmniDesignMcpRequest({
        jsonrpc: '2.0',
        id: 14,
        method: 'tools/call',
        params: {
          name: 'inspect_jsx_nodes',
          arguments: { filePath: 'nonexistent-component-xyz.tsx' },
        },
      });
      expect(res.error).toBeDefined();
      expect(res.error?.code).toBe(-32603);
      expect(res.error?.message).toContain('File not found');
    });

    it('17. should reject tag_component_tree with non-existent filePath', async () => {
      const res = await handleOmniDesignMcpRequest({
        jsonrpc: '2.0',
        id: 15,
        method: 'tools/call',
        params: {
          name: 'tag_component_tree',
          arguments: { filePath: 'nonexistent-component-xyz.tsx', componentName: 'Broken' },
        },
      });
      expect(res.error).toBeDefined();
      expect(res.error?.code).toBe(-32603);
      expect(res.error?.message).toContain('File not found');
    });

    it('18. should return error -32603 for unknown tool name', async () => {
      const res = await handleOmniDesignMcpRequest({
        jsonrpc: '2.0',
        id: 16,
        method: 'tools/call',
        params: {
          name: 'unknown_tool_foobar',
          arguments: {},
        },
      });
      expect(res.error).toBeDefined();
      expect(res.error?.code).toBe(-32603);
      expect(res.error?.message).toContain('Unknown OmniDesign tool');
    });

    it('19. should detect multi-line className violations in validate_design_tokens', async () => {
      const multiLineCode = `<div
        className={cn(
          "flex items-center",
          "bg-black",
          "text-white"
        )}
      />`;
      const res = await handleOmniDesignMcpRequest({
        jsonrpc: '2.0',
        id: 17,
        method: 'tools/call',
        params: {
          name: 'validate_design_tokens',
          arguments: { code: multiLineCode },
        },
      });
      expect(res.error).toBeUndefined();
      const data = res.result?.data as { valid: boolean; violationsCount: number; violations: Array<{ matched: string }> };
      expect(data.valid).toBe(false);
      expect(data.violations.some((v) => v.matched === 'bg-black')).toBe(true);
    });

    it('20. should detect multi-line inline style violations with backgroundColor', async () => {
      const inlineStyleCode = `<div style={{
        backgroundColor: '#ff0000',
        color: '#000000'
      }}>
        <span>Test</span>
      </div>`;
      const res = await handleOmniDesignMcpRequest({
        jsonrpc: '2.0',
        id: 18,
        method: 'tools/call',
        params: {
          name: 'validate_design_tokens',
          arguments: { code: inlineStyleCode },
        },
      });
      expect(res.error).toBeUndefined();
      const data = res.result?.data as { valid: boolean; violationsCount: number };
      expect(data.valid).toBe(false);
      expect(data.violationsCount).toBeGreaterThanOrEqual(1);
    });

    it('21. should detect unsemantic raw palette colors like bg-purple-600 and text-fuchsia-400', async () => {
      const unsemanticCode = `<button className="bg-purple-600 text-fuchsia-400">Click</button>`;
      const res = await handleOmniDesignMcpRequest({
        jsonrpc: '2.0',
        id: 19,
        method: 'tools/call',
        params: {
          name: 'validate_design_tokens',
          arguments: { code: unsemanticCode },
        },
      });
      expect(res.error).toBeUndefined();
      const data = res.result?.data as { valid: boolean; violations: Array<{ matched: string }> };
      expect(data.valid).toBe(false);
      expect(data.violations.some((v) => v.matched.includes('purple-600') || v.matched.includes('fuchsia-400'))).toBe(true);
    });

    it('22. should process JSON-RPC requests via stdio stream piping with createOmniDesignStdioServer', async () => {
      const inputStream = new PassThrough();
      const outputStream = new PassThrough();

      const serverRl = createOmniDesignStdioServer(inputStream, outputStream);

      const received: string[] = [];
      outputStream.on('data', (chunk: Buffer) => {
        received.push(chunk.toString());
      });

      const pingReq: JsonRpcRequest = { jsonrpc: '2.0', id: 42, method: 'ping' };
      inputStream.write(JSON.stringify(pingReq) + '\n');

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(received.length).toBeGreaterThan(0);
      const parsed = JSON.parse(received.join('')) as { jsonrpc: string; id: number; result: Record<string, unknown> };
      expect(parsed.id).toBe(42);
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.result).toBeDefined();

      serverRl.close();
      inputStream.end();
      outputStream.end();
    });
  });
});
