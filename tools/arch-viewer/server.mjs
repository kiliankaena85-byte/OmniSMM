/**
 * OmniSMM 1.0 Architecture & UML Viewer Micro-Server (Port 3009)
 * Clean Architecture & Quality Cockpit (Uncle Bob Pattern)
 * 
 * Zero external production dependencies: runs on pure Node.js 22+
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const PORT = parseInt(process.env.PORT || '3009', 10);
const HOST = process.env.HOST || '0.0.0.0';

const TOPOLOGY_FILE = path.join(PROJECT_ROOT, 'artifacts/architecture-topology.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types for static serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

// SSE subscriber clients
const sseClients = new Set();

/**
 * Broadcast an event to all connected SSE clients
 */
export function broadcastSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Watch topology file for live updates with debounce
let debounceTimer = null;
if (fs.existsSync(TOPOLOGY_FILE)) {
  try {
    fs.watch(TOPOLOGY_FILE, () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('[Arch-Viewer] Topology file changed on disk, broadcasting SSE update...');
        broadcastSSE('topology-updated', { timestamp: Date.now() });
      }, 300);
    });
  } catch (err) {
    console.warn('[Arch-Viewer] Warning: Could not attach file watcher to topology file:', err.message);
  }
}

/**
 * Read topology JSON safely
 */
function readTopology() {
  if (!fs.existsSync(TOPOLOGY_FILE)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(TOPOLOGY_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[Arch-Viewer] Error reading topology:', err.message);
    return null;
  }
}

/**
 * Handle API requests
 */
async function handleApi(req, res, url) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /api/topology
  if (url.pathname === '/api/topology' && req.method === 'GET') {
    const topology = readTopology();
    if (!topology) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Topology not yet generated. Run scripts/check-clean-architecture.ts first.' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(topology));
    return;
  }

  // GET /api/stats
  if (url.pathname === '/api/stats' && req.method === 'GET') {
    const topology = readTopology();
    if (!topology) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Topology not yet generated.' }));
      return;
    }

    // Layer breakdown
    const layerStats = {
      0: { name: 'Domain', count: 0, lines: 0, crappyCount: 0 },
      1: { name: 'Services', count: 0, lines: 0, crappyCount: 0 },
      2: { name: 'Application', count: 0, lines: 0, crappyCount: 0 },
      3: { name: 'Presentation', count: 0, lines: 0, crappyCount: 0 }
    };

    // Bounded context breakdown
    const contextStats = {};

    let totalCrapLoad = 0;
    let totalCrappyMethods = 0;
    const allTopRisk = [];

    for (const node of topology.nodes) {
      const lvl = node.level ?? 3;
      if (layerStats[lvl]) {
        layerStats[lvl].count++;
        layerStats[lvl].lines += node.linesCount || 0;
        layerStats[lvl].crappyCount += node.crappyMethodsCount || 0;
      }

      const ctx = node.boundedContext || 'CORE_FRAMEWORK';
      if (!contextStats[ctx]) {
        contextStats[ctx] = { count: 0, lines: 0, crappyCount: 0, crapLoad: 0 };
      }
      contextStats[ctx].count++;
      contextStats[ctx].lines += node.linesCount || 0;
      contextStats[ctx].crappyCount += node.crappyMethodsCount || 0;
      contextStats[ctx].crapLoad += node.crapLoad || 0;

      totalCrapLoad += node.crapLoad || 0;
      totalCrappyMethods += node.crappyMethodsCount || 0;

      if (node.topRiskFunctions && node.topRiskFunctions.length > 0) {
        for (const fn of node.topRiskFunctions) {
          allTopRisk.push({
            file: node.id,
            layer: node.layer,
            boundedContext: node.boundedContext,
            ...fn
          });
        }
      }
    }

    allTopRisk.sort((a, b) => b.crapScore - a.crapScore);
    const topCrappyFunctions = allTopRisk.slice(0, 25);

    // Calculate Architecture Cleanliness Score (0 - 100%)
    const violationsCount = topology.violations ? topology.violations.length : 0;
    const cyclesCount = topology.cycles ? topology.cycles.length : 0;
    const totalFiles = topology.nodes.length || 1;
    const archScore = Math.max(0, 100 - (violationsCount * 10) - (cyclesCount * 5));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      generatedAt: topology.generatedAt,
      metrics: {
        totalFiles,
        totalEdges: topology.edges ? topology.edges.length : 0,
        violationsCount,
        cyclesCount,
        archScore,
        totalFunctions: topology.metrics?.totalFunctions || 0,
        totalCrappyMethods,
        totalCrapLoad
      },
      layers: layerStats,
      boundedContexts: contextStats,
      topCrappyFunctions
    }));
    return;
  }

  // GET /api/file?path=src/...
  if (url.pathname === '/api/file' && req.method === 'GET') {
    const queryPath = url.searchParams.get('path');
    if (!queryPath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing path query param' }));
      return;
    }

    // Path traversal security check
    const normalized = path.normalize(queryPath).replace(/^(\.\.[\/\\])+/, '');
    const cleanPath = normalized.replace(/\\/g, '/');

    // Strict boundary: only allow src/ or artifacts/
    if (!cleanPath.startsWith('src/') && !cleanPath.startsWith('artifacts/')) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Access denied. Only src/ and artifacts/ paths are permitted.' }));
      return;
    }

    // Disallow secret files (.env, credentials, etc.)
    if (cleanPath.includes('.env') || cleanPath.includes('secret') || cleanPath.includes('id_rsa')) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Access denied for sensitive files.' }));
      return;
    }

    const fullPath = path.join(PROJECT_ROOT, cleanPath);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
      return;
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        path: cleanPath,
        linesCount: lines.length,
        content
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read file: ' + err.message }));
    }
    return;
  }

  // GET /api/live-stream (Server-Sent Events)
  if (url.pathname === '/api/live-stream' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', time: Date.now() })}\n\n`);

    sseClients.add(res);
    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // POST /api/rescan
  if (url.pathname === '/api/rescan' && req.method === 'POST') {
    console.log('[Arch-Viewer] Received rescan trigger, executing check-clean-architecture.ts...');
    exec('npx tsx scripts/check-clean-architecture.ts', { cwd: PROJECT_ROOT }, (error, stdout, stderr) => {
      if (error) {
        console.error('[Arch-Viewer] Rescan error:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message, stderr }));
        return;
      }
      broadcastSSE('topology-updated', { timestamp: Date.now(), reason: 'rescan' });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Architecture rescan completed successfully', output: stdout }));
    });
    return;
  }

  // POST /api/proposal (Simulation sandbox)
  if (url.pathname === '/api/proposal' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { targetNodeId, splitFunctionNames, targetLayer } = payload;

        const topology = readTopology();
        if (!topology) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Topology not found' }));
          return;
        }

        const node = topology.nodes.find(n => n.id === targetNodeId);
        if (!node) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Target node not found in topology' }));
          return;
        }

        // Calculate hypothetical refactoring benefit
        const initialCrapLoad = node.crapLoad || 0;
        let simulatedCrapLoad = initialCrapLoad;
        let removedRiskFns = 0;

        if (Array.isArray(splitFunctionNames) && splitFunctionNames.length > 0) {
          for (const fn of node.topRiskFunctions || []) {
            if (splitFunctionNames.includes(fn.name)) {
              simulatedCrapLoad = Math.max(0, simulatedCrapLoad - fn.crapScore);
              removedRiskFns++;
            }
          }
        }

        const crapImprovement = initialCrapLoad - simulatedCrapLoad;
        const crapReductionPct = initialCrapLoad > 0 
          ? Math.round((crapImprovement / initialCrapLoad) * 100)
          : 0;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          proposal: {
            targetNodeId,
            initialCrapLoad,
            simulatedCrapLoad,
            crapImprovement,
            crapReductionPct,
            removedRiskFns,
            estimatedNewFiles: 2,
            recommendation: crapReductionPct > 50 
              ? 'HIGH IMPACT: Extracting these functions into a dedicated service layer reduces module risk by ' + crapReductionPct + '%'
              : 'MODERATE IMPACT: Recommended to extract helper submodules and add unit tests with >=80% coverage.'
          }
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body: ' + err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
}

/**
 * Handle static files
 */
function handleStatic(req, res, url) {
  let reqPath = url.pathname;
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  // Prevent directory traversal
  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    // Fallback to index.html for SPA routing
    const fallbackPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(fallbackPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(fallbackPath).pipe(res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
}

/**
 * Create HTTP server
 */
export const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else {
      handleStatic(req, res, url);
    }
  } catch (err) {
    console.error('[Arch-Viewer] Server error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error', details: err.message }));
    }
  }
});

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  server.listen(PORT, HOST, () => {
    console.log(`
╔═════════════════════════════════════════════════════════════════════════╗
║   🏛️  OmniSMM 1.0 Architecture & UML Viewer (Uncle Bob Pattern)        ║
║   🚀  Running at: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}                         ║
║   📡  Live SSE Stream active: watching artifacts/architecture-topology ║
║   🛡️  Docker & Stage Isolated (Zero footprint on Production)            ║
╚═════════════════════════════════════════════════════════════════════════╝
    `);
  });
}
