/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * Layout Overflow Sentry — Model Context Protocol (MCP) Server.
 *
 * Implements JSON-RPC 2.0 stdio transport conforming to MCP specification:
 * - layout_audit: static & AST analysis of UI components for layout anti-patterns.
 * - layout_autofix: automated healing codemod for layout defects (shrink-0, min-w-0, w-screen, iOS zoom).
 * - layout_dom_probe: headless Playwright verification of live DOM overflow (rect.right > clientWidth).
 */

import readline from 'readline';
import { runLayoutAudit, scanComponentFiles } from './layout-sentry';
import { healLayoutFiles } from './layout-healer';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export const LAYOUT_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'layout_audit',
    description: 'Scans React/Tailwind UI components for layout defects, DOM nesting violations, horizontal overflow, and squashed elements.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          description: 'Optional path or directory to scan (e.g. "src/components/dashboard")'
        }
      }
    }
  },
  {
    name: 'layout_autofix',
    description: 'Automatically heals layout defects: injects shrink-0 into icons, adds min-w-0 to truncate flex children, replaces w-screen with w-full, fixes iOS auto-zoom input sizes.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          description: 'Optional path or directory to heal'
        },
        dryRun: {
          type: 'boolean',
          description: 'If true, simulates fixes without writing to disk (default: false)'
        }
      }
    }
  },
  {
    name: 'layout_dom_probe',
    description: 'Performs live DOM measurement on a running instance (port 3000/3005) to detect overflow culprits (rect.right > clientWidth).',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to inspect (e.g. "http://127.0.0.1:3000/dashboard")'
        },
        width: {
          type: 'number',
          description: 'Viewport width in px (default: 375)'
        },
        height: {
          type: 'number',
          description: 'Viewport height in px (default: 667)'
        }
      }
    }
  }
];

export async function handleMcpRequest(request: any): Promise<any> {
  const { id, method, params } = request;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'layout-overflow-sentry',
            version: '2.0.0'
          }
        }
      };

    case 'notifications/initialized':
      return null;

    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: LAYOUT_MCP_TOOLS
        }
      };

    case 'tools/call': {
      const toolName = params?.name;
      const args = params?.arguments || {};

      if (toolName === 'layout_audit') {
        const dirs = args.scope ? [args.scope] : undefined;
        const findings = scanComponentFiles(dirs);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'success',
                    totalDefects: findings.length,
                    findings
                  },
                  null,
                  2
                )
              }
            ]
          }
        };
      }

      if (toolName === 'layout_autofix') {
        const healResult = healLayoutFiles({
          scope: args.scope,
          dryRun: args.dryRun ?? false
        });
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    status: 'success',
                    dryRun: healResult.dryRun,
                    filesScanned: healResult.filesScanned,
                    filesModified: healResult.filesModified,
                    fixesApplied: healResult.fixesApplied,
                    fixes: healResult.fixes
                  },
                  null,
                  2
                )
              }
            ]
          }
        };
      }

      if (toolName === 'layout_dom_probe') {
        const url = args.url || 'http://127.0.0.1:3000';
        const width = Number(args.width) || 375;
        const height = Number(args.height) || 667;

        const liveProbeResult = {
          status: 'success',
          viewport: { width, height },
          url,
          scrollWidth: width,
          clientWidth: width,
          horizontalScroll: false,
          overflowDeltaPx: 0,
          culprits: [] as any[],
          squashedIconsCount: 0,
          smallTouchTargetsCount: 0,
          smallTouchTargets: [] as string[],
          iosZoomSafe: true,
          unsafeInputs: [] as string[],
          consoleErrors: [] as string[],
          error: null as string | null
        };

        try {
          const { chromium } = await import('playwright');
          const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
          });
          const page = await browser.newPage({
            viewport: { width, height },
            hasTouch: width <= 768
          });

          page.on('console', (msg) => {
            if (msg.type() === 'error') {
              liveProbeResult.consoleErrors.push(msg.text());
            }
          });

          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
          await page.waitForTimeout(500);

          const probeData = await page.evaluate((vw) => {
            const docEl = document.documentElement;
            const body = document.body;
            const scrollWidth = Math.max(docEl.scrollWidth, body ? body.scrollWidth : 0);
            const clientWidth = docEl.clientWidth;
            const overflowDeltaPx = Math.max(0, scrollWidth - clientWidth);

            const culprits: { tag: string; className: string; overflowPx: number }[] = [];
            document.querySelectorAll('*').forEach((el) => {
              const rect = el.getBoundingClientRect();
              if (rect.right > vw + 1) {
                culprits.push({
                  tag: el.tagName.toLowerCase(),
                  className: (el.className || '').toString().slice(0, 80),
                  overflowPx: Math.round(rect.right - vw)
                });
              }
            });

            let squashed = 0;
            document.querySelectorAll('svg').forEach((svg) => {
              const rect = svg.getBoundingClientRect();
              if (rect.width > 0 && rect.width < 12) squashed++;
            });

            // Touch target audit (< 40px)
            const smallTargets: string[] = [];
            document.querySelectorAll('button, a, [role="button"], input[type="checkbox"]').forEach((el) => {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && (rect.width < 40 || rect.height < 40)) {
                smallTargets.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 30)} (${Math.round(rect.width)}x${Math.round(rect.height)}px)`);
              }
            });

            // iOS zoom audit (< 15.5px)
            const unsafeInps: string[] = [];
            document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea, select').forEach((inp) => {
              const style = window.getComputedStyle(inp);
              const fs = parseFloat(style.fontSize) || 0;
              if (fs > 0 && fs < 15.5) {
                unsafeInps.push(`${inp.tagName.toLowerCase()}#${inp.id || 'no-id'} (fs=${Math.round(fs)}px)`);
              }
            });

            return {
              scrollWidth,
              clientWidth,
              overflowDeltaPx,
              culprits: culprits.slice(0, 10),
              squashed,
              smallTouchTargetsCount: smallTargets.length,
              smallTouchTargets: smallTargets.slice(0, 5),
              iosZoomSafe: unsafeInps.length === 0,
              unsafeInputs: unsafeInps.slice(0, 5)
            };
          }, width);

          await browser.close();

          liveProbeResult.scrollWidth = probeData.scrollWidth;
          liveProbeResult.clientWidth = probeData.clientWidth;
          liveProbeResult.overflowDeltaPx = probeData.overflowDeltaPx;
          liveProbeResult.horizontalScroll = probeData.scrollWidth > width;
          liveProbeResult.culprits = probeData.culprits;
          liveProbeResult.squashedIconsCount = probeData.squashed;
          liveProbeResult.smallTouchTargetsCount = probeData.smallTouchTargetsCount;
          liveProbeResult.smallTouchTargets = probeData.smallTouchTargets;
          liveProbeResult.iosZoomSafe = probeData.iosZoomSafe;
          liveProbeResult.unsafeInputs = probeData.unsafeInputs;
        } catch (err: any) {
          liveProbeResult.error = `Live probe fallback: ${err.message}`;
        }

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(liveProbeResult, null, 2)
              }
            ]
          }
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method or tool "${toolName}" not found.`
        }
      };
    }

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method "${method}" not found.`
        }
      };
  }
}

export function startMcpServer(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', async (line) => {
    if (!line.trim()) return;
    try {
      const request = JSON.parse(line);
      const response = await handleMcpRequest(request);
      if (response) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch (err: any) {
      const errResponse = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: `Parse error: ${err.message}`
        }
      };
      process.stdout.write(JSON.stringify(errResponse) + '\n');
    }
  });
}

if (require.main === module) {
  startMcpServer();
}
