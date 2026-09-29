import http from 'http';
import { LayaEngine } from './engine.js';

const PORT = Number(process.env.PORT) || 8150;

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Healthcheck
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', engine: 'Laya Decision Engine (CPU)', uptime: process.uptime() }));
    return;
  }

  // MCP JSON-RPC 2.0 или прямой REST API
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');

        // Обработка MCP JSON-RPC вызовов
        if (payload.jsonrpc === '2.0') {
          if (payload.method === 'tools/list') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id: payload.id,
              result: {
                tools: [
                  { name: 'laya_decide', description: 'Fast System 1 multi-task decision gate (15-35ms)' },
                  { name: 'laya_classify', description: 'Classifies design DNA and detects AI-slop' },
                  { name: 'laya_score', description: 'Scores density, WCAG, and touch targets' },
                  { name: 'laya_check', description: 'Fast ternary gate (YES/NO/UNKNOWN)' }
                ]
              }
            }));
            return;
          }

          if (payload.method === 'tools/call') {
            const toolName = payload.params?.name;
            const args = payload.params?.arguments || {};
            let result: unknown = null;

            if (toolName === 'laya_decide') {
              result = LayaEngine.decide(args.candidateLayout || '', args.context);
            } else if (toolName === 'laya_classify') {
              result = LayaEngine.classifyDna(args.candidateLayout || '');
            } else if (toolName === 'laya_score') {
              result = LayaEngine.score(args.candidateLayout || '');
            } else if (toolName === 'laya_check') {
              const decision = LayaEngine.decide(args.candidateLayout || '', args.context);
              result = { gate: args.gateName, pass: decision.gates[args.gateName as keyof typeof decision.gates] ?? false };
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ jsonrpc: '2.0', id: payload.id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } }));
            return;
          }
        }

        // Прямой REST
        if (req.url === '/api/laya/decide') {
          const result = LayaEngine.decide(payload.candidateLayout || '', payload.context);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Laya Engine] Running on port ${PORT} (CPU Mode, Zero NPU required)`);
});
