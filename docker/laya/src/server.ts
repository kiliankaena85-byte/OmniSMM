// docker/laya/src/server.ts
// Laya System 1 Decision Engine Server (REST + MCP JSON-RPC 2.0 / Port 8150)

import http from 'http';
import { LayaEngine } from './engine.js';

const PORT = Number(process.env.PORT) || 8150;

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Healthcheck
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      engine: 'Laya System 1 Decision Engine (Non-AR CPU/Direct)',
      version: LayaEngine.VERSION,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Handle POST Requests (REST API & MCP JSON-RPC 2.0)
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const url = req.url?.split('?')[0] || '';

        // 1. MCP JSON-RPC 2.0 PROTOCOL
        if (payload.jsonrpc === '2.0') {
          // List Available MCP Tools
          if (payload.method === 'tools/list') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id: payload.id,
              result: {
                tools: [
                  {
                    name: 'decide_choice',
                    description: 'Non-autoregressive selection of best option from N candidates with probability distribution',
                    inputSchema: { type: 'object', required: ['context', 'instruction', 'options'] }
                  },
                  {
                    name: 'decide_score',
                    description: 'Calculates continuous risk or domain score [0.0..1.0] (FRAUD_RISK, LINK_SAFETY, etc.)',
                    inputSchema: { type: 'object', required: ['context', 'metricName'] }
                  },
                  {
                    name: 'decide_noul',
                    description: 'Non-autoregressive unconditional binary gate (Yes/No with confidence threshold)',
                    inputSchema: { type: 'object', required: ['proposition', 'context'] }
                  },
                  {
                    name: 'decide_route_order',
                    description: 'Autonomous high-margin order router between Tier-0 in-house MTProto robots and wholesale providers',
                    inputSchema: { type: 'object', required: ['orderId', 'serviceCategory', 'targetUrl', 'quantity', 'candidates'] }
                  },
                  {
                    name: 'decide_action_arbitration',
                    description: 'AAA-2026 Autonomous Action Arbiter for zero-token developer gatekeeping',
                    inputSchema: { type: 'object', required: ['actionId', 'intent', 'category', 'isDestructive', 'hasRollbackPlan'] }
                  },
                  {
                    name: 'decide_dialectical_synthesis',
                    description: 'Dialectical Self-Loop Improving Arbiter (Thesis Alpha, Antithesis Beta, Synthesis Gamma)',
                    inputSchema: { type: 'object', required: ['taskId', 'taskContext', 'businessObjective', 'hardInvariants', 'candidates'] }
                  },
                  // Legacy UI tools
                  { name: 'laya_decide', description: 'Fast UI design decision and slop check' },
                  { name: 'laya_classify', description: 'Classifies UI design DNA' },
                  { name: 'laya_score', description: 'Scores UI density, WCAG, and touch targets' }
                ]
              }
            }));
            return;
          }

          // Execute MCP Tool
          if (payload.method === 'tools/call') {
            const toolName = payload.params?.name;
            const args = payload.params?.arguments || {};
            let result: unknown = null;

            switch (toolName) {
              case 'decide_choice':
                result = LayaEngine.decideChoice(args);
                break;
              case 'decide_score':
                result = LayaEngine.decideScore(args);
                break;
              case 'decide_noul':
                result = LayaEngine.decideNoul(args);
                break;
              case 'decide_route_order':
                result = LayaEngine.decideRouteOrder(args);
                break;
              case 'decide_action_arbitration':
                result = LayaEngine.decideActionArbitration(args);
                break;
              case 'decide_dialectical_synthesis':
                result = LayaEngine.decideDialecticalSynthesis(args);
                break;
              // Legacy
              case 'laya_decide':
                result = LayaEngine.decide(args.candidateLayout || '', args.context);
                break;
              case 'laya_classify':
                result = LayaEngine.classifyDna(args.candidateLayout || '');
                break;
              case 'laya_score':
                result = LayaEngine.score(args.candidateLayout || '');
                break;
              default:
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  jsonrpc: '2.0',
                  id: payload.id,
                  error: { code: -32601, message: `Tool '${toolName}' not found` }
                }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id: payload.id,
              result: {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
              }
            }));
            return;
          }
        }

        // 2. REST API V1 ENDPOINTS
        let restResult: unknown = null;

        if (url === '/api/v1/decide/choice') {
          restResult = LayaEngine.decideChoice(payload);
        } else if (url === '/api/v1/decide/score') {
          restResult = LayaEngine.decideScore(payload);
        } else if (url === '/api/v1/decide/noul') {
          restResult = LayaEngine.decideNoul(payload);
        } else if (url === '/api/v1/decide/route-order') {
          restResult = LayaEngine.decideRouteOrder(payload);
        } else if (url === '/api/v1/decide/action-arbitration') {
          restResult = LayaEngine.decideActionArbitration(payload);
        } else if (url === '/api/v1/decide/dialectical-synthesis') {
          restResult = LayaEngine.decideDialecticalSynthesis(payload);
        } else if (url === '/api/v1/decide/ui') {
          restResult = LayaEngine.decide(payload.layout || '', payload.context);
        }

        if (restResult !== null) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(restResult));
          return;
        }

        // Unrecognized route
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Not found: ${req.method} ${url}` }));
      } catch (err: unknown) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error', message: String(err) }));
      }
    });
    return;
  }

  // Default 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [Laya Decision Engine] Active on http://0.0.0.0:${PORT} (Version: ${LayaEngine.VERSION})`);
});
